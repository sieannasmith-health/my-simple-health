import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export interface MshGitHubMcpClient {
  client: Client;
  close(): Promise<void>;
}

export async function connectMshGitHubMcpClient(options: {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
} = {}): Promise<MshGitHubMcpClient> {
  const client = new Client(
    { name: 'msh-temporal-pilot', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );

  const transport = new StdioClientTransport({
    command: options.command ?? process.execPath,
    args: options.args ?? ['src/github-mcp-server-stdio.ts'],
    env: { ...process.env, ...options.env },
  });

  await client.connect(transport);

  return {
    client,
    async close() {
      await client.close();
    },
  };
}
