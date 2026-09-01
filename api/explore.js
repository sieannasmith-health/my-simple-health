import { buildResearchQuery } from "../server/buildResearchQuery.js";
import { searchPubMed } from "../server/pubmed.js";
import { rankEvidence, getEvidenceStrength } from "../server/rankEvidence.js";
import { synthesizeEvidence } from "../server/synthesizeEvidence.js";

const ALLOWED_ORIGINS = new Set([
  "https://mysimplehealth.org",
  "https://www.mysimplehealth.org",
  "https://my-simple-health.vercel.app"
]);

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

async function checkOpenAIConnection() {
  if (!process.env.OPENAI_API_KEY) {
    return { connected: false, configured: false, model: "gpt-5.6-luna", status: "missing_api_key" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models/gpt-5.6-luna", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return {
        connected: false,
        configured: true,
        model: "gpt-5.6-luna",
        status: `openai_${response.status}`
      };
    }

    return { connected: true, configured: true, model: "gpt-5.6-luna", status: "ready" };
  } catch (error) {
    console.error("OpenAI connection check failed:", error);
    return { connected: false, configured: true, model: "gpt-5.6-luna", status: "network_error" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const health = await checkOpenAIConnection();
    return res.status(health.connected ? 200 : 503).json({ service: "explore", ...health });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const question = String(req.body?.question || "").trim().slice(0, 1000);

  if (!question) {
    return res.status(400).json({ error: "Ask a health question first." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Explore is not configured yet." });
  }

  try {
    const researchQuery = await buildResearchQuery(question);
    const studies = await searchPubMed(researchQuery || question, 8);
    const rankedStudies = rankEvidence(studies);
    const preliminaryStrength = getEvidenceStrength(rankedStudies);
    const synthesis = await synthesizeEvidence({
      question,
      studies: rankedStudies,
      preliminaryStrength
    });

    return res.status(200).json({
      question,
      researchQuery,
      ...synthesis,
      sourceCount: Array.isArray(synthesis.sources) ? synthesis.sources.length : 0
    });
  } catch (error) {
    console.error("Explore answer error:", error);
    return res.status(500).json({
      error: "I couldn't complete the evidence search right now. Please try again."
    });
  }
}
