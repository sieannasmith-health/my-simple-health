import { assertAgentToolPermission } from './agent-registry.ts';
import { connectMshGitHubMcpClient } from './github-mcp-client.ts';

export type Wave2AgentId = 'aiden' | 'vera' | 'reese' | 'eden';
export interface Wave2ReviewEvidence {
  agentId: Wave2AgentId;
  artifactType: 'TRUST_EVIDENCE_REVIEW';
  artifactRef: string;
  status: 'READY';
  provenance: readonly string[];
}

function objectiveIssueNumber(objectiveId: string): number {
  const issueNumber = Number.parseInt(objectiveId, 10);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error('OBJECTIVE_ISSUE_NUMBER_REQUIRED');
  return issueNumber;
}

function jsonText(result: any): Record<string, unknown> {
  const item = result.content?.find((entry: any) => entry.type === 'text');
  if (!item || item.type !== 'text') throw new Error('MCP_TEXT_RESULT_REQUIRED');
  if (result.isError === true) throw new Error(item.text);
  return JSON.parse(item.text) as Record<string, unknown>;
}

export async function runWave2TrustEvidenceReview(objectiveId: string, agentId: Wave2AgentId, idempotencyKey: string): Promise<Wave2ReviewEvidence> {
  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const issueNumber = objectiveIssueNumber(objectiveId);
  const foundationPath = 'temporal-pilot/AGENT_INTEROPERABILITY_GATE2.md';

  if (process.env.MSH_REAL_MCP_CANARY === '1') {
    const connection = await connectMshGitHubMcpClient();
    try {
      assertAgentToolPermission(agentId, 'github_read_issue');
      const issueResult = await connection.client.callTool({ name: 'github_read_issue', arguments: { issueNumber } });
      if (jsonText(issueResult).number !== issueNumber) throw new Error('MCP_WAVE2_OBJECTIVE_MISMATCH');

      assertAgentToolPermission(agentId, 'github_read_repository_file');
      const foundationResult = await connection.client.callTool({ name: 'github_read_repository_file', arguments: { path: foundationPath, ref: 'main' } });
      if (jsonText(foundationResult).path !== foundationPath) throw new Error('MCP_WAVE2_FOUNDATION_MISMATCH');
    } finally {
      await connection.close();
    }
  }

  return {
    agentId,
    artifactType: 'TRUST_EVIDENCE_REVIEW',
    artifactRef: `trust-evidence-review:${agentId}:issue:${issueNumber}`,
    status: 'READY',
    provenance: [`issue:${issueNumber}`, `repository-file:${foundationPath}@main`],
  };
}
