export function isExecutionApprovalCoordinationGate(labels, latestComment = '') {
  const names = Array.isArray(labels) ? labels.filter(Boolean) : [];
  const comment = String(latestComment || '');
  const missingExecutionApproval = !names.includes('execution:approved');
  const blocked = names.includes('status:blocked');
  const mentionsExecutionApproval = /execution:approved/i.test(comment);
  const executionApprovalLanguage = /(execution is not approved|approve an execution run|not authorized|authorization is absent|authorization.*absent|approval.*absent|approve execution)/i.test(comment)
    || (mentionsExecutionApproval && /(absent|missing|not approved|not authorized|approve|authorization|authorized)/i.test(comment));

  return missingExecutionApproval
    && blocked
    && executionApprovalLanguage;
}
