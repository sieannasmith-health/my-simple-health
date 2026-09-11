export function isFreshAddressedHumanComment(env = process.env) {
  const triggerCommentId = Number(env.TRIGGER_COMMENT_ID || 0);
  const commentBody = String(env.COMMENT_BODY || '');
  if (!triggerCommentId || !commentBody) return false;
  const firstLine = commentBody.split(/\r?\n/, 1)[0];
  return /^\s*[A-Za-z]+\s*:\s*/.test(firstLine);
}
