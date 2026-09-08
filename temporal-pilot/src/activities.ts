import { assertAgentToolPermission } from './agent-registry.ts';
import { connectMshGitHubMcpClient } from './github-mcp-client.ts';

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

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const baseRef = process.env.MSH_CANARY_BASE_REF ?? 'selah/temporal-foundation-pilot';
      const canaryPath = `.msh-canary/objective-${objectiveId}.json`;

      switch (stage) {
        case 'NOMY': {
          assertAgentToolPermission('nomy', 'github_read_issue');
          const result = await connection.client.callTool({ name: 'github_read_issue', arguments: { issueNumber } });
          const issue = jsonText(result);
          if (issue.number !== issueNumber) throw new Error('MCP_OBJECTIVE_MISMATCH');
          return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `issue:${issueNumber}`, status: 'READY' };
        }
        case 'SELAH': {
          assertAgentToolPermission('selah', 'github_create_branch');
          const branchResult = await connection.client.callTool({
            name: 'github_create_branch',
            arguments: { branch, fromRef: baseRef, idempotencyKey: `${idempotencyKey}:branch` },
          });
          const branchArtifact = jsonText(branchResult);
          if (branchArtifact.branch !== branch) throw new Error('MCP_BRANCH_MISMATCH');

          assertAgentToolPermission('selah', 'github_write_repository_file');
          const fileResult = await connection.client.callTool({
            name: 'github_write_repository_file',
            arguments: {
              branch,
              path: canaryPath,
              content: JSON.stringify({ objectiveId, issueNumber, producedBy: 'SELAH', baseRef, idempotencyKey }, null, 2) + '\n',
              message: `MSH autonomy canary for #${objectiveId}`,
              idempotencyKey: `${idempotencyKey}:file`,
            },
          });
          const fileArtifact = jsonText(fileResult);
          if (fileArtifact.branch !== branch || fileArtifact.path !== canaryPath) throw new Error('MCP_FILE_ARTIFACT_MISMATCH');

          assertAgentToolPermission('selah', 'github_open_pull_request');
          const prResult = await connection.client.callTool({
            name: 'github_open_pull_request',
            arguments: {
              head: branch,
              base: baseRef,
              title: `MSH autonomy canary #${objectiveId}`,
              body: `Automated bounded canary artifact for Product objective #${objectiveId}. Do not merge.`,
              idempotencyKey: `${idempotencyKey}:pr`,
            },
          });
          const prArtifact = jsonText(prResult);
          if (typeof prArtifact.number !== 'number' || prArtifact.head !== branch || prArtifact.base !== baseRef) {
            throw new Error('MCP_PR_ARTIFACT_MISMATCH');
          }
          return { stage, artifactType: 'PULL_REQUEST', artifactRef: `pr:${prArtifact.number}`, status: 'READY' };
        }
        case 'TESSA': {
          const selah = priorArtifact(priorEvidence, 'SELAH');
          if (!selah || selah.artifactType !== 'PULL_REQUEST' || !selah.artifactRef.startsWith('pr:')) {
            throw new Error('MCP_QA_PR_EVIDENCE_REQUIRED');
          }

          let lastConclusion = 'pending';
          for (let attempt = 0; attempt < 12; attempt += 1) {
            assertAgentToolPermission('tessa', 'github_read_checks');
            const checksResult = await connection.client.callTool({
              name: 'github_read_checks',
              arguments: { ref: branch },
            });
            const checks = jsonText(checksResult);
            lastConclusion = String(checks.conclusion);
            if (lastConclusion === 'success') {
              return { stage, artifactType: 'QA_RESULT', artifactRef: `verified-ci:${selah.artifactRef}`, status: 'PASS' };
            }
            if (lastConclusion === 'failure') throw new Error('MCP_QA_CI_FAILED');
            await sleepMs(10_000);
          }
          throw new Error(`MCP_QA_CI_NOT_SUCCESS:${lastConclusion}`);
        }
        case 'NOMY_ACCEPTANCE': {
          assertAgentToolPermission('nomy', 'github_read_issue');
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
