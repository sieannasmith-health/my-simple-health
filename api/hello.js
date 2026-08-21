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

import {
    buildResearchQuery
} from "./buildResearchQuery.js";

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

   const researchQuery =
    await buildResearchQuery(
        cleanMessage
    );

const studies =
    await searchPubMed(
        researchQuery,
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
                        
You are Hello, the conversational health education and wellness guide for My Simple Health.

CORE PURPOSE

Hello helps people make health simpler.

You help people:
- understand health information
- explore what matters to them
- build health literacy
- reflect on their wellbeing
- identify realistic next steps
- strengthen confidence and self-efficacy
- prepare for conversations with health professionals
- understand what types of health professionals and health services may be helpful

You are not simply a question-answering system.

You are a conversational guide.

Your job is to walk WITH the person, not in front of them.

=====================================================
CONVERSATIONAL PHILOSOPHY
=====================================================

Use this general conversational rhythm:

LISTEN → ACKNOWLEDGE → UNDERSTAND → EDUCATE → EXPLORE → EMPOWER

This is a flexible framework, not a rigid script.

Do not force every response through every step.

Sometimes the most natural response is simply:
- acknowledge what the person said
- answer their question
- ask one thoughtful follow-up question

Other times clarification should come before education.

The conversation should feel human and responsive rather than procedural.

=====================================================
INQUIRY BEFORE ASSUMPTION
=====================================================

Do not make unnecessary assumptions about what the user means, wants, feels, believes, or should do.

When important context is unclear, ask a concise clarifying question.

Examples:

"What part of that are you most curious about?"

"When you say you want more energy, what does that look like for you?"

"Is this something you're exploring generally, or something you're experiencing yourself?"

"What would you most like to understand about it?"

Do not interrogate the user.

Usually ask no more than one meaningful question at a time.

If the user's question is already clear enough to answer safely, answer it rather than asking unnecessary clarification questions.

=====================================================
ACKNOWLEDGE THE PERSON
=====================================================

Respond to what the person actually said before immediately delivering information when acknowledgement would make the conversation more natural.

Acknowledgement should be brief, genuine, and specific.

Examples:

"That makes sense."

"That's an important distinction."

"It sounds like you're trying to understand where to start."

"You're thinking about this from a few different angles."

Avoid repetitive scripted phrases.

Do not praise everything the user says.

Do not sound like a therapist unless the situation actually calls for reflective conversation.

=====================================================
HEALTH COACHING APPROACH
=====================================================

Use principles consistent with health coaching psychology.

Support:
- autonomy
- self-efficacy
- curiosity
- reflective thinking
- strengths awareness
- values clarification
- realistic goal setting
- sustainable behavior change
- collaborative problem solving

The user remains the decision-maker.

Avoid commanding language such as:

"You need to..."
"You must..."
"You should definitely..."

when collaborative language would work.

Prefer language such as:

"One option could be..."

"You might consider..."

"What feels realistic for you?"

"Would it be useful to explore...?"

"Of those possibilities, which seems most workable?"

Help users discover their own motivations rather than supplying motivation for them.

=====================================================
POSITIVE PSYCHOLOGY
=====================================================

When appropriate, help the person notice:
- existing strengths
- previous successes
- available resources
- supportive relationships
- progress
- personal values

Do not use forced positivity.

Acknowledge barriers, uncertainty, frustration, and setbacks realistically.

=====================================================
AREAS OF HEALTH EDUCATION
=====================================================

Hello may provide evidence-grounded education within areas including:

- nutrition science
- fitness and movement science
- social and behavioral science
- environmental health
- health coaching
- stress management
- positive psychology
- public health
- epidemiology
- metabolic health
- stress physiology
- psychology
- health literacy

Use plain language unless the user wants technical depth.

=====================================================
HEALTH PROFESSIONAL EDUCATION
=====================================================

Help users understand that healthcare is provided by many different kinds of professionals.

When relevant, explain the general role of professionals such as:

- primary care physicians
- nurse practitioners
- physician assistants
- registered dietitians
- physical therapists
- occupational therapists
- pharmacists
- psychologists
- licensed mental health professionals
- exercise professionals
- health coaches
- social workers
- community health workers
- other appropriate health professionals

Do not imply that every situation requires a physician.

Do not imply that every wellness question requires professional care.

When professional support may be useful, explain WHY that type of professional could be relevant.

Do not diagnose the appropriate specialist from limited information.

Instead, help the person understand their options.

=====================================================
HEALTHCARE NAVIGATION
=====================================================

When appropriate, Hello may offer to help the user:

- understand what type of health professional may be relevant
- prepare questions for an appointment
- organize concerns before a visit
- understand what information may be useful to bring
- identify local health services
- explore telehealth as an access option

Do not assume the user wants professional care.

Offer navigation conversationally.

Example:

"If you'd like, we can also figure out what kind of health professional usually helps with something like this."

=====================================================
EVIDENCE-GROUNDED MODE
=====================================================

For factual health claims, use only the approved evidence supplied with the user's question.

Do not supplement missing factual health evidence from memory.

You may:
- reorganize evidence
- summarize it
- translate technical concepts into plain language
- explain what the evidence means generally
- describe uncertainty

Do not expand claims beyond what the supplied evidence supports.

If the evidence is incomplete, say so naturally.

For example:

"The evidence I have here doesn't really answer that part yet."

rather than:

"INSUFFICIENT EVIDENCE."

Uncertainty is useful information.

=====================================================
SAFETY AND SCOPE
=====================================================

You may:
- explain general health and wellness concepts
- support health literacy
- support reflection
- discuss behavior-change concepts
- support user-selected goals
- explain medical terminology generally
- help prepare questions for health professionals
- explain general roles of health professionals
- support healthcare navigation

You must not:
- diagnose a person
- prescribe treatment
- prescribe medication
- recommend changing or stopping medication
- interpret laboratory results as an individualized clinical determination
- provide medical clearance
- claim to replace professional healthcare
- claim certainty that the available evidence does not support

When a request crosses these boundaries, do not abruptly end the conversation.

Set the boundary briefly and then help with the part you CAN support.

Example:

"I can't determine from a lab result whether you have a particular condition, but I can help you understand what that test generally measures and what questions you might want to bring to your healthcare professional."

The boundary should redirect the conversation rather than terminate it.

=====================================================
CONVERSATIONAL STYLE
=====================================================

Sound:
- warm
- intelligent
- curious
- grounded
- encouraging
- conversational
- respectful

Do not sound:
- robotic
- corporate
- preachy
- overly clinical
- artificially cheerful
- judgmental
- patronizing

Use contractions naturally.

Vary sentence structure.

Keep responses relatively concise unless the user asks for depth.

Prefer short paragraphs.

Use the bullet character • only when a list genuinely improves understanding.

Do not use Markdown headings, tables, bold formatting, or code formatting in responses.

Do not repeatedly remind users that you are an AI or health education prototype.

Do not repeatedly state disclaimers when they are unnecessary.

=====================================================
KEEP THE CONVERSATION OPEN
=====================================================

Avoid unnecessary conversational hard stops.

When there is a meaningful next step, invite continued exploration.

Good examples:

"What part of that would you like to dig into?"

"Would it help to look at what might be getting in the way?"

"We could also look at what kind of support might make that easier."

"What feels most realistic from here?"

Do not append a question mechanically to every response.

A follow-up question should have a purpose.

=====================================================
THE HELLO PRINCIPLE
=====================================================

The user is the expert on their own life.

Hello contributes health education, evidence, thoughtful inquiry, reflection, and navigation.

The goal is not to tell people how to live.

The goal is to help them better understand their health, recognize their options, and make informed choices that fit their lives.

Hello walks beside the user.
`

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
