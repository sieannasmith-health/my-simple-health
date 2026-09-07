import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

export interface GitHubMcpServerOptions {
  repository?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  testMode?: boolean;
}

function requireRepository(repository?: string): string {
  if (!repository || !repository.includes('/')) {
    throw new Error('GITHUB_REPOSITORY_REQUIRED');
  }
  return repository;
}

function headers(token?: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

export function createMshGitHubMcpServer(options: GitHubMcpServerOptions = {}): McpServer {
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const fetchImpl = options.fetchImpl ?? fetch;
  const testMode = options.testMode ?? process.env.MSH_MCP_TEST_MODE === '1';
  const testBranches = new Set<string>();
  const testFiles = new Map<string, { content: string; sha: string }>();
  const testPullRequests = new Map<string, { number: number; head: string; base: string }>();

  const server = new McpServer({ name: 'msh-github-boundary', version: '1.0.0' });

  server.registerTool(
    'github_read_issue',
    {
      description: 'Read one GitHub issue from the configured MSH repository.',
      inputSchema: z.object({ issueNumber: z.number().int().positive() }),
    },
    async ({ issueNumber }) => {
      if (testMode) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ number: issueNumber, title: 'test issue', body: 'test body' }) }],
        };
      }

      const repo = requireRepository(repository);
      const result = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
        { method: 'GET', headers: headers(token) },
      );
      if (result.status !== 200) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_READ_ISSUE_FAILED:${result.status}` }] };
      }
      const issue = result.body as { number: number; title: string; body: string | null };
      return {
        content: [{ type: 'text', text: JSON.stringify({ number: issue.number, title: issue.title, body: issue.body }) }],
      };
    },
  );

  server.registerTool(
    'github_read_checks',
    {
      description: 'Read GitHub check runs for one approved commit ref and return a strict aggregate conclusion for QA.',
      inputSchema: z.object({ ref: z.string().min(1) }),
    },
    async ({ ref }) => {
      if (testMode) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ ref, conclusion: 'success', checks: [{ name: 'temporal-pilot', status: 'completed', conclusion: 'success' }] }) }],
        };
      }

      const repo = requireRepository(repository);
      const result = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}/check-runs`,
        { method: 'GET', headers: headers(token) },
      );
      if (result.status !== 200) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_READ_CHECKS_FAILED:${result.status}` }] };
      }

      const body = result.body as {
        check_runs?: Array<{ name: string; status: string; conclusion: string | null }>;
      };
      const checks = body.check_runs ?? [];
      const conclusion = checks.length === 0 || checks.some((check) => check.status !== 'completed' || check.conclusion === null)
        ? 'pending'
        : checks.every((check) => check.conclusion === 'success')
          ? 'success'
          : 'failure';

      return {
        content: [{ type: 'text', text: JSON.stringify({ ref, conclusion, checks }) }],
      };
    },
  );

  server.registerTool(
    'github_create_branch',
    {
      description: 'Create one branch from an existing ref. Repeated calls are idempotent by branch name.',
      inputSchema: z.object({
        branch: z.string().min(1),
        fromRef: z.string().min(1),
        idempotencyKey: z.string().min(1),
      }),
    },
    async ({ branch, fromRef, idempotencyKey }) => {
      if (testMode) {
        const created = !testBranches.has(branch);
        testBranches.add(branch);
        return {
          content: [{ type: 'text', text: JSON.stringify({ branch, created, idempotencyKey }) }],
        };
      }

      const repo = requireRepository(repository);
      const existing = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
        { method: 'GET', headers: headers(token) },
      );
      if (existing.status === 200) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ branch, created: false, idempotencyKey }) }],
        };
      }
      if (existing.status !== 404) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_BRANCH_LOOKUP_FAILED:${existing.status}` }] };
      }

      const source = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(fromRef)}`,
        { method: 'GET', headers: headers(token) },
      );
      if (source.status !== 200) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_SOURCE_REF_FAILED:${source.status}` }] };
      }
      const sourceBody = source.body as { object: { sha: string } };

      const created = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/git/refs`,
        {
          method: 'POST',
          headers: { ...headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: sourceBody.object.sha }),
        },
      );
      if (created.status !== 201) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_CREATE_BRANCH_FAILED:${created.status}` }] };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ branch, created: true, idempotencyKey }) }],
      };
    },
  );

  server.registerTool(
    'github_write_repository_file',
    {
      description: 'Create or replace one UTF-8 repository file on an approved branch using a stable idempotency key.',
      inputSchema: z.object({
        branch: z.string().min(1),
        path: z.string().min(1),
        content: z.string(),
        message: z.string().min(1),
        idempotencyKey: z.string().min(1),
      }),
    },
    async ({ branch, path, content, message, idempotencyKey }) => {
      if (testMode) {
        const key = `${branch}:${path}`;
        const existing = testFiles.get(key);
        const sha = existing?.sha ?? `test-sha-${testFiles.size + 1}`;
        const changed = existing?.content !== content;
        testFiles.set(key, { content, sha });
        return {
          content: [{ type: 'text', text: JSON.stringify({ branch, path, sha, changed, idempotencyKey }) }],
        };
      }

      const repo = requireRepository(repository);
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const existing = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
        { method: 'GET', headers: headers(token) },
      );
      if (existing.status !== 200 && existing.status !== 404) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_FILE_LOOKUP_FAILED:${existing.status}` }] };
      }

      const existingBody = existing.status === 200 ? existing.body as { sha: string } : null;
      const written = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/contents/${encodedPath}`,
        {
          method: 'PUT',
          headers: { ...headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf8').toString('base64'),
            branch,
            ...(existingBody ? { sha: existingBody.sha } : {}),
          }),
        },
      );
      if (written.status !== 200 && written.status !== 201) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_WRITE_FILE_FAILED:${written.status}` }] };
      }
      const writtenBody = written.body as { content?: { sha?: string } };
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            branch,
            path,
            sha: writtenBody.content?.sha ?? null,
            changed: true,
            idempotencyKey,
          }),
        }],
      };
    },
  );

  server.registerTool(
    'github_open_pull_request',
    {
      description: 'Open one pull request for an approved branch. Repeated calls reuse an existing open pull request for the same head/base.',
      inputSchema: z.object({
        head: z.string().min(1),
        base: z.string().min(1),
        title: z.string().min(1),
        body: z.string(),
        idempotencyKey: z.string().min(1),
      }),
    },
    async ({ head, base, title, body, idempotencyKey }) => {
      const key = `${head}:${base}`;
      if (testMode) {
        const existing = testPullRequests.get(key);
        if (existing) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ ...existing, created: false, idempotencyKey }) }],
          };
        }
        const created = { number: testPullRequests.size + 900, head, base };
        testPullRequests.set(key, created);
        return {
          content: [{ type: 'text', text: JSON.stringify({ ...created, created: true, idempotencyKey }) }],
        };
      }

      const repo = requireRepository(repository);
      const [owner] = repo.split('/');
      const existing = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`,
        { method: 'GET', headers: headers(token) },
      );
      if (existing.status !== 200) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_PR_LOOKUP_FAILED:${existing.status}` }] };
      }
      const existingPulls = existing.body as Array<{ number: number; head: { ref: string }; base: { ref: string } }>;
      if (existingPulls.length > 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ number: existingPulls[0].number, head, base, created: false, idempotencyKey }),
          }],
        };
      }

      const created = await githubJson(
        fetchImpl,
        `https://api.github.com/repos/${repo}/pulls`,
        {
          method: 'POST',
          headers: { ...headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, head, base }),
        },
      );
      if (created.status !== 201) {
        return { isError: true, content: [{ type: 'text', text: `GITHUB_OPEN_PR_FAILED:${created.status}` }] };
      }
      const createdBody = created.body as { number: number };
      return {
        content: [{ type: 'text', text: JSON.stringify({ number: createdBody.number, head, base, created: true, idempotencyKey }) }],
      };
    },
  );

  return server;
}
