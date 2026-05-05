use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::time::Instant;

use crate::errors::AppError;
use crate::sync_utils::lock_or_internal;

// ──────────────────────────────────────────────────────────────────────────────
// Token bucket
// ──────────────────────────────────────────────────────────────────────────────

struct TokenBucket {
    /// Maximum tokens the bucket can hold (= burst capacity).
    capacity: f64,
    /// Current token count.
    tokens: f64,
    /// Tokens added per second.
    refill_rate: f64,
    /// Monotonic timestamp of the last refill.
    last_refill: Instant,
}

impl TokenBucket {
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: capacity,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    /// Refill the bucket proportionally to elapsed time, then try to consume
    /// one token.  Returns `true` if the token was available.
    fn try_consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.last_refill = now;

        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-command policy table
// ──────────────────────────────────────────────────────────────────────────────

struct Policy {
    /// Burst capacity (maximum simultaneous tokens).
    burst: f64,
    /// Sustained rate in calls per minute.
    per_minute: f64,
}

impl Policy {
    const fn new(burst: u32, per_minute: u32) -> Self {
        Self {
            burst: burst as f64,
            per_minute: per_minute as f64,
        }
    }
}

// Rate-limited commands.  Commands not listed here pass through unchecked.
static POLICIES: &[(&str, Policy)] = &[
    ("cmd_invoke_llm", Policy::new(5, 10)),
    ("cmd_initialize_index_store", Policy::new(1, 3)),
    ("cmd_check_index_store_health", Policy::new(5, 20)),
];

// ──────────────────────────────────────────────────────────────────────────────
// RateLimiter
// ──────────────────────────────────────────────────────────────────────────────

/// In-process token-bucket rate limiter.
///
/// One `Mutex<TokenBucket>` is maintained per rate-limited command.
/// Commands with no entry in `POLICIES` pass through immediately.
pub struct RateLimiter {
    buckets: HashMap<&'static str, Mutex<TokenBucket>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        let buckets = POLICIES
            .iter()
            .map(|(cmd, policy)| {
                let bucket = TokenBucket::new(policy.burst, policy.per_minute / 60.0);
                (*cmd, Mutex::new(bucket))
            })
            .collect();

        Self { buckets }
    }

    /// Check whether `command` is within its rate limit.
    ///
    /// Returns `Ok(())` if allowed, or `Err(AppError::RateLimitExceeded)` if
    /// the bucket is empty.  Commands with no policy always return `Ok(())`.
    pub fn check(&self, command: &'static str) -> Result<(), AppError> {
        let Some(bucket_lock) = self.buckets.get(command) else {
            return Ok(());
        };

        let allowed = lock_or_internal(bucket_lock, "rate_limiter")?.try_consume();

        if allowed {
            Ok(())
        } else {
            Err(AppError::RateLimitExceeded(format!(
                "command '{command}' has exceeded its allowed call rate"
            )))
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Single-flight guard for index initialization
// ──────────────────────────────────────────────────────────────────────────────

/// Lightweight single-flight guard backed by an `AtomicBool`.
///
/// Prevents concurrent index initialization attempts from racing.
/// Call [`SingleFlight::try_acquire`] at the start of an init; release
/// with [`SingleFlight::release`] (or rely on the guard's `Drop` impl).
pub struct SingleFlight {
    in_flight: AtomicBool,
}

impl std::fmt::Debug for SingleFlight {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SingleFlight")
            .field("in_flight", &self.in_flight.load(Ordering::SeqCst))
            .finish()
    }
}

impl SingleFlight {
    pub const fn new() -> Self {
        Self {
            in_flight: AtomicBool::new(false),
        }
    }

    /// Returns a [`SingleFlightGuard`] if no call is in flight, or
    /// `Err(AppError::Validation)` if one is already running.
    pub fn try_acquire(&self) -> Result<SingleFlightGuard<'_>, AppError> {
        let was_free = self
            .in_flight
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok();

        if was_free {
            Ok(SingleFlightGuard { guard: self })
        } else {
            Err(AppError::Validation(
                "index initialization is already in progress".to_string(),
            ))
        }
    }
}

/// RAII guard: releases the single-flight lock when dropped.
#[derive(Debug)]
pub struct SingleFlightGuard<'a> {
    guard: &'a SingleFlight,
}

impl Drop for SingleFlightGuard<'_> {
    fn drop(&mut self) {
        self.guard.in_flight.store(false, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_bucket_allows_burst_then_denies() {
        let mut bucket = TokenBucket::new(3.0, 60.0);

        // Should allow burst of 3
        assert!(bucket.try_consume());
        assert!(bucket.try_consume());
        assert!(bucket.try_consume());

        // Fourth call must be denied
        assert!(!bucket.try_consume());
    }

    #[test]
    fn rate_limiter_denies_after_burst() {
        let limiter = RateLimiter::new();

        // cmd_invoke_llm has burst=5; consume all 5
        for _ in 0..5 {
            assert!(limiter.check("cmd_invoke_llm").is_ok());
        }
        assert!(limiter.check("cmd_invoke_llm").is_err());
    }

    #[test]
    fn rate_limiter_passes_unlisted_commands() {
        let limiter = RateLimiter::new();

        for _ in 0..100 {
            assert!(limiter.check("cmd_get_session_status").is_ok());
        }
    }

    #[test]
    fn single_flight_prevents_concurrent_init() {
        let sf = SingleFlight::new();

        let _guard = sf.try_acquire().expect("first acquire should succeed");
        let err = sf.try_acquire().expect_err("second acquire must fail");
        assert!(err.to_string().contains("already in progress"));
    }

    #[test]
    fn single_flight_releases_on_drop() {
        let sf = SingleFlight::new();

        {
            let _g = sf.try_acquire().unwrap();
        }

        // After guard drop, a new acquire must succeed.
        let _ = sf.try_acquire().expect("re-acquire after drop should succeed");
    }
}
