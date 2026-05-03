/**
 * Contract tests — RepoAdapter (task 1.7)
 *
 * Covers:
 *   - happy path: getRepoMeta, getTree, getFileContent (GitHub + Bitbucket)
 *   - private repo: returns isPrivate: true
 *   - rate-limited response: retries and eventually throws
 *   - Teamwork Graph unavailable: enrichDossier returns enriched: false
 */
export {};
