export function isExecutionApprovalCoordinationGate(labels, latestComment = '') {
  const names = Array.isArray(labels) ? labels.filter(Boolean) : [];
  const comment = String(latestComment || '');
  const missingExecutionApproval = !names.includes('execution:approved');
  const blocked = names.includes('status:blocked');
  const executionApprovalLanguage = /(execution is not approved|approve an execution run|execution:approved authority|apply the objective-level `?execution:approved`? authorization|approve execution)/i.test(comment);

  return missingExecutionApproval
    && blocked
    && executionApprovalLanguage;
}
