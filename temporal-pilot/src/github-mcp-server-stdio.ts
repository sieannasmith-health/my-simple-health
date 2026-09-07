import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMshGitHubMcpServer } from './github-mcp-server.js';

void serveStdio(() => createMshGitHubMcpServer());
