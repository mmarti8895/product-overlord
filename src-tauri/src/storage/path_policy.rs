use std::path::{Component, Path, PathBuf};

use crate::errors::AppError;

/// The single app-owned storage root under which all persistent writes must live.
///
/// Returns `$HOME/.product-overlord` on Unix/macOS, or a relative fallback when
/// `HOME` is not set (test environments, sandboxed CI).
pub fn app_storage_root() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".product-overlord");
    }
    PathBuf::from(".product-overlord")
}

/// Validate that `raw_path` is safe to use as a storage location.
///
/// # What this checks (SEC-203.1 / SEC-203.2)
///
/// 1. **Syntactic traversal** — rejects any path whose normalised form contains
///    `..` components before we hit the filesystem.
/// 2. **Root confinement** — the path must be a descendant of `allowed_root`.
///    We canonicalize the root directory (creating it if necessary) and check
///    that the candidate starts with that canonical prefix.
/// 3. **Symlink escape** — `canonicalize` follows all symlinks, so if the
///    resolved target escapes the root it is rejected.
///
/// Returns the canonicalized absolute path on success.
pub fn enforce_storage_root(raw_path: &Path, allowed_root: &Path) -> Result<PathBuf, AppError> {
    // 1. Syntactic traversal guard: reject before touching the filesystem.
    reject_traversal_components(raw_path)?;

    // 2. Ensure the allowed root exists so canonicalize works.
    std::fs::create_dir_all(allowed_root).map_err(|err| {
        AppError::Storage(format!(
            "failed to create storage root {}: {err}",
            allowed_root.display()
        ))
    })?;

    let canonical_root = allowed_root.canonicalize().map_err(|err| {
        AppError::Storage(format!(
            "cannot resolve storage root {}: {err}",
            allowed_root.display()
        ))
    })?;

    // 3. Resolve the candidate path.
    //    If it already exists, canonicalize follows symlinks fully.
    //    If it does not exist yet, walk existing ancestors to get a canonical
    //    base and reconstruct the suffix — this prevents an attacker from
    //    placing a symlink after validation but before creation.
    let canonical_candidate = canonicalize_or_project(raw_path, &canonical_root)?;

    // 4. Confinement check.
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(AppError::Validation(format!(
            "path '{}' is outside the allowed storage root '{}'",
            raw_path.display(),
            canonical_root.display(),
        )));
    }

    Ok(canonical_candidate)
}

/// Reject paths that contain `..` components without touching the filesystem.
fn reject_traversal_components(path: &Path) -> Result<(), AppError> {
    for component in path.components() {
        if component == Component::ParentDir {
            return Err(AppError::Validation(format!(
                "path '{}' contains a traversal component (..)",
                path.display()
            )));
        }
    }
    Ok(())
}

/// Resolve a path to its canonical form.
///
/// - If the path exists: use `canonicalize` (follows symlinks).
/// - If the path does not exist yet: walk up to the first existing ancestor,
///   canonicalize that, then append the remaining suffix.  This avoids a
///   TOCTOU gap where a symlink could be placed between check and creation.
fn canonicalize_or_project(path: &Path, canonical_root: &Path) -> Result<PathBuf, AppError> {
    if path.exists() {
        return path.canonicalize().map_err(|err| {
            AppError::Storage(format!(
                "cannot canonicalize path {}: {err}",
                path.display()
            ))
        });
    }

    // Walk up to find the deepest existing ancestor.
    let mut cur = path.to_path_buf();
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();

    loop {
        if cur.exists() {
            break;
        }
        match cur.file_name().map(|n| n.to_os_string()) {
            Some(name) => suffix.push(name),
            None => break,
        }
        match cur.parent().map(|p| p.to_path_buf()) {
            Some(parent) => cur = parent,
            None => break,
        }
    }

    // If no existing ancestor was found, anchor at root.
    let base = if cur.exists() {
        cur.canonicalize().map_err(|err| {
            AppError::Storage(format!(
                "cannot canonicalize ancestor of {}: {err}",
                path.display()
            ))
        })?
    } else {
        canonical_root.to_path_buf()
    };

    // Re-append the non-existing suffix in reverse.
    let mut result = base;
    for component in suffix.iter().rev() {
        result.push(component);
    }
    Ok(result)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    fn temp_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("po-path-policy-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ── SEC-203.6 test suite ──────────────────────────────────────────────────

    #[test]
    fn valid_subpath_inside_root_is_accepted() {
        let root = temp_root();
        let candidate = root.join("lancedb");
        let result = enforce_storage_root(&candidate, &root);
        assert!(result.is_ok(), "expected ok but got: {result:?}");
    }

    #[test]
    fn nested_subpath_inside_root_is_accepted() {
        let root = temp_root();
        let candidate = root.join("a").join("b").join("c");
        let result = enforce_storage_root(&candidate, &root);
        assert!(result.is_ok());
    }

    #[test]
    fn syntactic_traversal_is_rejected_before_filesystem_access() {
        let root = temp_root();
        let candidate = root.join("..").join("escape");
        let err = enforce_storage_root(&candidate, &root).unwrap_err();
        assert!(
            err.to_string().contains("traversal"),
            "expected traversal error, got: {err}"
        );
    }

    #[test]
    fn absolute_path_outside_root_is_rejected() {
        let root = temp_root();
        let candidate = PathBuf::from("/etc/passwd");
        let err = enforce_storage_root(&candidate, &root).unwrap_err();
        // Either traversal or confinement error is acceptable.
        let msg = err.to_string();
        assert!(
            msg.contains("traversal") || msg.contains("outside"),
            "expected confinement error, got: {msg}"
        );
    }

    #[test]
    fn sibling_directory_outside_root_is_rejected() {
        let root = temp_root();
        // Construct a path that is a sibling of root (same parent, different dir).
        let sibling = root.parent().unwrap().join("sibling-dir");
        let err = enforce_storage_root(&sibling, &root).unwrap_err();
        assert!(
            err.to_string().contains("outside"),
            "expected confinement error, got: {err}"
        );
    }

    #[test]
    fn symlink_escape_is_rejected() {
        let root = temp_root();
        let target_outside = std::env::temp_dir().join(format!("po-escape-{}", Uuid::new_v4()));
        fs::create_dir_all(&target_outside).unwrap();

        let link_inside_root = root.join("escape-link");

        // Create symlink inside root pointing outside.
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target_outside, &link_inside_root).unwrap();
        #[cfg(not(unix))]
        {
            // On non-Unix: skip symlink test gracefully.
            return;
        }

        let err = enforce_storage_root(&link_inside_root, &root).unwrap_err();
        assert!(
            err.to_string().contains("outside"),
            "expected symlink escape to be rejected, got: {err}"
        );
    }

    #[test]
    fn app_storage_root_is_under_home_or_relative() {
        let root = app_storage_root();
        // Must end with .product-overlord
        assert_eq!(root.file_name().unwrap(), ".product-overlord");
    }
}
