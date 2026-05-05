use crate::errors::AppError;
use serde::{Deserialize, Serialize};

// ──────────────────────────────────────────────────────────────────────────────
// Cron expression validation (5-field POSIX-style, no seconds field)
//
// Validates expressions used to schedule autonomous PM scan runs.
// Format: <minute> <hour> <day-of-month> <month> <day-of-week>
//
// We do NOT use an external cron-parsing crate in Phase 1D to keep the
// dependency footprint small. A purpose-built validator is easier to audit.
// Phase 1D+ may swap in `cron` crate for full scheduling execution.
// ──────────────────────────────────────────────────────────────────────────────

/// A validated, parsed cron expression (5-field, no seconds).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CronExpression {
    /// The original normalised string.
    pub expression: String,
    /// Human-readable English description (best-effort).
    pub description: String,
}

/// Field definition used in validation loops.
struct CronField {
    name: &'static str,
    min: u32,
    max: u32,
}

const FIELDS: [CronField; 5] = [
    CronField { name: "minute",       min: 0, max: 59 },
    CronField { name: "hour",         min: 0, max: 23 },
    CronField { name: "day-of-month", min: 1, max: 31 },
    CronField { name: "month",        min: 1, max: 12 },
    CronField { name: "day-of-week",  min: 0, max:  7 }, // 0 and 7 both = Sunday
];

/// Three-letter month abbreviations accepted as aliases.
const MONTH_NAMES: &[(&str, u32)] = &[
    ("jan", 1), ("feb", 2), ("mar", 3), ("apr", 4),
    ("may", 5), ("jun", 6), ("jul", 7), ("aug", 8),
    ("sep", 9), ("oct", 10), ("nov", 11), ("dec", 12),
];

/// Three-letter day-of-week abbreviations accepted as aliases.
const DOW_NAMES: &[(&str, u32)] = &[
    ("sun", 0), ("mon", 1), ("tue", 2), ("wed", 3),
    ("thu", 4), ("fri", 5), ("sat", 6),
];

/// Resolve a string token to a numeric value given optional name tables.
fn resolve_token(token: &str, names: Option<&[(&str, u32)]>) -> Option<u32> {
    if let Ok(n) = token.parse::<u32>() {
        return Some(n);
    }
    if let Some(table) = names {
        let lower = token.to_lowercase();
        return table.iter().find(|(k, _)| *k == lower).map(|(_, v)| *v);
    }
    None
}

/// Validate a single cron field value string against [min, max].
/// Supports: `*`, `*/step`, `value`, `value/step`, `start-end`, `start-end/step`,
/// and comma-separated lists of the above.
fn validate_field(
    raw: &str,
    field: &CronField,
    names: Option<&[(&str, u32)]>,
) -> Result<(), AppError> {
    let err = |msg: String| AppError::Validation(format!("cron field '{}': {}", field.name, msg));

    for part in raw.split(',') {
        let part = part.trim();
        if part.is_empty() {
            return Err(err("empty sub-expression in list".to_string()));
        }

        // Split on '/' for step
        let (range_part, step_opt) = if let Some(idx) = part.find('/') {
            let (r, s) = part.split_at(idx);
            (r, Some(&s[1..]))
        } else {
            (part, None)
        };

        // Validate step if present
        if let Some(step_str) = step_opt {
            let step: u32 = step_str
                .parse()
                .map_err(|_| err(format!("invalid step value '{step_str}'")))?;
            if step == 0 {
                return Err(err("step value must not be zero".to_string()));
            }
        }

        // Wildcard
        if range_part == "*" {
            continue;
        }

        // Range (start-end) or single value
        if let Some(dash_pos) = range_part.find('-') {
            let start_str = &range_part[..dash_pos];
            let end_str = &range_part[dash_pos + 1..];

            let start = resolve_token(start_str, names)
                .ok_or_else(|| err(format!("unrecognised value '{start_str}'")))?;
            let end = resolve_token(end_str, names)
                .ok_or_else(|| err(format!("unrecognised value '{end_str}'")))?;

            if start < field.min || start > field.max {
                return Err(err(format!("value {start} out of range {}-{}", field.min, field.max)));
            }
            if end < field.min || end > field.max {
                return Err(err(format!("value {end} out of range {}-{}", field.min, field.max)));
            }
            if start > end {
                return Err(err(format!("range start {start} > end {end}")));
            }
        } else {
            let val = resolve_token(range_part, names)
                .ok_or_else(|| err(format!("unrecognised value '{range_part}'")))?;
            if val < field.min || val > field.max {
                return Err(err(format!("value {val} out of range {}-{}", field.min, field.max)));
            }
        }
    }

    Ok(())
}

/// Validate a 5-field cron expression string.
///
/// Returns a [`CronExpression`] on success or [`AppError::Validation`] on failure.
///
/// # Supported syntax
/// - Wildcard: `*`
/// - Step: `*/5`, `0-30/10`
/// - Range: `1-5`
/// - List: `1,3,5`
/// - Named months: `jan`–`dec`
/// - Named days: `sun`–`sat`
pub fn validate_cron(raw: &str) -> Result<CronExpression, AppError> {
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return Err(AppError::Validation("cron expression must not be empty".to_string()));
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() != 5 {
        return Err(AppError::Validation(format!(
            "cron expression must have exactly 5 fields, got {}",
            parts.len()
        )));
    }

    let name_tables: [Option<&[(&str, u32)]>; 5] = [
        None,
        None,
        None,
        Some(MONTH_NAMES),
        Some(DOW_NAMES),
    ];

    for (i, field) in FIELDS.iter().enumerate() {
        validate_field(parts[i], field, name_tables[i])?;
    }

    let description = describe_cron(parts[0], parts[1], parts[2], parts[3], parts[4]);

    Ok(CronExpression {
       expression: parts.join(" "),
        description,
    })
}

/// Produce a best-effort English description for common patterns.
fn describe_cron(min: &str, hour: &str, dom: &str, month: &str, dow: &str) -> String {
    // Common well-known patterns
    match (min, hour, dom, month, dow) {
        ("*", "*", "*", "*", "*") => return "every minute".to_string(),
        ("0", "*", "*", "*", "*") => return "every hour".to_string(),
        ("0", "0", "*", "*", "*") => return "daily at midnight".to_string(),
        ("0", "9", "*", "*", "1-5") => return "weekdays at 09:00".to_string(),
        ("0", "9", "*", "*", "1") => return "every Monday at 09:00".to_string(),
        ("0", "0", "1", "*", "*") => return "first day of every month at midnight".to_string(),
        _ => {}
    }

    // Generic fallback
    let hour_desc = if hour == "*" { "every hour".to_string() } else { format!("hour {hour}") };
    let min_desc = if min == "*" { "every minute".to_string() } else { format!("minute {min}") };
    format!("at {min_desc} of {hour_desc}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_minute_passes() {
        let r = validate_cron("* * * * *").unwrap();
        assert_eq!(r.description, "every minute");
    }

    #[test]
    fn daily_midnight_passes() {
        let r = validate_cron("0 0 * * *").unwrap();
        assert_eq!(r.description, "daily at midnight");
    }

    #[test]
    fn weekdays_9am_passes() {
        let r = validate_cron("0 9 * * 1-5").unwrap();
        assert_eq!(r.description, "weekdays at 09:00");
    }

    #[test]
    fn step_expression_passes() {
        validate_cron("*/15 * * * *").unwrap();
    }

    #[test]
    fn named_month_passes() {
        validate_cron("0 0 1 jan *").unwrap();
    }

    #[test]
    fn named_dow_passes() {
        validate_cron("0 9 * * mon").unwrap();
    }

    #[test]
    fn comma_list_passes() {
        validate_cron("0 9,17 * * *").unwrap();
    }

    #[test]
    fn empty_expression_rejected() {
        assert!(validate_cron("").is_err());
        assert!(validate_cron("   ").is_err());
    }

    #[test]
    fn wrong_field_count_rejected() {
        assert!(validate_cron("* * * *").is_err());      // 4 fields
        assert!(validate_cron("* * * * * *").is_err());  // 6 fields (seconds not supported)
    }

    #[test]
    fn minute_out_of_range_rejected() {
        assert!(validate_cron("60 * * * *").is_err());
    }

    #[test]
    fn hour_out_of_range_rejected() {
        assert!(validate_cron("0 24 * * *").is_err());
    }

    #[test]
    fn zero_step_rejected() {
        assert!(validate_cron("*/0 * * * *").is_err());
    }

    #[test]
    fn range_start_gt_end_rejected() {
        assert!(validate_cron("0 9-5 * * *").is_err());
    }

    #[test]
    fn invalid_month_name_rejected() {
        assert!(validate_cron("0 0 1 xyz *").is_err());
    }

    #[test]
    fn expression_is_normalised_on_success() {
        let r = validate_cron("  0  0  *  *  *  ").unwrap();
        assert_eq!(r.expression, "0 0 * * *");
    }
}
