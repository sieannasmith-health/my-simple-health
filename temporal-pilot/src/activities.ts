import { connectMshGitHubMcpClient } from './github-mcp-client.js';

export interface StageEvidence {
  stage: 'NOMY' | 'SELAH' | 'TESSA' | 'NOMY_ACCEPTANCE';
  artifactType: 'PRODUCT_OBJECTIVE' | 'PULL_REQUEST' | 'QA_RESULT' | 'PRODUCT_ACCEPTANCE';
  artifactRef: string;
  status: 'READY' | 'PASS' | 'ACCEPTED';
}

function jsonText(result: Awaited<ReturnType<Awaited<ReturnType<typeof connectMshGitHubMcpClient>>['client']['callTool']>>): Record<string, unknown> {
  const item = result.content?.find((entry) => entry.type === 'text');
  if (!item || item.type !== 'text') {
    throw new Error('MCP_TEXT_RESULT_REQUIRED');
  }
  if (result.isError === true) {
    throw new Error(item.text);
  }
  return JSON.parse(item.text) as Record<string, unknown>;
}

function objectiveIssueNumber(objectiveId: string): number {
  const issueNumber = Number.parseInt(objectiveId, 10);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error('OBJECTIVE_ISSUE_NUMBER_REQUIRED');
  }
  return issueNumber;
}

export async function recordStage(
  objectiveId: string,
  stage: string,
  idempotencyKey: string,
): Promise<string> {
  if (!idempotencyKey) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }

  // Temporal may retry Activities. Durable external side effects must use this
  // stable key against a durable store or an external API's idempotency support.
  void objectiveId;
  return stage;
}

export async function runAgentStage(
  objectiveId: string,
  stage: StageEvidence['stage'],
  priorEvidence: StageEvidence[],
  idempotencyKey: string,
): Promise<StageEvidence> {
  if (!idempotencyKey) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }

  if (process.env.MSH_REAL_MCP_CANARY === '1') {
    const connection = await connectMshGitHubMcpClient();
    try {
      const issueNumber = objectiveIssueNumber(objectiveId);
      const branch = `msh-autonomy-canary-${objectiveId}`;

      switch (stage) {
        case 'NOMY': {
          const result = await connection.client.callTool({
            name: 'github_read_issue',
            arguments: { issueNumber },
          });
          const issue = jsonText(result);
          if (issue.number !== issueNumber) {
            throw new Error('MCP_OBJECTIVE_MISMATCH');
          }
          return {
            stage,
            artifactType: 'PRODUCT_OBJECTIVE',
            artifactRef: `issue:${issueNumber}`,
            status: 'READY',
          };
        }
        case 'SELAH': {
          const result = await connection.client.callTool({
            name: 'github_create_branch',
            arguments: { branch, fromRef: 'main', idempotencyKey },
          });
          const artifact = jsonText(result);
          if (artifact.branch !== branch) {
            throw new Error('MCP_BRANCH_MISMATCH');
          }
          return {
            stage,
            artifactType: 'PULL_REQUEST',
            artifactRef: `branch:${branch}`,
            status: 'READY',
          };
        }
        case 'TESSA': {
          const result = await connection.client.callTool({
            name: 'github_create_branch',
            arguments: { branch, fromRef: 'main', idempotencyKey },
          });
          const artifact = jsonText(result);
          if (artifact.branch !== branch || artifact.created !== false) {
            throw new Error('MCP_IDEMPOTENCY_VERIFICATION_FAILED');
          }
          return {
            stage,
            artifactType: 'QA_RESULT',
            artifactRef: `verified:${branch}`,
            status: 'PASS',
          };
        }
        case 'NOMY_ACCEPTANCE': {
          const result = await connection.client.callTool({
            name: 'github_read_issue',
            arguments: { issueNumber },
          });
          const issue = jsonText(result);
          if (issue.number !== issueNumber || priorEvidence.at(-1)?.status !== 'PASS') {
            throw new Error('MCP_ACCEPTANCE_EVIDENCE_INVALID');
          }
          return {
            stage,
            artifactType: 'PRODUCT_ACCEPTANCE',
            artifactRef: `accepted:${branch}`,
            status: 'ACCEPTED',
          };
        }
      }
    } finally {
      await connection.close();
    }
  }

  // Contract-test fallback remains side-effect free. The real canary path above
  // is explicitly enabled in CI with least-privilege GitHub credentials.
  switch (stage) {
    case 'NOMY':
      return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `objective:${objectiveId}`, status: 'READY' };
    case 'SELAH':
      return { stage, artifactType: 'PULL_REQUEST', artifactRef: `pr:${objectiveId}`, status: 'READY' };
    case 'TESSA':
      return { stage, artifactType: 'QA_RESULT', artifactRef: `qa:${objectiveId}`, status: 'PASS' };
    case 'NOMY_ACCEPTANCE':
      return { stage, artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: `acceptance:${objectiveId}`, status: 'ACCEPTED' };
  }
}
