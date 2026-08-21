import { retrieveEvidence } from "./retrieveEvidence.js";
import {
    searchPubMed
} from "./pubmed.js";

import {
    rankEvidence,
    getEvidenceStrength
} from "./rankEvidence.js";

import {
    synthesizeEvidence
} from "./synthesizeEvidence.js";

// My Simple Health AI backend

export default async function handler(req, res) {

    /* =====================================================
       CORS
    ====================================================== */

    res.setHeader(
        "Access-Control-Allow-Origin",
        "https://mysimplehealth.org"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    if (req.method !== "POST") {

        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });

    }


    /* =====================================================
       INPUT VALIDATION
    ====================================================== */

    const { message } =
        req.body || {};


    if (
        !message ||
        typeof message !== "string"
    ) {

        return res.status(400).json({
            success: false,
            message: "A message is required."
        });

    }


    const cleanMessage =
        message
            .trim()
            .slice(0, 2000);


    /* =====================================================
       SAFETY / SCOPE ROUTING
    ====================================================== */

    const route =
        classifyRequest(
            cleanMessage
        );


    /* =====================================================
       MEDICAL EMERGENCY
    ====================================================== */

    if (
        route === "SAFETY_MEDICAL"
    ) {

        return res.status(200).json({

            success: true,

            route,

            stopNormalFlow: true,

            response:
                "This may be a medical emergency. Please call 911 or your local emergency number now, or go to the nearest emergency department."

        });

    }


    /* =====================================================
       CRISIS
    ====================================================== */

    if (
        route === "SAFETY_CRISIS"
    ) {

        return res.status(200).json({

            success: true,

            route,

            stopNormalFlow: true,

            response:
                "This may be an immediate emotional or suicide crisis. In the United States, call or text 988 for the Suicide & Crisis Lifeline. If there is immediate danger or you cannot stay safe, call 911 or go to the nearest emergency department."

        });

    }


    /* =====================================================
       RED
    ====================================================== */

    if (
        route === "RED"
    ) {

        return res.status(200).json({

            success: true,

            route,

            response:
                "I can help explain the general health concepts involved, but I can't diagnose a condition, interpret clinical data as your clinician, prescribe or change treatment, or medically clear you. I can also help you prepare questions for an appropriate healthcare professional."

        });

    }


    /* =====================================================
       APPROVED EVIDENCE RETRIEVAL
    ====================================================== */

    const evidence =
        retrieveEvidence(
            cleanMessage
        );

if (
    evidence.length === 0
) {

    try {

        /* =============================================
           LIVE SCHOLARLY RETRIEVAL
        ============================================== */

        const studies =
            await searchPubMed(
                cleanMessage,
                10
            );


        const rankedStudies =
            rankEvidence(
                studies
            )
            .filter(
                study =>
                    study.abstract &&
                    study.abstract.trim()
            );


        if (
            rankedStudies.length === 0
        ) {

            return res.status(200).json({

                success: true,

                route,

                response:
                    "I couldn't find enough usable scholarly evidence to answer that responsibly.",

                evidenceStrength:
                    "INSUFFICIENT",

                sources: [],

                offerVisitPrep:
                    route === "YELLOW"

            });

        }


        const preliminaryStrength =
            getEvidenceStrength(
                rankedStudies
            );


        const synthesis =
            await synthesizeEvidence({

                question:
                    cleanMessage,

                studies:
                    rankedStudies,

                preliminaryStrength

            });


        return res.status(200).json({

            success: true,

            route,

            response:
                synthesis.plainLanguageAnswer ||
                synthesis.summary,

            evidenceStrength:
                synthesis.evidenceStrength,

            agreement:
                synthesis.agreement,

            whatWeKnow:
                synthesis.whatWeKnow,

            whatWeDontKnowYet:
                synthesis.whatWeDontKnowYet,

            limitations:
                synthesis.limitations,

            sources:
                synthesis.sources,

            evidenceSource:
                "LIVE_SCHOLARLY_RETRIEVAL",

            offerVisitPrep:
                route === "YELLOW"

        });

    }

    catch (error) {

        console.error(
            "Live evidence retrieval error:",
            error
        );


        return res.status(200).json({

            success: true,

            route,

            response:
                "I wasn't able to retrieve enough scholarly evidence for that question right now. Please try again.",

            evidenceStrength:
                "INSUFFICIENT",

            sources: [],

            offerVisitPrep:
                route === "YELLOW"

        });

    }

}


    /* =====================================================
       BUILD EVIDENCE CONTEXT
    ====================================================== */

    const evidenceContext =
        evidence
            .map(
                source => {

                    const claims =
                        source.approvedClaims
                            .map(
                                claim =>
                                    `- ${claim}`
                            )
                            .join("\n");


                    return `
SOURCE:
${source.organization} — ${source.title}

EVIDENCE LEVEL:
${source.evidenceLevel}

APPROVED CLAIMS:
${claims}
`;

                }
            )
            .join("\n");


    /* =====================================================
       AI EDUCATION FLOW
    ====================================================== */

    try {

        const aiResponse =
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
                            350,

                        instructions: `
You are Hello, the health education and wellness guide for My Simple Health.

Your role is education, health literacy, self-reflection, behavior-change support, and healthcare self-advocacy.

You may:
- explain general health and wellness concepts
- explain general nutrition, movement, sleep, stress, and public-health information
- support reflection and user-selected goals
- help users formulate questions for healthcare professionals
- explain general medical terminology in plain language

You must not:
- diagnose a person
- prescribe treatment or medication
- recommend changing or stopping medication
- interpret laboratory results as an individualized clinical determination
- provide medical clearance
- replace emergency or professional healthcare

For medical-context questions, clearly distinguish general education from individualized medical advice.

Keep the answer concise, practical, conversational, and easy to understand.

For most questions:
- Begin with a direct 1–2 sentence answer.
- Use short paragraphs.
- Use the bullet character • when a short list would improve clarity.
- Do not use Markdown formatting such as bold, headings, tables, or code formatting.
- Avoid unnecessarily long explanations unless the user asks for more detail.

Do not invent citations or claim that you consulted a source unless source information was actually provided to you.

You are operating in evidence-grounded mode.

Use only the approved evidence supplied with the user's question for factual health claims.

Do not supplement missing evidence from your own memory.

You may reorganize, simplify, and explain the approved evidence in plain language, but you must not expand the claims beyond what the supplied evidence supports.

If the supplied evidence is insufficient, say so.
`,

                        input: `
USER QUESTION:
${cleanMessage}

APPROVED MY SIMPLE HEALTH EVIDENCE:
${evidenceContext}

Answer the user's question using only the approved evidence above.

Do not introduce specific health claims, numerical recommendations, treatment recommendations, or clinical conclusions that are not supported by the approved evidence.

If the evidence does not support part of the question, clearly say that the approved My Simple Health evidence available to you does not address that part.
`

                    })

                }
            );


        const data =
            await aiResponse.json();


        if (!aiResponse.ok) {

            console.error(
                "OpenAI API error:",
                data
            );


            return res.status(502).json({

                success: false,

                message:
                    "Hello could not generate a response right now."

            });

        }


        const outputText =
            extractOutputText(
                data
            );


        if (!outputText) {

            return res.status(502).json({

                success: false,

                message:
                    "Hello did not receive a usable response."

            });

        }


        return res.status(200).json({

            success: true,

            route,

            response:
                outputText,

            sources:
                evidence.map(
                    source => ({
                        id: source.id,
                        organization:
                            source.organization,
                        title:
                            source.title,
                        url:
                            source.url,
                        evidenceLevel:
                            source.evidenceLevel
                    })
                ),

            offerVisitPrep:
                route === "YELLOW"

        });


    }

    catch (error) {

        console.error(
            "Hello backend error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Hello is temporarily unavailable. Please try again."

        });

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


    for (
        const item
        of data.output
    ) {

        if (
            item.type !== "message" ||
            !Array.isArray(item.content)
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


/* =========================================================
   SAFETY / SCOPE CLASSIFIER
========================================================= */

function classifyRequest(message) {

    const text =
        message
            .toLowerCase()
            .trim();


    const medicalEmergencyPatterns = [

        "severe chest pain",
        "crushing chest pain",
        "can't breathe",
        "cannot breathe",
        "difficulty breathing right now",
        "signs of stroke",
        "face drooping",
        "passed out",
        "unconscious",
        "severe allergic reaction",
        "heavy bleeding",
        "severe bleeding"

    ];


    if (
        medicalEmergencyPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "SAFETY_MEDICAL";

    }


    const crisisPatterns = [

        "i want to kill myself",
        "i'm going to kill myself",
        "i am going to kill myself",
        "i want to die",
        "hurt myself right now",
        "harm myself right now",
        "suicidal"

    ];


    if (
        crisisPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "SAFETY_CRISIS";

    }


    const redPatterns = [

        "diagnose me",
        "what disease do i have",
        "tell me what disease i have",
        "do i have cancer",
        "do i have diabetes",
        "do i have depression",
        "interpret my labs",
        "interpret these labs",
        "interpret my bloodwork",
        "change my medication",
        "change my dose",
        "stop my medication",
        "should i stop taking",
        "should i stop my medication",
        "prescribe me",
        "prescribe medication",
        "what dose should i take",
        "am i medically cleared",
        "clear me for exercise",
        "tell me if it is safe for me to exercise"

    ];


    if (
        redPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "RED";

    }


    const yellowPatterns = [

        "i have diabetes",
        "i have hypertension",
        "i have high blood pressure",
        "i have heart disease",
        "i have kidney disease",
        "i have cancer",
        "i am pregnant",
        "i'm pregnant",
        "my medication",
        "my prescription",
        "my lab",
        "my bloodwork",
        "my cholesterol",
        "my glucose",
        "my blood pressure",
        "my doctor said",
        "i was diagnosed",
        "i have anxiety",
        "i have depression",
        "i have an eating disorder"

    ];


    if (
        yellowPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "YELLOW";

    }


    return "GREEN";

}
