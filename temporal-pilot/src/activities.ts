import { connectMshGitHubMcpClient } from './github-mcp-client.js';

export interface StageEvidence {
  stage: 'NOMY' | 'SELAH' | 'TESSA' | 'NOMY_ACCEPTANCE';
  artifactType: 'PRODUCT_OBJECTIVE' | 'PULL_REQUEST' | 'QA_RESULT' | 'PRODUCT_ACCEPTANCE';
  artifactRef: string;
  status: 'READY' | 'PASS' | 'ACCEPTED';
}

function jsonText(result: Awaited<ReturnType<Awaited<ReturnType<typeof connectMshGitHubMcpClient>>['client']['callTool']>>): Record<string, unknown> {
  const item = result.content?.find((entry) => entry.type === 'text');
  if (!item || item.type !== 'text') throw new Error('MCP_TEXT_RESULT_REQUIRED');
  if (result.isError === true) throw new Error(item.text);
  return JSON.parse(item.text) as Record<string, unknown>;
}

function objectiveIssueNumber(objectiveId: string): number {
  const issueNumber = Number.parseInt(objectiveId, 10);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error('OBJECTIVE_ISSUE_NUMBER_REQUIRED');
  return issueNumber;
}

function priorArtifact(priorEvidence: StageEvidence[], stage: StageEvidence['stage']): StageEvidence | undefined {
  return priorEvidence.find((evidence) => evidence.stage === stage);
}

export async function recordStage(objectiveId: string, stage: string, idempotencyKey: string): Promise<string> {
  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  void objectiveId;
  return stage;
}

export async function runAgentStage(
  objectiveId: string,
  stage: StageEvidence['stage'],
  priorEvidence: StageEvidence[],
  idempotencyKey: string,
): Promise<StageEvidence> {
  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');

  if (process.env.MSH_REAL_MCP_CANARY === '1') {
    const connection = await connectMshGitHubMcpClient();
    try {
      const issueNumber = objectiveIssueNumber(objectiveId);
      const branch = `msh-autonomy-canary-${objectiveId}`;
      const canaryPath = `.msh-canary/objective-${objectiveId}.json`;

      switch (stage) {
        case 'NOMY': {
          const result = await connection.client.callTool({ name: 'github_read_issue', arguments: { issueNumber } });
          const issue = jsonText(result);
          if (issue.number !== issueNumber) throw new Error('MCP_OBJECTIVE_MISMATCH');
          return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `issue:${issueNumber}`, status: 'READY' };
        }
        case 'SELAH': {
          const branchResult = await connection.client.callTool({
            name: 'github_create_branch',
            arguments: { branch, fromRef: 'main', idempotencyKey: `${idempotencyKey}:branch` },
          });
          const branchArtifact = jsonText(branchResult);
          if (branchArtifact.branch !== branch) throw new Error('MCP_BRANCH_MISMATCH');

          const fileResult = await connection.client.callTool({
            name: 'github_write_repository_file',
            arguments: {
              branch,
              path: canaryPath,
              content: JSON.stringify({ objectiveId, issueNumber, producedBy: 'SELAH', idempotencyKey }, null, 2) + '\n',
              message: `MSH autonomy canary for #${objectiveId}`,
              idempotencyKey: `${idempotencyKey}:file`,
            },
          });
          const fileArtifact = jsonText(fileResult);
          if (fileArtifact.branch !== branch || fileArtifact.path !== canaryPath) throw new Error('MCP_FILE_ARTIFACT_MISMATCH');

          const prResult = await connection.client.callTool({
            name: 'github_open_pull_request',
            arguments: {
              head: branch,
              base: 'main',
              title: `MSH autonomy canary #${objectiveId}`,
              body: `Automated bounded canary artifact for Product objective #${objectiveId}. Do not merge.`,
              idempotencyKey: `${idempotencyKey}:pr`,
            },
          });
          const prArtifact = jsonText(prResult);
          if (typeof prArtifact.number !== 'number' || prArtifact.head !== branch || prArtifact.base !== 'main') {
            throw new Error('MCP_PR_ARTIFACT_MISMATCH');
          }
          return { stage, artifactType: 'PULL_REQUEST', artifactRef: `pr:${prArtifact.number}`, status: 'READY' };
        }
        case 'TESSA': {
          const selah = priorArtifact(priorEvidence, 'SELAH');
          if (!selah || selah.artifactType !== 'PULL_REQUEST' || !selah.artifactRef.startsWith('pr:')) {
            throw new Error('MCP_QA_PR_EVIDENCE_REQUIRED');
          }
          const prResult = await connection.client.callTool({
            name: 'github_open_pull_request',
            arguments: {
              head: branch,
              base: 'main',
              title: `MSH autonomy canary #${objectiveId}`,
              body: `Automated bounded canary artifact for Product objective #${objectiveId}. Do not merge.`,
              idempotencyKey: `${idempotencyKey}:verify-pr`,
            },
          });
          const prArtifact = jsonText(prResult);
          if (`pr:${prArtifact.number}` !== selah.artifactRef || prArtifact.created !== false) {
            throw new Error('MCP_QA_PR_VERIFICATION_FAILED');
          }

          const checksResult = await connection.client.callTool({
            name: 'github_read_checks',
            arguments: { ref: branch },
          });
          const checks = jsonText(checksResult);
          if (checks.conclusion !== 'success') throw new Error(`MCP_QA_CI_NOT_SUCCESS:${String(checks.conclusion)}`);

          return { stage, artifactType: 'QA_RESULT', artifactRef: `verified-ci:${selah.artifactRef}`, status: 'PASS' };
        }
        case 'NOMY_ACCEPTANCE': {
          const result = await connection.client.callTool({ name: 'github_read_issue', arguments: { issueNumber } });
          const issue = jsonText(result);
          const qa = priorArtifact(priorEvidence, 'TESSA');
          if (issue.number !== issueNumber || qa?.status !== 'PASS') throw new Error('MCP_ACCEPTANCE_EVIDENCE_INVALID');
          return { stage, artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: `accepted:${qa.artifactRef}`, status: 'ACCEPTED' };
        }
      }
    } finally {
      await connection.close();
    }
  }

  switch (stage) {
    case 'NOMY': return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `objective:${objectiveId}`, status: 'READY' };
    case 'SELAH': return { stage, artifactType: 'PULL_REQUEST', artifactRef: `pr:${objectiveId}`, status: 'READY' };
    case 'TESSA': return { stage, artifactType: 'QA_RESULT', artifactRef: `qa:${objectiveId}`, status: 'PASS' };
    case 'NOMY_ACCEPTANCE': return { stage, artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: `acceptance:${objectiveId}`, status: 'ACCEPTED' };
  }
}
