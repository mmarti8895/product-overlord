use crate::errors::AppError;
use serde::{Deserialize, Serialize};

// ──────────────────────────────────────────────────────────────────────────────
// Base URL validation
//
// Used to validate optional base_url overrides on IntegrationCredential
// (e.g. self-hosted Jira / Ollama endpoints).
//
// Rules are intentionally conservative — we accept only https:// (and http://
// for localhost/127.0.0.1/::1 during development) to prevent SSRF via
// arbitrary URL schemes.
// ──────────────────────────────────────────────────────────────────────────────

const URL_MAX_LEN: usize = 512;

/// Hosts that are permitted to use plain HTTP (local development only).
const ALLOWED_HTTP_HOSTS: &[&str] = &["localhost", "127.0.0.1", "::1", "[::1]"];

/// Result of a URL validation pass.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UrlValidationResult {
    /// Normalised URL (trailing slash stripped from path root).
    pub normalised: String,
}

/// Validate a base URL intended for use as an integration endpoint.
///
/// # Rules
/// 1. Must not be empty.
/// 2. Must not exceed `URL_MAX_LEN` characters.
/// 3. Must use `https://` scheme, OR `http://` only for local hosts.
/// 4. Must have a non-empty host component.
/// 5. Must not contain `@` in the authority (no embedded credentials).
/// 6. Must not contain path traversal sequences (`..`).
pub fn validate_base_url(raw: &str) -> Result<UrlValidationResult, AppError> {
    let trimmed = raw.trim();

    // Rule 1 — non-empty
    if trimmed.is_empty() {
        return Err(AppError::Validation("URL must not be empty".to_string()));
    }

    // Rule 2 — length cap
    if trimmed.len() > URL_MAX_LEN {
        return Err(AppError::Validation(format!(
            "URL exceeds maximum length of {URL_MAX_LEN} characters"
        )));
    }

    // Rule 3 — scheme check
    let lower = trimmed.to_lowercase();
    let (scheme, rest) = if let Some(r) = lower.strip_prefix("https://") {
        ("https", r)
    } else if let Some(r) = lower.strip_prefix("http://") {
        ("http", r)
    } else {
        return Err(AppError::Validation(
            "URL must use https:// scheme (http:// allowed only for localhost)".to_string(),
        ));
    };

    // Rule 4 — extract host (everything up to first '/' or end of string)
    let host = rest.split('/').next().unwrap_or("").split(':').next().unwrap_or("");

    if host.is_empty() {
        return Err(AppError::Validation("URL must have a non-empty host".to_string()));
    }

    // Rule 3b — http only allowed for local hosts
    if scheme == "http" && !ALLOWED_HTTP_HOSTS.contains(&host) {
        return Err(AppError::Validation(format!(
            "http:// is only allowed for local development hosts (got '{host}')"
        )));
    }

    // Rule 5 — no embedded credentials
    if trimmed.contains('@') {
        return Err(AppError::Validation(
            "URL must not contain embedded credentials (found '@')".to_string(),
        ));
    }

    // Rule 6 — no path traversal
    if trimmed.contains("..") {
        return Err(AppError::Validation(
            "URL must not contain path traversal sequences ('..')".to_string(),
        ));
    }

    // Normalise: strip trailing slash from bare root, preserve sub-paths
    let normalised = trimmed.trim_end_matches('/').to_string();

    Ok(UrlValidationResult { normalised })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── valid cases ──────────────────────────────────────────────────────────

    #[test]
    fn https_url_passes() {
        let r = validate_base_url("https://jira.example.com").unwrap();
        assert_eq!(r.normalised, "https://jira.example.com");
    }

    #[test]
    fn https_with_port_passes() {
        validate_base_url("https://jira.example.com:8080").unwrap();
    }

    #[test]
    fn https_with_path_passes() {
        validate_base_url("https://jira.example.com/jira").unwrap();
    }

    #[test]
    fn trailing_slash_is_stripped() {
        let r = validate_base_url("https://jira.example.com/").unwrap();
        assert_eq!(r.normalised, "https://jira.example.com");
    }

    #[test]
    fn http_localhost_passes() {
        validate_base_url("http://localhost:11434").unwrap();
    }

    #[test]
    fn http_127_passes() {
        validate_base_url("http://127.0.0.1:11434").unwrap();
    }

    // ── rejection cases ──────────────────────────────────────────────────────

    #[test]
    fn empty_url_rejected() {
        assert!(validate_base_url("").is_err());
        assert!(validate_base_url("  ").is_err());
    }

    #[test]
    fn http_non_local_rejected() {
        let err = validate_base_url("http://jira.example.com").unwrap_err();
        assert!(err.to_string().contains("http://"));
    }

    #[test]
    fn ftp_scheme_rejected() {
        assert!(validate_base_url("ftp://example.com").is_err());
    }

    #[test]
    fn no_scheme_rejected() {
        assert!(validate_base_url("jira.example.com").is_err());
    }

    #[test]
    fn embedded_credentials_rejected() {
        assert!(validate_base_url("https://user:pass@jira.example.com").is_err());
    }

    #[test]
    fn path_traversal_rejected() {
        assert!(validate_base_url("https://jira.example.com/../admin").is_err());
    }

    #[test]
    fn empty_host_rejected() {
        assert!(validate_base_url("https://").is_err());
    }

    #[test]
    fn url_exceeding_max_length_rejected() {
        let long = format!("https://example.com/{}", "x".repeat(URL_MAX_LEN));
        assert!(validate_base_url(&long).is_err());
    }
}
