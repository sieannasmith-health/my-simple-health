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

Do not:
- answer the question
- diagnose
- add unrelated medical concepts
- make the query unnecessarily narrow
- include explanations
- include Markdown
- include quotation marks around the entire output

Prefer a query broad enough to retrieve systematic reviews, meta-analyses, randomized trials, and other relevant human research.

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

            console.error(
                "Research query builder API error:",
                data
            );

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

    catch (error) {

        console.error(
            "Research query builder error:",
            error
        );


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
