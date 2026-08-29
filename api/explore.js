import { buildResearchQuery } from "./buildResearchQuery.js";
import { searchPubMed } from "./pubmed.js";
import { rankEvidence, getEvidenceStrength } from "./rankEvidence.js";
import { synthesizeEvidence } from "./synthesizeEvidence.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
