const DEFAULT_MAX_FANOUT = 16;

function normalizeAgent(value) {
  return String(value || '').trim().toLowerCase();
}

function isCompletedResult(result) {
  const status = String(result?.status || '').trim().toLowerCase();
  return status === 'completed' || status === 'success' || status === 'passed' || status === 'pass';
}

export function planEveryoneFanout({ agents = {}, coordinator = 'nomy', requestedAgents = null, maxFanout = DEFAULT_MAX_FANOUT } = {}) {
  const coordinatorKey = normalizeAgent(coordinator);
  const available = Object.keys(agents).map(normalizeAgent).filter(Boolean);
  const requested = Array.isArray(requestedAgents) && requestedAgents.length > 0
    ? requestedAgents.map(normalizeAgent)
    : available.filter(key => key !== coordinatorKey);

  const targets = [...new Set(requested)]
    .filter(key => key && key !== coordinatorKey && available.includes(key))
    .slice(0, Math.max(1, Math.min(Number(maxFanout || DEFAULT_MAX_FANOUT), DEFAULT_MAX_FANOUT)));

  return {
    coordinator: coordinatorKey,
    targets,
    expected: targets.length,
    bounded: true
  };
}

export function joinEveryoneResults(plan, results = []) {
  const completedByAgent = new Map();
  const unresolvedByAgent = new Map();

  for (const result of results) {
    const key = normalizeAgent(result?.agent);
    if (!key || !plan.targets.includes(key)) continue;

    if (isCompletedResult(result)) {
      if (!completedByAgent.has(key)) completedByAgent.set(key, result);
      unresolvedByAgent.delete(key);
      continue;
    }

    if (!completedByAgent.has(key) && !unresolvedByAgent.has(key)) unresolvedByAgent.set(key, result);
  }

  const completed = plan.targets.filter(key => completedByAgent.has(key));
  const missing = plan.targets.filter(key => !completedByAgent.has(key));
  const unresolved = missing.filter(key => unresolvedByAgent.has(key));

  return {
    coordinator: plan.coordinator,
    expected: plan.expected,
    received: completed.length,
    complete: plan.expected > 0 && missing.length === 0,
    completed,
    missing,
    unresolved,
    results: completed.map(key => completedByAgent.get(key))
  };
}
