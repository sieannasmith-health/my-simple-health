import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMshGitHubMcpServer } from '../src/github-mcp-server.ts';

const statePath = process.env.MSH_MCP_RECOVERY_STATE_FILE;
if (!statePath) throw new Error('MSH_MCP_RECOVERY_STATE_FILE_REQUIRED');

function emptyState() {
  return {
    branches: [],
    files: {},
    pullRequests: [],
    counters: { branchCreates: 0, filePuts: 0, prPosts: 0 },
  };
}

function loadState() {
  if (!existsSync(statePath)) return emptyState();
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function jsonResponse(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function fakeGitHubFetch(input, init = {}) {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  const state = loadState();
  const path = url.pathname;

  const issueMatch = path.match(/\/issues\/(\d+)$/);
  if (method === 'GET' && issueMatch) {
    const number = Number(issueMatch[1]);
    return jsonResponse(200, { number, title: 'Recovery proof objective', body: 'Persisted fake GitHub backend for #203 recovery proof.' });
  }

  const refMatch = path.match(/\/git\/ref\/heads\/(.+)$/);
  if (method === 'GET' && refMatch) {
    const branch = decodeURIComponent(refMatch[1]);
    if (branch === 'main' || state.branches.includes(branch)) {
      return jsonResponse(200, { ref: `refs/heads/${branch}`, object: { sha: `sha-${branch}` } });
    }
    return jsonResponse(404, { message: 'Not Found' });
  }

  if (method === 'POST' && path.endsWith('/git/refs')) {
    const body = JSON.parse(String(init.body ?? '{}'));
    const branch = String(body.ref).replace(/^refs\/heads\//, '');
    if (!state.branches.includes(branch)) {
      state.branches.push(branch);
      state.counters.branchCreates += 1;
      saveState(state);
    }
    return jsonResponse(201, { ref: `refs/heads/${branch}`, object: { sha: body.sha } });
  }

  const contentsIndex = path.indexOf('/contents/');
  if (contentsIndex >= 0) {
    const repoPath = path.slice(contentsIndex + '/contents/'.length).split('/').map(decodeURIComponent).join('/');
    const branch = url.searchParams.get('ref') ?? JSON.parse(String(init.body ?? '{}')).branch;
    const key = `${branch}:${repoPath}`;

    if (method === 'GET') {
      const existing = state.files[key];
      return existing ? jsonResponse(200, { sha: existing.sha }) : jsonResponse(404, { message: 'Not Found' });
    }

    if (method === 'PUT') {
      const body = JSON.parse(String(init.body ?? '{}'));
      const sha = state.files[key]?.sha ?? `file-sha-${Object.keys(state.files).length + 1}`;
      state.files[key] = { sha, content: body.content };
      state.counters.filePuts += 1;
      saveState(state);
      return jsonResponse(state.counters.filePuts === 1 ? 201 : 200, { content: { sha } });
    }
  }

  if (method === 'GET' && path.endsWith('/pulls')) {
    const headParam = url.searchParams.get('head') ?? '';
    const head = headParam.includes(':') ? headParam.slice(headParam.indexOf(':') + 1) : headParam;
    const base = url.searchParams.get('base') ?? '';
    const matches = state.pullRequests
      .filter((pr) => pr.head === head && pr.base === base)
      .map((pr) => ({ number: pr.number, head: { ref: pr.head }, base: { ref: pr.base } }));
    return jsonResponse(200, matches);
  }

  if (method === 'POST' && path.endsWith('/pulls')) {
    const body = JSON.parse(String(init.body ?? '{}'));
    const number = 900 + state.pullRequests.length;
    state.pullRequests.push({ number, head: body.head, base: body.base });
    state.counters.prPosts += 1;
    saveState(state);
    return jsonResponse(201, { number });
  }

  if (method === 'GET' && path.includes('/check-runs')) {
    return jsonResponse(200, {
      check_runs: [{ name: 'temporal-pilot', status: 'completed', conclusion: 'success' }],
    });
  }

  return jsonResponse(500, { message: `UNHANDLED_FAKE_GITHUB_REQUEST:${method}:${path}` });
}

void serveStdio(() => createMshGitHubMcpServer({
  repository: process.env.GITHUB_REPOSITORY,
  token: process.env.GITHUB_TOKEN,
  fetchImpl: fakeGitHubFetch,
  testMode: false,
}));
