export function buildResearchQuery(question) {

    const text =
        String(question || "")
            .toLowerCase()
            .trim();


    /* =========================================
       WALKING / POST-MEAL GLUCOSE
    ========================================== */

    if (
        (
            text.includes("walking") ||
            text.includes("walk")
        ) &&
        (
            text.includes("blood sugar") ||
            text.includes("glucose")
        ) &&
        (
            text.includes("after meal") ||
            text.includes("after meals") ||
            text.includes("post meal") ||
            text.includes("post-meal")
        )
    ) {

        return `
(
    "postprandial glucose"
    OR
    "postprandial glycemia"
    OR
    "blood glucose"
)
AND
(
    walking
    OR
    exercise
    OR
    "physical activity"
)
AND
(
    postprandial
    OR
    postmeal
    OR
    "after meals"
)
        `.replace(/\s+/g, " ").trim();

    }


    /* =========================================
       GENERAL FALLBACK
    ========================================== */

    return question;

}
