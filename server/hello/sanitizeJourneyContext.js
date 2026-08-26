const POSITION_KEYS = new Set([
    "current_picture",
    "desired_direction",
    "chosen_project",
    "practice_experience",
    "reflection",
    "learning",
    "progress",
    "next_decision"
]);

const NAVIGATION_CHOICES = new Set([
    "preserve",
    "explore",
    "develop",
    "adapt",
    "prepare",
    "no_action"
]);

const EPISTEMIC_STATUSES = new Set([
    "USER_STATED",
    "SYSTEM_OBSERVED",
    "MODEL_INFERRED",
    "USER_CONFIRMED"
]);

const LEGACY_STATUSES = new Map([
    ["user_stated", "USER_STATED"],
    ["system_observation", "SYSTEM_OBSERVED"],
    ["model_inference", "MODEL_INFERRED"]
]);

const SOURCE_PREFIXES = [
    "landscape.",
    "assessment.",
    "focus.",
    "vision.",
    "project.",
    "practice.",
    "reflection.",
    "learning.",
    "progress.",
    "returnPoint.",
    "cycle."
];

const KNOWLEDGE_CATEGORIES = new Set([
    "USER_STATED",
    "USER_CHOSEN",
    "ASSESSMENT_RESPONSE",
    "SYSTEM_OBSERVATION",
    "USER_CONFIRMED_LEARNING",
    "MODEL_INFERENCE"
]);
const INFORMATION_CLASSES = new Set(["RECORDED","ESTIMATED_PREDICTED","GENERAL_EDUCATION","PERSONAL_OBSERVATION"]);

function knowledgeCategoryFor(epistemicStatus, source) {
    if (epistemicStatus === "MODEL_INFERRED") return "MODEL_INFERENCE";
    if (epistemicStatus === "SYSTEM_OBSERVED") return "SYSTEM_OBSERVATION";
    if (source.startsWith("assessment.")) return "ASSESSMENT_RESPONSE";
    if (epistemicStatus === "USER_CONFIRMED" && source.startsWith("learning.")) {
        return "USER_CONFIRMED_LEARNING";
    }
    if (
        /(?:\.choice|\.navigationChoice|\.nextStep)$/.test(source) ||
        source === "practice.choice" ||
        source.startsWith("project.")
    ) return "USER_CHOSEN";
    return "USER_STATED";
}

const ACTIVITY_PAGES = new Set([
    "my-health", "landscape", "assessments", "vision", "project",
    "practice", "reflection", "learning", "progress", "calendar", "hello"
]);

const ACTIVITY_TYPES = new Set([
    "workspace_overview", "landscape", "dimension_assessment", "assessment_selection",
    "vision", "project", "practice", "guided_reflection", "reflection", "learning", "progress", "cycle_calendar"
]);

function cleanText(value, limit = 500) {
    return typeof value === "string"
        ? value.trim().replace(/\s+/g, " ").slice(0, limit)
        : "";
}

function cleanIdentifier(value, limit = 160) {
    const cleaned = cleanText(value, limit);
    return /^[A-Za-z0-9._:-]+$/.test(cleaned) ? cleaned : "";
}

function normalizeStatus(value) {
    const cleaned = cleanText(value, 32);
    return LEGACY_STATUSES.get(cleaned) || cleaned;
}

function allowedSource(source, epistemicStatus) {
    if (epistemicStatus === "MODEL_INFERRED") {
        return source === "journey-position";
    }
    return SOURCE_PREFIXES.some(prefix => source.startsWith(prefix));
}

function sanitizeItem(item) {
    if (!item || typeof item !== "object") return null;

    const epistemicStatus = normalizeStatus(item.epistemicStatus);
    const source = cleanText(item.source, 80);
    const value = cleanText(item.text, 500);

    if (!EPISTEMIC_STATUSES.has(epistemicStatus)) return null;
    if (!allowedSource(source, epistemicStatus)) return null;
    if (!value) return null;

    if (epistemicStatus === "MODEL_INFERRED") {
        if (item.requiresConfirmation !== true) return null;
        if (!value.startsWith("One possibility is")) return null;
    }

    return {
        id: cleanIdentifier(item.id) || null,
        epistemicStatus,
        knowledgeCategory: knowledgeCategoryFor(epistemicStatus, source),
        source,
        informationClass: INFORMATION_CLASSES.has(item.informationClass) ? item.informationClass : null,
        text: value,
        recordId: cleanIdentifier(item.recordId, 120) || null,
        recordedAt: cleanText(item.recordedAt, 40) || null,
        confirmed: epistemicStatus === "USER_CONFIRMED",
        requiresConfirmation: epistemicStatus === "MODEL_INFERRED",
        confirmationPrompt: epistemicStatus === "MODEL_INFERRED"
            ? "Does that fit your experience?"
            : null
    };
}

export function sanitizeJourneyContext(value) {
    if (!value || typeof value !== "object") return null;
    if (![1, 2].includes(value.contractVersion)) return null;

    const rawPosition = value.currentPosition && typeof value.currentPosition === "object"
        ? value.currentPosition
        : {};
    const key = cleanText(rawPosition.key, 40);
    if (!POSITION_KEYS.has(key)) return null;

    const navigationChoice = cleanText(rawPosition.navigationChoice, 32);
    const contextItems = Array.isArray(value.contextItems)
        ? value.contextItems.slice(0, 18).map(sanitizeItem).filter(Boolean)
        : [];
    const possibilities = Array.isArray(value.possibilities)
        ? value.possibilities.slice(0, 2).map(sanitizeItem).filter(item => item && item.epistemicStatus === "MODEL_INFERRED")
        : [];

    return {
        contractVersion: 2,
        currentPosition: {
            key,
            label: cleanText(rawPosition.label, 80),
            reason: cleanText(rawPosition.reason, 300),
            epistemicStatus: "SYSTEM_OBSERVED",
            navigationChoice: NAVIGATION_CHOICES.has(navigationChoice) ? navigationChoice : null,
            navigationLabel: NAVIGATION_CHOICES.has(navigationChoice)
                ? cleanText(rawPosition.navigationLabel, 80)
                : null
        },
        contextItems,
        possibilities
    };
}

export function isKnowledgeCategory(value) {
    return KNOWLEDGE_CATEGORIES.has(value);
}

export function buildJourneyPromptContext(value) {
    const context = sanitizeJourneyContext(value);
    if (!context) return "";

    return JSON.stringify(context, null, 2);
}

export function sanitizeActivityContext(value) {
    if (!value || typeof value !== "object") return null;
    const page = cleanText(value.page, 40);
    const activity = cleanText(value.activity, 60);
    if (!ACTIVITY_PAGES.has(page) || !ACTIVITY_TYPES.has(activity)) return null;
    const result = { page, activity };
    const limits = {
        route: 240, visibleActivity: 200,
        dimension: 100, questionId: 160, questionText: 600,
        nextQuestionId: 160, nextQuestionText: 600, currentResponse: 600,
        construct: 160, interactionState: 40,
        contextId: 160, contextLabel: 200,
        selectedObjectType: 80, selectedObjectId: 160, selectedObjectLabel: 300,
        projectId: 160, projectLabel: 300, milestoneId: 160,
        practiceId: 160, practiceLabel: 300, reflectionId: 160,
        learningId: 160, progressEventId: 160, userSelectedState: 300
    };
    Object.entries(limits).forEach(([key, limit]) => {
        if (value[key] === null && key === "currentResponse") result[key] = null;
        else {
            const cleaned = cleanText(value[key], limit);
            if (cleaned) result[key] = cleaned;
        }
    });
    result.allowedDispositions = Array.isArray(value.allowedDispositions)
        ? value.allowedDispositions
            .map(item => cleanText(item, 24).toUpperCase())
            .filter(item => ["ANSWER", "CONVERSATION", "PAUSE", "RETURN"].includes(item))
            .slice(0, 4)
        : ["CONVERSATION"];
    result.allowedActions = Array.isArray(value.allowedActions)
        ? value.allowedActions
            .map(item => cleanIdentifier(item, 80))
            .filter(Boolean)
            .slice(0, 12)
        : [];
    result.provenance = "SYSTEM_OBSERVED";
    result.recordable = false;
    result.directlyAnsweredCurrentStep = value.directlyAnsweredCurrentStep === true;
    result.confirmationOccurred = value.confirmationOccurred === true;
    result.priorActivityAnswers = value.priorActivityAnswers && typeof value.priorActivityAnswers === "object"
        ? Object.fromEntries(
            Object.entries(value.priorActivityAnswers)
                .slice(0, 12)
                .map(([key, answer]) => [cleanIdentifier(key), cleanText(answer, 600)])
                .filter(([key, answer]) => key && answer)
        )
        : {};
    return result;
}

export function buildActivityPromptContext(value) {
    const context = sanitizeActivityContext(value);
    return context ? JSON.stringify(context, null, 2) : "";
}
