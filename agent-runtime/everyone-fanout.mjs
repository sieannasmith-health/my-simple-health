const DEFAULT_MAX_FANOUT = 16;

function normalizeAgent(value) {
  return String(value || '').trim().toLowerCase();
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
  const byAgent = new Map();
  for (const result of results) {
    const key = normalizeAgent(result?.agent);
    if (!key || !plan.targets.includes(key) || byAgent.has(key)) continue;
    byAgent.set(key, result);
  }

  const completed = plan.targets.filter(key => byAgent.has(key));
  const missing = plan.targets.filter(key => !byAgent.has(key));
  return {
    coordinator: plan.coordinator,
    expected: plan.expected,
    received: completed.length,
    complete: missing.length === 0,
    completed,
    missing,
    results: completed.map(key => byAgent.get(key))
  };
}
