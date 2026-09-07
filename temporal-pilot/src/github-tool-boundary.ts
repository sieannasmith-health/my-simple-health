export interface GitHubToolBoundary {
  readIssue(issueNumber: number): Promise<{ number: number; title: string; body: string | null }>;
  readRepositoryFile(path: string, ref: string): Promise<{ path: string; content: string }>;
  createBranch(branch: string, fromRef: string, idempotencyKey: string): Promise<{ branch: string }>;
  writeRepositoryFile(input: {
    path: string;
    branch: string;
    content: string;
    message: string;
    idempotencyKey: string;
  }): Promise<{ path: string; commitSha: string }>;
  openPullRequest(input: {
    head: string;
    base: string;
    title: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ number: number; url: string }>;
  readChecks(ref: string): Promise<{ conclusion: 'success' | 'failure' | 'pending' }>;
}

/**
 * #203 pilot contract only. The Temporal workflow may request these operations,
 * but credentials and GitHub authorization remain outside workflow state.
 *
 * Deliberately excluded from the pilot boundary:
 * - repository administration
 * - secrets/variables administration
 * - branch protection/ruleset changes
 * - workflow approval
 * - merge
 * - destructive repository operations
 *
 * Side-effecting operations require a stable idempotency key so an Activity
 * retry cannot silently create duplicate branches, commits, or pull requests.
 */
export const GITHUB_TOOL_BOUNDARY_VERSION = 1 as const;
