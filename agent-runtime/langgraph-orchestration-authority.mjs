function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return String(input || '');
}

function requestMethod(input, init = {}) {
  const method = init?.method || (typeof input !== 'string' ? input?.method : null) || 'GET';
  return String(method).toUpperCase();
}

export function isLangGraphOrchestrationWrite({ input, init = {}, repository, issueNumber, owner }) {
  if (owner !== 'langgraph') return false;

  const url = requestUrl(input);
  const method = requestMethod(input, init);
  if (method === 'GET' || method === 'HEAD') return false;

  const apiBase = `https://api.github.com/repos/${repository}`;
  const issueBase = `${apiBase}/issues/${issueNumber}`;
  const repositoryLabels = `${apiBase}/labels`;

  const isExactIssueResource = url === issueBase;
  const isIssueSubresource = url.startsWith(`${issueBase}/`);
  const isRepositoryLabelMutation = url === repositoryLabels;

  return isExactIssueResource || isIssueSubresource || isRepositoryLabelMutation;
}

export function createLangGraphFetchGuard({ realFetch, repository, issueNumber, owner, onSuppressed = () => {} }) {
  if (typeof realFetch !== 'function') throw new TypeError('realFetch must be a function');

  return async function guardedFetch(input, init = {}) {
    if (isLangGraphOrchestrationWrite({ input, init, repository, issueNumber, owner })) {
      onSuppressed({ url: requestUrl(input), method: requestMethod(input, init) });
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    return realFetch(input, init);
  };
}
