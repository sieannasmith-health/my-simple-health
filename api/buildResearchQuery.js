export async function buildResearchQuery(question) {

    const cleanQuestion =
        String(question || "")
            .trim()
            .slice(0, 1000);


    if (!cleanQuestion) {
        return "";
    }


    try {

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
                            180,

                        instructions: `
You convert everyday health questions into concise PubMed search queries.

Your job is retrieval, not answering the health question.

Create a PubMed-friendly search expression using:
- important biomedical concepts
- useful scientific synonyms
- Boolean operators such as AND and OR
- parentheses when helpful

Preserve the meaning of the user's question.

First identify any explicitly stated:
- population
- intervention or exposure
- outcome

Preserve each stated core concept as its own AND-connected concept group.
Use OR only for close synonyms within the same concept group.

Do not replace a specific intervention with a broader category alone.
For example, time-restricted eating may include close synonyms such as
time-restricted feeding, but intermittent fasting should not replace the
specific time-restricted-eating concept.

Do not replace a requested outcome with adjacent outcomes.
For example, blood pressure should remain an explicit query concept rather
than being replaced by weight loss, metabolic health, or cardiovascular risk.

When the user asks about adults generally, do not add a disease-specific
population that the user did not request.

Do not:
- answer the question
- diagnose
- add unrelated medical concepts
- make the query unnecessarily narrow
- include explanations
- include Markdown
- include quotation marks around the entire output

Prefer a query broad enough to retrieve relevant human study designs without
dropping the user's explicit population, intervention/exposure, or outcome.

Return only the search query.
`,

                        input:
                            cleanQuestion

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {
            return cleanQuestion;

        }


        const researchQuery =
            extractOutputText(
                data
            );


        if (!researchQuery) {

            return cleanQuestion;

        }


        return researchQuery
            .replace(/```/g, "")
            .replace(/\s+/g, " ")
            .trim();

    }

    catch {

        /*
            Safe fallback:
            PubMed receives the original question
            if query translation fails.
        */

        return cleanQuestion;

    }

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
        !Array.isArray(data.output)
    ) {

        return "";

    }


    const pieces = [];


    for (const item of data.output) {

        if (
            item.type !== "message" ||
            !Array.isArray(item.content)
        ) {

            continue;

        }


        for (const content of item.content) {

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
        .join(" ")
        .trim();

}
