import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export interface MshGitHubMcpClient {
  client: Client;
  close(): Promise<void>;
}

function stringEnv(env: NodeJS.ProcessEnv, overrides?: Record<string, string>): Record<string, string> {
  const base = Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  return { ...base, ...overrides };
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
    env: stringEnv(process.env, options.env),
  });

  await client.connect(transport);

  return {
    client,
    async close() {
      await client.close();
    },
  };
}
