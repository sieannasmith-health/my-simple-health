/* =========================================================
   MY SIMPLE HEALTH
   EVIDENCE RELEVANCE FILTER

   PURPOSE:

   Scientific quality and relevance are different things.

   A high-quality study should NOT be used simply because
   it contains words related to the user's question.

   This layer determines whether retrieved research actually
   helps answer the question being asked.

   PRINCIPLE:

   PERSONALIZE RELEVANCE.
   DO NOT PERSONALIZE CLINICAL DETERMINATION.
========================================================= */


export async function filterEvidenceRelevance({
    question,
    studies,
    profile = null
}) {

    if (
        !question ||
        !Array.isArray(studies) ||
        studies.length === 0
    ) {

        return [];

    }


    const candidates =
        studies
            .filter(
                study =>
                    study &&
                    study.abstract &&
                    study.abstract.trim()
            )
            .slice(0, 12);


    if (
        candidates.length === 0
    ) {

        return [];

    }


    const studyContext =
        candidates
            .map(
                (study, index) => `

STUDY ${index + 1}

PMID:
${study.pmid || "Unknown"}

TITLE:
${study.title || "Unknown"}

STUDY DESIGN:
${study.evidenceDesign || "Unknown"}

JOURNAL:
${study.journal || "Unknown"}

PUBLICATION DATE:
${study.publicationDate || "Unknown"}

ABSTRACT:
${study.abstract}

`
            )
            .join("\n");


    const profileContext =
        buildSafeProfileContext(
            profile
        );


    const response =
        await fetch(
            "https://api.openai.com/v1/responses",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`

                },

                body:
                    JSON.stringify({

                        model:
                            "gpt-5.6-luna",

                        reasoning: {
                            effort: "low"
                        },

                        max_output_tokens:
                            1200,

                        instructions: `
You are the evidence-relevance screening layer for My Simple Health.

Your task is NOT to answer the user's health question.

Your task is to determine which retrieved scholarly studies are actually relevant enough to be used to answer the user's question.

Scientific quality and relevance are separate.

A high-quality study that does not meaningfully answer the user's question should be excluded.

=====================================================
PRIMARY PRINCIPLE
=====================================================

PERSONALIZE RELEVANCE.

DO NOT PERSONALIZE CLINICAL DETERMINATION.

User context may help determine whether evidence is relevant to:
- the question
- the user's stated goal
- stated barriers
- preferences
- available resources
- environment
- cultural context
- practical circumstances

User context must NOT be used to:
- diagnose
- prescribe
- select treatment for the person
- determine medication appropriateness
- provide medical clearance
- predict an individualized clinical outcome

=====================================================
RELEVANCE SCREENING
=====================================================

For every study, consider:

1. QUESTION MATCH

Does the study actually help answer the question being asked?

2. POPULATION RELEVANCE

Is the population reasonably relevant?

A study involving a very specific disease or clinical population should not automatically be generalized to a general wellness question.

Example:

If the user asks about building a sustainable exercise routine, a study specifically examining exercise interventions among people with epilepsy should generally NOT be selected unless epilepsy is actually relevant to the user's question.

3. INTERVENTION OR EXPOSURE MATCH

Is the behavior, intervention, product, exposure, or concept being studied actually the one the user is asking about?

4. OUTCOME MATCH

Does the study measure an outcome that helps answer the user's actual question?

5. CONTEXT MATCH

Does the study's context reasonably relate to what the user is trying to understand?

6. GENERALIZABILITY

Can the finding reasonably inform the question?

Do not assume that evidence from a narrow population automatically applies broadly.

7. PRACTICAL RELEVANCE

Would including this study improve the usefulness or accuracy of the answer?

If not, exclude it.

=====================================================
DO NOT FORCE EVIDENCE
=====================================================

It is acceptable to return ZERO studies.

Irrelevant evidence is worse than admitting that sufficiently relevant evidence was not found.

Do not select studies merely because they contain overlapping keywords.

Do not select a study simply because it is highly ranked scientifically.

=====================================================
CULTURAL HUMILITY
=====================================================

Do not assume that one culture, diet, household structure, religious practice, socioeconomic circumstance, geographic environment, or health belief applies universally.

When user context is supplied, it may help determine practical relevance.

Respect cultural and personal context without treating beliefs or traditions as scientific evidence.

Scientific claims must remain grounded in scientific evidence.

=====================================================
OUTPUT
=====================================================

Return ONLY valid JSON.

Use exactly this structure:

{
    "relevantStudies": [
        {
            "studyNumber": 1,
            "relevanceScore": 95,
            "reason": "Directly examines the behavior and outcome asked about."
        }
    ]
}

relevanceScore must be an integer from 0 to 100.

Use this general interpretation:

90–100:
Directly answers the question.

75–89:
Strongly relevant and useful.

60–74:
Somewhat relevant but indirect.

Below 60:
Do not include.

Only return studies with relevanceScore of 60 or greater.

Prefer direct evidence over tangential evidence.

Do not include more than 6 studies.

If nothing is sufficiently relevant, return:

{
    "relevantStudies": []
}
`,

                        input: `
USER QUESTION:
${question}

USER CONTEXT:
${profileContext || "No user profile context supplied."}

CANDIDATE RESEARCH:
${studyContext}

Screen these studies for actual relevance to the user's question.
`

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        console.error(
            "Evidence relevance API error:",
            data
        );


        throw new Error(
            "Evidence relevance screening failed."
        );

    }


    const outputText =
        extractOutputText(
            data
        );


    if (!outputText) {

        throw new Error(
            "No evidence relevance output returned."
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
            "Could not parse evidence relevance JSON:",
            outputText
        );


        throw new Error(
            "Invalid evidence relevance output."
        );

    }


    if (
        !Array.isArray(
            parsed.relevantStudies
        )
    ) {

        return [];

    }


    /*
       Convert the model's study numbers back into
       the original study objects.

       We also attach relevance information so later
       layers can use it if needed.
    */

    const relevantStudies =
        parsed.relevantStudies
            .filter(
                result =>
                    Number.isInteger(
                        result.studyNumber
                    ) &&
                    result.studyNumber >= 1 &&
                    result.studyNumber <= candidates.length &&
                    Number(
                        result.relevanceScore
                    ) >= 60
            )
            .sort(
                (a, b) =>
                    Number(
                        b.relevanceScore
                    ) -
                    Number(
                        a.relevanceScore
                    )
            )
            .slice(0, 6)
            .map(
                result => {

                    const study =
                        candidates[
                            result.studyNumber - 1
                        ];


                    return {

                        ...study,

                        relevanceScore:
                            Number(
                                result.relevanceScore
                            ),

                        relevanceReason:
                            typeof result.reason === "string"
                                ? result.reason
                                : ""

                    };

                }
            );


    return relevantStudies;

}


/* =========================================================
   SAFE PROFILE CONTEXT

   Only information deliberately supplied by the application
   is passed into evidence relevance screening.

   Missing information must remain unknown.
========================================================= */

function buildSafeProfileContext(profile) {

    if (
        !profile ||
        typeof profile !== "object"
    ) {

        return "";

    }


    const safeProfile = {

        goals:
            profile.goals || [],

        priorities:
            profile.priorities || [],

        barriers:
            profile.barriers || [],

        preferences:
            profile.preferences || [],

        routines:
            profile.routines || [],

        resources:
            profile.resources || [],

        environment:
            profile.environment || [],

        culturalConsiderations:
            profile.culturalConsiderations || []

    };


    return JSON.stringify(
        safeProfile,
        null,
        2
    );

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
