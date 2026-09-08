export const MCP_GITHUB_TOOLS = [
  'github_read_issue',
  'github_read_repository_file',
  'github_create_branch',
  'github_write_repository_file',
  'github_open_pull_request',
  'github_read_checks',
] as const;

export type McpGitHubTool = (typeof MCP_GITHUB_TOOLS)[number];
export type AgentRuntimeStatus = 'active' | 'registered';

export interface MshAgentMetadataCard {
  id: string;
  name: string;
  role: string;
  owner: 'MSH';
  version: '1.0.0';
  status: AgentRuntimeStatus;
  capabilities: readonly string[];
  explicitNonCapabilities: readonly string[];
  protocolBindings: readonly ('TEMPORAL_INTERNAL' | 'MCP_TOOL_ACCESS')[];
  allowedTools: readonly McpGitHubTool[];
  a2aExposure: 'none';
}

const READ_ONLY_TOOLS = [
  'github_read_issue',
  'github_read_repository_file',
  'github_read_checks',
] as const satisfies readonly McpGitHubTool[];

const SELAH_TOOLS = MCP_GITHUB_TOOLS;

const registered = (id: string, name: string, role: string, capabilities: readonly string[]): MshAgentMetadataCard => ({
  id, name, role, owner: 'MSH', version: '1.0.0', status: 'registered', capabilities,
  explicitNonCapabilities: ['autonomous_repository_write', 'merge', 'repository_admin', 'secrets_admin', 'destructive_repository_actions'],
  protocolBindings: [], allowedTools: [], a2aExposure: 'none',
});

const activeReadOnlySpecialist = (id: string, name: string, role: string, capabilities: readonly string[]): MshAgentMetadataCard => ({
  id, name, role, owner: 'MSH', version: '1.0.0', status: 'active', capabilities,
  explicitNonCapabilities: ['repository_write', 'merge', 'repository_admin', 'secrets_admin', 'destructive_repository_actions'],
  protocolBindings: ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS'], allowedTools: READ_ONLY_TOOLS, a2aExposure: 'none',
});

export const MSH_AGENT_REGISTRY: readonly MshAgentMetadataCard[] = [
  { id: 'nomy', name: 'Nomy', role: 'Product Orchestration', owner: 'MSH', version: '1.0.0', status: 'active', capabilities: ['product_orchestration', 'objective_decomposition', 'product_acceptance'], explicitNonCapabilities: ['implementation_merge', 'repository_admin', 'secrets_admin', 'destructive_repository_actions'], protocolBindings: ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS'], allowedTools: READ_ONLY_TOOLS, a2aExposure: 'none' },
  { id: 'selah', name: 'Selah', role: 'Software Engineering', owner: 'MSH', version: '1.0.0', status: 'active', capabilities: ['software_engineering', 'repository_implementation', 'ci_integration'], explicitNonCapabilities: ['merge', 'repository_admin', 'secrets_admin', 'destructive_repository_actions'], protocolBindings: ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS'], allowedTools: SELAH_TOOLS, a2aExposure: 'none' },
  { id: 'tessa', name: 'Tessa', role: 'Quality Engineering', owner: 'MSH', version: '1.0.0', status: 'active', capabilities: ['quality_engineering', 'test_review', 'acceptance_verification'], explicitNonCapabilities: ['repository_write', 'merge', 'repository_admin', 'secrets_admin', 'destructive_repository_actions'], protocolBindings: ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS'], allowedTools: READ_ONLY_TOOLS, a2aExposure: 'none' },
  activeReadOnlySpecialist('mira', 'Mira', 'Design & UX', ['product_design', 'ux_flows', 'accessibility']),
  activeReadOnlySpecialist('sage', 'Sage', 'AI & Simple', ['ai_systems', 'simple_conversation_architecture']),
  activeReadOnlySpecialist('clara', 'Clara', 'Health Data & Informatics', ['health_informatics', 'interoperability', 'data_structure']),
  activeReadOnlySpecialist('eden', 'Eden', 'Public Health & Evidence', ['public_health_evidence', 'recommendation_evidence']),
  activeReadOnlySpecialist('vera', 'Vera', 'Privacy & Trust', ['privacy_review', 'trust_governance']),
  activeReadOnlySpecialist('aiden', 'Aiden', 'Security Engineering', ['security_engineering', 'threat_review']),
  activeReadOnlySpecialist('reese', 'Reese', 'Regulatory & Compliance', ['regulatory_review', 'compliance']),
  registered('ellis', 'Ellis', 'Economize & Health Affordability', ['health_affordability', 'cost_navigation']),
  registered('genesis', 'Genesis', 'Growth & Acquisition', ['growth_strategy', 'acquisition']),
  registered('newton', 'Newton', 'Business Strategy & Finance', ['business_strategy', 'finance']),
  registered('harper', 'Harper', 'People & Hiring', ['people_operations', 'hiring']),
  registered('june', 'June', 'Member Experience & Operations', ['member_experience', 'operations']),
  registered('atlas', 'Atlas', 'Data & Analytics', ['analytics', 'measurement']),
  registered('iris', 'Iris', 'Research & Insights', ['research', 'insight_synthesis']),
] as const;

const byId = new Map(MSH_AGENT_REGISTRY.map((card) => [card.id, card] as const));
if (byId.size !== MSH_AGENT_REGISTRY.length) throw new Error('DUPLICATE_AGENT_ID');
export function getAgentCard(agentId: string): MshAgentMetadataCard | undefined { return byId.get(agentId); }
export function discoverAgents(input: { capability?: string; status?: AgentRuntimeStatus; requiredTool?: McpGitHubTool } = {}): MshAgentMetadataCard[] {
  return MSH_AGENT_REGISTRY.filter((card) => {
    if (input.capability && !card.capabilities.includes(input.capability)) return false;
    if (input.status && card.status !== input.status) return false;
    if (input.requiredTool && !card.allowedTools.includes(input.requiredTool)) return false;
    return true;
  });
}
export function canAgentUseTool(agentId: string, tool: McpGitHubTool): boolean { const card = getAgentCard(agentId); return card?.status === 'active' && card.allowedTools.includes(tool) === true; }
export function assertAgentToolPermission(agentId: string, tool: McpGitHubTool): void { if (!canAgentUseTool(agentId, tool)) throw new Error(`AGENT_TOOL_FORBIDDEN:${agentId}:${tool}`); }
