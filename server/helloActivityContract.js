const DISPOSITIONS = new Set(["ANSWER", "CONVERSATION", "PAUSE", "RETURN"]);
const STEP_STATUSES = new Set(["PRESERVE", "ADVANCE", "COMPLETE", "NOT_ACTIVE"]);

function cleanText(value, limit = 1200) {
    return typeof value === "string"
        ? value.trim().replace(/\r\n?/g, "\n").slice(0, limit)
        : "";
}

function cleanIdentifier(value) {
    const text = cleanText(value, 160);
    return /^[A-Za-z0-9._:-]+$/.test(text) ? text : "";
}

function parseJsonObject(value) {
    const text = cleanText(value, 12000)
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    if (!text.startsWith("{")) return null;
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : null;
    } catch (_error) {
        return null;
    }
}

export function parseHelloIntelligenceOutput(value) {
    const parsed = parseJsonObject(value);
    if (parsed) {
        return {
            message: cleanText(parsed.message, 4000),
            disposition: DISPOSITIONS.has(parsed.disposition) ? parsed.disposition : "CONVERSATION",
            activityStepStatus: STEP_STATUSES.has(parsed.activity_step_status)
                ? parsed.activity_step_status
                : "PRESERVE",
            nextStep: parsed.next_step && typeof parsed.next_step === "object"
                ? { id:cleanIdentifier(parsed.next_step.id) || null }
                : null,
            knowledgeEvent: parsed.knowledge_event && typeof parsed.knowledge_event === "object"
                ? parsed.knowledge_event
                : null
        };
    }

    // Backward-compatible parsing keeps older providers and tests functional
    // while the runtime contract moves to the unified response object.
    const text = cleanText(value, 5000);
    const match = text.match(/^ACTIVITY_DISPOSITION:\s*(ANSWER|CONVERSATION|PAUSE|RETURN)\s*(?:\r?\n)+/i);
    return {
        message: match ? text.slice(match[0].length).trim() : text,
        disposition: match ? match[1].toUpperCase() : "CONVERSATION",
        activityStepStatus: "PRESERVE",
        nextStep: null,
        knowledgeEvent: null
    };
}

function sanitizeKnowledgeEvent(value, activityContext) {
    if (!value || typeof value !== "object") return null;
    if (!activityContext || activityContext.confirmationOccurred !== true) return null;
    if (value.type !== "USER_CONFIRMED_LEARNING") return null;
    const statement = cleanText(value.statement, 600);
    if (!statement) return null;
    return {
        type: "USER_CONFIRMED_LEARNING",
        statement,
        provenance: "USER_CONFIRMED",
        sourceInferenceId: cleanIdentifier(value.source_inference_id) || null
    };
}

export function validateHelloActivityResponse(result, activityContext, assistantRole = "HELLO") {
    const active = activityContext && activityContext.activity === "guided_reflection";
    const directAnswer = active && activityContext.directlyAnsweredCurrentStep === true;
    const hasNextStep = Boolean(active && activityContext.nextQuestionId);
    const role = String(assistantRole || "HELLO").toUpperCase();

    let disposition = DISPOSITIONS.has(result && result.disposition)
        ? result.disposition
        : "CONVERSATION";
    let activityStepStatus = "NOT_ACTIVE";
    let nextStep = null;

    if (active) {
        activityStepStatus = "PRESERVE";
        const allowed = Array.isArray(activityContext.allowedDispositions)
            ? activityContext.allowedDispositions
            : ["CONVERSATION"];
        if (!allowed.includes(disposition)) disposition = "CONVERSATION";
        if (role !== "PAL" && directAnswer && disposition === "ANSWER") {
            activityStepStatus = hasNextStep ? "ADVANCE" : "COMPLETE";
            nextStep = hasNextStep ? { id:activityContext.nextQuestionId } : null;
        } else if (disposition === "ANSWER") {
            // The model cannot authorize a save when the deterministic guard
            // did not identify a direct answer.
            disposition = "CONVERSATION";
        }
    }

    return {
        message: cleanText(result && result.message, 4000),
        disposition,
        activityStepStatus,
        nextStep,
        knowledgeEvent: sanitizeKnowledgeEvent(result && result.knowledgeEvent, activityContext)
    };
}

export function toClientIntelligenceResponse(value) {
    return {
        message: value.message,
        response: value.message,
        disposition: value.disposition,
        activityDisposition: value.disposition,
        activity_step_status: value.activityStepStatus,
        next_step: value.nextStep,
        knowledge_event: value.knowledgeEvent
    };
}
