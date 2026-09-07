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
        return {
          content: [{ type: 'text', text: JSON.stringify({ branch, created: true, idempotencyKey }) }],
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

  return server;
}
