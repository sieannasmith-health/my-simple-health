/* =========================================================
   MY SIMPLE HEALTH
   EVIDENCE RANKING
========================================================= */

export function rankEvidence(studies = []) {

    return studies
        .map(study => {

            const design =
                classifyStudyDesign(
                    study.publicationTypes || [],
                    study.title || ""
                );

            const designScore =
                getDesignScore(design);

            const recencyScore =
                getRecencyScore(
                    study.publicationDate
                );

            const totalScore =
                designScore +
                recencyScore;

            return {
                ...study,

                evidenceDesign:
                    design,

                evidenceScore:
                    totalScore
            };

        })
        .sort(
            (a, b) =>
                b.evidenceScore -
                a.evidenceScore
        );

}


/* =========================================================
   CLASSIFY STUDY DESIGN
========================================================= */

function classifyStudyDesign(
    publicationTypes,
    title
) {

    const types =
        publicationTypes
            .join(" ")
            .toLowerCase();

    const titleText =
        title.toLowerCase();


    if (
        types.includes("meta-analysis") ||
        titleText.includes("meta-analysis")
    ) {

        return "META_ANALYSIS";

    }


    if (
        types.includes("systematic review") ||
        titleText.includes("systematic review")
    ) {

        return "SYSTEMATIC_REVIEW";

    }


    if (
        types.includes("practice guideline") ||
        types.includes("guideline") ||
        titleText.includes("clinical guideline") ||
        titleText.includes("practice guideline")
    ) {

        return "GUIDELINE";

    }


    if (
        types.includes("randomized controlled trial") ||
        titleText.includes("randomized controlled trial") ||
        titleText.includes("randomised controlled trial")
    ) {

        return "RANDOMIZED_CONTROLLED_TRIAL";

    }


    if (
        types.includes("clinical trial")
    ) {

        return "CLINICAL_TRIAL";

    }


    if (
        titleText.includes("prospective cohort") ||
        titleText.includes("cohort study")
    ) {

        return "COHORT";

    }


    if (
        titleText.includes("case-control")
    ) {

        return "CASE_CONTROL";

    }


    if (
        titleText.includes("cross-sectional")
    ) {

        return "CROSS_SECTIONAL";

    }


    if (
        types.includes("case reports") ||
        titleText.includes("case report")
    ) {

        return "CASE_REPORT";

    }


    if (
        types.includes("editorial") ||
        types.includes("comment") ||
        types.includes("letter")
    ) {

        return "COMMENTARY";

    }


    return "OTHER";

}


/* =========================================================
   STUDY DESIGN SCORE
========================================================= */

function getDesignScore(
    design
) {

    const scores = {

        META_ANALYSIS:
            100,

        SYSTEMATIC_REVIEW:
            95,

        GUIDELINE:
            95,

        RANDOMIZED_CONTROLLED_TRIAL:
            80,

        CLINICAL_TRIAL:
            70,

        COHORT:
            55,

        CASE_CONTROL:
            45,

        CROSS_SECTIONAL:
            35,

        OTHER:
            25,

        CASE_REPORT:
            10,

        COMMENTARY:
            0

    };


    return scores[design] ?? 20;

}


/* =========================================================
   RECENCY SCORE
========================================================= */

function getRecencyScore(
    publicationDate
) {

    const yearMatch =
        String(
            publicationDate || ""
        ).match(/\b(19|20)\d{2}\b/);


    if (!yearMatch) {
        return 0;
    }


    const year =
        Number(yearMatch[0]);

    const currentYear =
        new Date().getFullYear();

    const age =
        currentYear - year;


    if (age <= 2) {
        return 10;
    }


    if (age <= 5) {
        return 7;
    }


    if (age <= 10) {
        return 4;
    }


    return 0;

}


/* =========================================================
   EVIDENCE-STRENGTH LABEL
========================================================= */

export function getEvidenceStrength(
    rankedStudies
) {

    if (
        !rankedStudies ||
        rankedStudies.length === 0
    ) {

        return "INSUFFICIENT";

    }


    const designs =
        rankedStudies.map(
            study =>
                study.evidenceDesign
        );


    const hasMetaAnalysis =
        designs.includes(
            "META_ANALYSIS"
        );


    const hasSystematicReview =
        designs.includes(
            "SYSTEMATIC_REVIEW"
        );


    const hasGuideline =
        designs.includes(
            "GUIDELINE"
        );


    const rctCount =
        designs.filter(
            design =>
                design ===
                "RANDOMIZED_CONTROLLED_TRIAL"
        ).length;


    if (
        hasGuideline &&
        (
            hasMetaAnalysis ||
            hasSystematicReview
        )
    ) {

        return "ESTABLISHED";

    }


    if (
        hasMetaAnalysis ||
        hasSystematicReview ||
        rctCount >= 2
    ) {

        return "SUPPORTED";

    }


    if (
        rctCount === 1 ||
        designs.includes("CLINICAL_TRIAL") ||
        designs.includes("COHORT")
    ) {

        return "EMERGING";

    }


    return "INSUFFICIENT";

}
