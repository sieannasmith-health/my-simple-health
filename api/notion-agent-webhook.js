import {
  extractPlainText,
  isIntegrationAuthored,
  loadAgents,
  parseAgentTarget,
  runAgent,
  verifyNotionSignature
} from '../agent-runtime/notion-bridge.mjs';

const NOTION_VERSION = '2025-09-03';

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

async function notionRequest(path, token, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: { ...notionHeaders(token), ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Notion ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function fetchComment(commentId, token) {
  return notionRequest(`/comments/${encodeURIComponent(commentId)}`, token);
}

async function fetchPage(pageId, token) {
  return notionRequest(`/pages/${encodeURIComponent(pageId)}`, token);
}

async function replyToDiscussion({ pageId, discussionId, text, token }) {
  return notionRequest('/comments', token, {
    method: 'POST',
    body: JSON.stringify({
      parent: { page_id: pageId },
      discussion_id: discussionId,
      rich_text: [{ type: 'text', text: { content: text.slice(0, 1900) } }]
    })
  });
}

function eventType(body) {
  return body?.type || body?.event?.type || '';
}

function eventCommentId(body) {
  return body?.entity?.id || body?.data?.id || body?.comment?.id || null;
}

function eventPageId(body, comment) {
  return body?.data?.parent?.id || comment?.parent?.page_id || comment?.parent?.id || null;
}

function pageContext(page) {
  const props = page?.properties || {};
  const lines = [];
  for (const [name, value] of Object.entries(props)) {
    if (!value || typeof value !== 'object') continue;
    if (value.type === 'title') lines.push(`${name}: ${(value.title || []).map(x => x.plain_text || '').join('')}`);
    else if (value.type === 'rich_text') lines.push(`${name}: ${(value.rich_text || []).map(x => x.plain_text || '').join('')}`);
    else if (value.type === 'select') lines.push(`${name}: ${value.select?.name || ''}`);
    else if (value.type === 'status') lines.push(`${name}: ${value.status?.name || ''}`);
  }
  return lines.filter(Boolean).join('\n').slice(0, 8000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const verificationToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  const notionToken = process.env.NOTION_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!verificationToken || !notionToken || !openaiKey) {
    console.error('[MSH Notion Bridge] Missing required server secrets.');
    return res.status(503).json({ error: 'bridge_not_configured' });
  }

  const signature = req.headers['x-notion-signature'];
  if (!verifyNotionSignature(rawBody, signature, verificationToken)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const body = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  if (eventType(body) !== 'comment.created') return res.status(202).json({ ignored: true });

  const commentId = eventCommentId(body);
  if (!commentId) return res.status(400).json({ error: 'missing_comment_id' });

  try {
    const comment = await fetchComment(commentId, notionToken);
    if (isIntegrationAuthored(comment, process.env.NOTION_INTEGRATION_USER_ID)) {
      return res.status(202).json({ ignored: true, reason: 'integration_authored' });
    }

    const message = extractPlainText(comment);
    if (!message) return res.status(202).json({ ignored: true, reason: 'empty_comment' });

    const pageId = eventPageId(body, comment);
    const discussionId = comment?.discussion_id;
    if (!pageId || !discussionId) return res.status(400).json({ error: 'missing_discussion_context' });

    const agents = await loadAgents();
    const agentKey = parseAgentTarget(message, agents);
    const page = await fetchPage(pageId, notionToken);
    const responseText = await runAgent({
      agentKey,
      message,
      taskContext: pageContext(page),
      agents,
      openaiKey,
      model: process.env.MSH_AGENT_MODEL || 'gpt-5.6-luna'
    });

    await replyToDiscussion({ pageId, discussionId, text: responseText, token: notionToken });
    console.log(`[MSH Notion Bridge] Routed comment ${commentId} to ${agentKey}.`);
    return res.status(200).json({ ok: true, routed_to: agentKey });
  } catch (error) {
    console.error(`[MSH Notion Bridge] ${error?.stack || error?.message || String(error)}`);
    return res.status(500).json({ error: 'routing_failed' });
  }
}
