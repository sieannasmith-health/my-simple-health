export function isExecutionApprovalCoordinationGate(labels, latestComment = '') {
  const names = Array.isArray(labels) ? labels.filter(Boolean) : [];
  const comment = String(latestComment || '');

  return names.includes('needs:siea')
    && names.includes('status:blocked')
    && !names.includes('execution:approved')
    && /(execution is not approved|approve an execution run|execution:approved authority)/i.test(comment);
}
