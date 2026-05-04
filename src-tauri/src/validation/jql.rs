use crate::errors::AppError;
use serde::{Deserialize, Serialize};

// ──────────────────────────────────────────────────────────────────────────────
// JQL validation
//
// Phase 1D implements a structural validator that rejects obviously malformed
// input without making a live network request to Jira.  It does not aim to be
// a full JQL parser; it catches common injection vectors and gross syntax errors
// so they never reach the Jira API layer.
//
// A live semantic check against the Jira API is a Phase 1D+ concern.
// ──────────────────────────────────────────────────────────────────────────────

/// Maximum JQL string length accepted.
const JQL_MAX_LEN: usize = 2048;

/// Characters that have no valid use in a safe JQL string and are common
/// injection vectors (SQL/script injection patterns).
const JQL_FORBIDDEN_PATTERNS: &[&str] = &[
    "--",   // SQL comment
    ";",    // statement separator
    "/*",   // block comment open
    "*/",   // block comment close
    "<script", // XSS probe
    "javascript:",
];

/// JQL keywords that may appear as field/function names — used to detect
/// an empty or keyword-only query that provides no real constraint.
const JQL_KEYWORDS: &[&str] = &["and", "or", "not", "order", "by", "asc", "desc"];

/// Result of a JQL validation pass.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JqlValidationResult {
    /// Trimmed, normalised query ready for use.
    pub normalised: String,
    /// Non-fatal advisory messages (e.g. "query has no ORDER BY").
    pub warnings: Vec<String>,
}

/// Validate and normalise a JQL string.
///
/// # Rules
/// 1. Must not be empty after trimming.
/// 2. Must not exceed `JQL_MAX_LEN` characters.
/// 3. Must not contain forbidden injection patterns.
/// 4. Must contain at least one non-keyword token (i.e. an actual field name
///    or function call — prevents trivially vacuous queries like `AND OR`).
/// 5. Must have balanced parentheses.
///
/// Returns a [`JqlValidationResult`] on success, or [`AppError::Validation`]
/// describing the first rule violation found.
pub fn validate_jql(raw: &str) -> Result<JqlValidationResult, AppError> {
    let trimmed = raw.trim();

    // Rule 1 — non-empty
    if trimmed.is_empty() {
        return Err(AppError::Validation("JQL must not be empty".to_string()));
    }

    // Rule 2 — length cap
    if trimmed.len() > JQL_MAX_LEN {
        return Err(AppError::Validation(format!(
            "JQL exceeds maximum length of {JQL_MAX_LEN} characters"
        )));
    }

    // Rule 3 — no forbidden patterns (case-insensitive)
    let lower = trimmed.to_lowercase();
    for pattern in JQL_FORBIDDEN_PATTERNS {
        if lower.contains(pattern) {
            return Err(AppError::Validation(format!(
                "JQL contains forbidden pattern: '{pattern}'"
            )));
        }
    }

    // Rule 4 — at least one non-keyword token
    let tokens: Vec<&str> = trimmed
        .split_whitespace()
        .filter(|t| {
            let t_lower = t.to_lowercase();
            let stripped = t_lower.trim_matches(|c: char| !c.is_alphanumeric());
            !JQL_KEYWORDS.contains(&stripped)
        })
        .collect();

    if tokens.is_empty() {
        return Err(AppError::Validation(
            "JQL must contain at least one field or function reference".to_string(),
        ));
    }

    // Rule 5 — balanced parentheses
    let depth: i32 = trimmed.chars().fold(0i32, |acc, c| match c {
        '(' => acc + 1,
        ')' => acc - 1,
        _ => acc,
    });
    if depth != 0 {
        return Err(AppError::Validation(
            "JQL contains unbalanced parentheses".to_string(),
        ));
    }

    // Warnings (non-fatal)
    let mut warnings = Vec::new();
    if !lower.contains("order by") {
        warnings.push("query has no ORDER BY clause; results may vary between calls".to_string());
    }

    Ok(JqlValidationResult {
        normalised: trimmed.to_string(),
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_jql_is_rejected() {
        assert!(validate_jql("").is_err());
        assert!(validate_jql("   ").is_err());
    }

    #[test]
    fn valid_simple_jql_passes() {
        let r = validate_jql("project = MYPROJ").unwrap();
        assert_eq!(r.normalised, "project = MYPROJ");
    }

    #[test]
    fn valid_complex_jql_passes() {
        let r = validate_jql(
            "project = MYPROJ AND status = \"In Progress\" ORDER BY created DESC",
        )
        .unwrap();
        assert!(r.warnings.is_empty(), "should have no warnings with ORDER BY");
    }

    #[test]
    fn warning_emitted_without_order_by() {
        let r = validate_jql("project = FOO AND assignee = currentUser()").unwrap();
        assert!(!r.warnings.is_empty());
    }

    #[test]
    fn sql_comment_injection_rejected() {
        assert!(validate_jql("project = FOO -- drop table").is_err());
    }

    #[test]
    fn semicolon_injection_rejected() {
        assert!(validate_jql("project = FOO; DELETE FROM issues").is_err());
    }

    #[test]
    fn script_injection_rejected() {
        assert!(validate_jql("project = <script>alert(1)</script>").is_err());
    }

    #[test]
    fn unbalanced_parens_rejected() {
        assert!(validate_jql("project = FOO AND (status = Open").is_err());
        assert!(validate_jql("project = FOO AND status = Open)").is_err());
    }

    #[test]
    fn balanced_parens_pass() {
        validate_jql("project = FOO AND (status = Open OR status = \"In Progress\")")
            .unwrap();
    }

    #[test]
    fn keyword_only_query_rejected() {
        assert!(validate_jql("AND OR NOT").is_err());
    }

    #[test]
    fn jql_exceeding_max_length_rejected() {
        let long = format!("project = {}", "X".repeat(JQL_MAX_LEN));
        assert!(validate_jql(&long).is_err());
    }

    #[test]
    fn jql_at_max_length_passes() {
        // Construct a valid query that just fits
        let field = "X".repeat(JQL_MAX_LEN - "project = ".len());
        let query = format!("project = {field}");
        assert!(query.len() <= JQL_MAX_LEN);
        // It may fail the keyword-token check depending on content, but must not
        // fail the length check.
        let result = validate_jql(&query);
        match result {
            Err(AppError::Validation(msg)) => {
                assert!(!msg.contains("exceeds maximum length"), "should not be a length error");
            }
            _ => {}
        }
    }
}
