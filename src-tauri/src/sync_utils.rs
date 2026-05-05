use std::sync::{Mutex, MutexGuard};

use crate::errors::AppError;

/// Acquire a mutex lock, converting lock-poison into `AppError::Internal`.
///
/// # SEC-206.1 — Poisoned-lock resilience
///
/// Rust panics inside a mutex critical section leave the mutex in a "poisoned"
/// state.  Calling `.unwrap()` on a subsequent `.lock()` then propagates the
/// panic, crashing the Tauri command thread and potentially the entire process.
///
/// This helper converts poison into a controlled `AppError::Internal` so that
/// the command can return a typed error to the frontend instead of panicking.
///
/// ## Usage
///
/// ```rust
/// let guard = lock_or_internal(&state.session_manager, "session_manager")?;
/// ```
///
/// ## When to use
///
/// Apply to every `Mutex::lock()` call that lives in a **command handler** or
/// in code called from a command handler.  Lock acquisitions in test setup
/// (`#[cfg(test)]`) may still use `.unwrap()`.
pub fn lock_or_internal<'a, T>(
    mutex: &'a Mutex<T>,
    component: &'static str,
) -> Result<MutexGuard<'a, T>, AppError> {
    mutex.lock().map_err(|_| {
        AppError::Internal(anyhow::anyhow!(
            "{component} mutex is poisoned — a previous panic left it in an invalid state"
        ))
    })
}
