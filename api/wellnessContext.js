export const WELLNESS_DIMENSIONS = {
    physical: "Physical Wellness",
    emotional: "Emotional Wellness",
    social: "Social Wellness",
    occupational: "Occupational Wellness",
    financial: "Financial Wellness",
    environmental: "Environmental Wellness",
    intellectual: "Intellectual Wellness",
    spiritual: "Spiritual Wellness"
};


export function sanitizeWellnessContext(profile) {

    if (
        !profile ||
        typeof profile !== "object" ||
        Array.isArray(profile)
    ) {
        return null;
    }


    const context =
        profile.wellnessContext;


    if (
        !context ||
        typeof context !== "object" ||
        Array.isArray(context) ||
        context.source !== "wellness-wheel"
    ) {
        return null;
    }


    const selectedEntry =
        Object.entries(WELLNESS_DIMENSIONS)
            .find(
                ([, name]) =>
                    name === context.selectedDimension
            );


    if (!selectedEntry) {
        return null;
    }


    const [selectedKey] =
        selectedEntry;


    if (!isValidWellnessScore(context.selectedScore)) {
        return null;
    }


    if (
        !context.wheelScores ||
        typeof context.wheelScores !== "object" ||
        Array.isArray(context.wheelScores)
    ) {
        return null;
    }


    const wheelScores = {};


    Object.keys(WELLNESS_DIMENSIONS)
        .forEach(key => {

            const score =
                context.wheelScores[key];


            if (isValidWellnessScore(score)) {
                wheelScores[key] = score;
            }

        });


    if (
        wheelScores[selectedKey] !==
        context.selectedScore
    ) {
        return null;
    }


    return {
        source: "wellness-wheel",
        selectedDimension:
            context.selectedDimension,
        selectedScore:
            context.selectedScore,
        wheelScores
    };

}


export function isWellnessContextRelevantToQuestion(
    question,
    wellnessContext
) {

    if (
        typeof question !== "string" ||
        !wellnessContext
    ) {
        return false;
    }


    const text =
        question
            .toLowerCase()
            .trim();


    if (!text) {
        return false;
    }


    const dimension =
        wellnessContext.selectedDimension
            .toLowerCase();


    const dimensionLabel =
        dimension.replace(
            " wellness",
            ""
        );


    return (
        text.includes("wellness wheel") ||
        text.includes(dimension) ||
        text.includes(`${dimensionLabel} wellness`) ||
        text.includes(`${dimensionLabel} dimension`) ||
        text.includes(`${dimensionLabel} rating`) ||
        text.includes(`${dimensionLabel} score`)
    );

}


function isValidWellnessScore(value) {

    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 10
    );

}
