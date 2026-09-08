import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMshGitHubMcpServer } from './github-mcp-server.ts';

void serveStdio(() => createMshGitHubMcpServer());
