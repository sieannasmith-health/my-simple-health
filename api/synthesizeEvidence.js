export async function synthesizeEvidence({
    question,
    studies,
    preliminaryStrength
}) {

    const usableStudies =
        studies
            .filter(
                study =>
                    study.abstract &&
                    study.abstract.trim()
            )
            .slice(0, 6);


    if (
        usableStudies.length === 0
    ) {

        return {

            evidenceStrength:
                "INSUFFICIENT",

            summary:
                "I found relevant research records, but I do not have enough abstract-level evidence to synthesize the findings responsibly.",

            agreement:
                "UNKNOWN",

            sources: []

        };

    }


    const studyContext =
        usableStudies
            .map(
                (study, index) => `

STUDY ${index + 1}

PMID:
${study.pmid}

TITLE:
${study.title}

STUDY DESIGN:
${study.evidenceDesign}

PUBLICATION DATE:
${study.publicationDate}

JOURNAL:
${study.journal}

ABSTRACT:
${study.abstract}

`
            )
            .join("\n");


    const response =
        await fetch(
            "https://api.openai.com/v1/responses",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`

                },

                body: JSON.stringify({

                    model:
                        "gpt-5.6-luna",

                    reasoning: {
                        effort: "low"
                    },

                    max_output_tokens:
                        500,

                    instructions: `
You are the evidence-synthesis layer for My Simple Health.

Your task is to synthesize the supplied scholarly research into accurate, plain-language health education.

Use only the research supplied to you.

Do not supplement missing information from your own memory.

Do not diagnose, prescribe, recommend medication changes, provide medical clearance, or replace professional healthcare.

Evaluate:
- what the studies generally found
- whether the findings agree
- whether important uncertainty exists
- whether the preliminary evidence-strength label should remain the same or change

Allowed evidence-strength labels:
ESTABLISHED
SUPPORTED
EMERGING
MIXED
INSUFFICIENT

Use ESTABLISHED cautiously. It generally requires strong agreement among high-quality evidence and/or authoritative guidance.

Use MIXED when credible evidence meaningfully disagrees.

Use INSUFFICIENT when the supplied evidence does not support a responsible conclusion.

Return only valid JSON.

Use this exact structure:

{
    "evidenceStrength": "SUPPORTED",
    "agreement": "CONSISTENT",
    "summary": "Technical plain-language synthesis for the evidence engine.",
    "limitations": "Important limitations or uncertainty.",
    "plainLanguageAnswer": "Short user-facing answer in everyday language.",
    "whatWeKnow": "What the evidence supports with reasonable confidence.",
    "whatWeDontKnowYet": "What remains uncertain, limited, or not established."
}

For plainLanguageAnswer:
- Keep it to about 2–4 sentences.
- Use everyday language.
- Do not exaggerate certainty.
- Do not add claims beyond the supplied studies.

For whatWeKnow:
- State the clearest supported takeaway.

For whatWeDontKnowYet:
- State the most important uncertainty or limitation.
- Do not imply that uncertainty means the evidence is useless.
`,

input: `
USER QUESTION:
${question}

PRELIMINARY STRUCTURAL EVIDENCE STRENGTH:
${preliminaryStrength}

RESEARCH:
${studyContext}

Determine the final evidence-strength label based on what the abstracts actually report, not merely the study designs.
`

                })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        console.error(
            "Evidence synthesis API error:",
            data
        );


        throw new Error(
            "Evidence synthesis failed."
        );

    }


    const outputText =
        extractOutputText(
            data
        );


    if (!outputText) {

        throw new Error(
            "No synthesis output returned."
        );

    }


    let parsed;


    try {

    const cleanedOutput =
        outputText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

    parsed =
        JSON.parse(
            cleanedOutput
        );

}

catch (error) {

    console.error(
        "Could not parse synthesis JSON:",
        outputText
    );

    throw new Error(
        "Invalid synthesis output."
    );

}


    return {

        evidenceStrength:
            parsed.evidenceStrength ||
            preliminaryStrength ||
            "INSUFFICIENT",

        agreement:
            parsed.agreement ||
            "UNKNOWN",

        summary:
            parsed.summary ||
            "",

        limitations:
            parsed.limitations ||
            "",
       
        plainLanguageAnswer:
    parsed.plainLanguageAnswer ||
    "",

whatWeKnow:
    parsed.whatWeKnow ||
    "",

whatWeDontKnowYet:
    parsed.whatWeDontKnowYet ||
    "",

        sources:
            usableStudies.map(
                study => ({
                    pmid:
                        study.pmid,

                    title:
                        study.title,

                    journal:
                        study.journal,

                    publicationDate:
                        study.publicationDate,

                    evidenceDesign:
                        study.evidenceDesign,

                    url:
                        study.url
                })
            )

    };

}


/* =========================================================
   EXTRACT OPENAI RESPONSE TEXT
========================================================= */

function extractOutputText(data) {

    if (
        typeof data.output_text === "string" &&
        data.output_text.trim()
    ) {

        return data.output_text.trim();

    }


    if (
        !Array.isArray(
            data.output
        )
    ) {

        return "";

    }


    const pieces = [];


    for (
        const item
        of data.output
    ) {

        if (
            item.type !== "message" ||
            !Array.isArray(
                item.content
            )
        ) {

            continue;

        }


        for (
            const content
            of item.content
        ) {

            if (
                content.type === "output_text" &&
                typeof content.text === "string"
            ) {

                pieces.push(
                    content.text
                );

            }

        }

    }


    return pieces
        .join("\n")
        .trim();

}
