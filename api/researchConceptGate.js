/* =========================================================
   MY SIMPLE HEALTH
   DETERMINISTIC RESEARCH CONCEPT GATE

   The model may help judge relevance, but it does not have
   unilateral authority to define direct evidence.
========================================================= */


function concept(
    id,
    terms,
    options = {}
) {
    return Object.freeze({
        id,
        terms: Object.freeze([...terms]),
        requiresFocusedMatch:
            options.requiresFocusedMatch === true,
        broaderTerms:
            Object.freeze(options.broaderTerms || [])
    });
}


export const CONTROLLED_RESEARCH_CONCEPTS =
    Object.freeze({
        interventions: Object.freeze([
            concept(
                "TIME_RESTRICTED_EATING",
                [
                    "time-restricted eating",
                    "time restricted eating",
                    "time-restricted feeding",
                    "time restricted feeding",
                    "TRE",
                    "TRF"
                ],
                {
                    requiresFocusedMatch: true,
                    broaderTerms: [
                        "intermittent fasting",
                        "intermittent energy restriction"
                    ]
                }
            ),
            concept(
                "DIETARY_FIBER",
                [
                    "dietary fiber",
                    "dietary fibre",
                    "fiber intake",
                    "fibre intake"
                ]
            ),
            concept(
                "MEDITERRANEAN_DIET",
                [
                    "Mediterranean diet",
                    "Mediterranean dietary pattern"
                ]
            ),
            concept(
                "WALKING",
                [
                    "walking",
                    "brisk walking"
                ]
            ),
            concept(
                "AEROBIC_EXERCISE",
                [
                    "aerobic exercise",
                    "aerobic training"
                ]
            ),
            concept(
                "RESISTANCE_TRAINING",
                [
                    "resistance training",
                    "strength training"
                ]
            ),
            concept(
                "CONSISTENT_SLEEP_SCHEDULE",
                [
                    "consistent sleep schedule",
                    "consistent sleep schedules",
                    "regular sleep schedule",
                    "regular sleep schedules",
                    "sleep regularity"
                ]
            ),
            concept(
                "MINDFULNESS",
                [
                    "mindfulness",
                    "mindfulness meditation"
                ]
            ),
            concept(
                "SUNSCREEN",
                [
                    "sunscreen",
                    "sun screen"
                ]
            ),
            concept(
                "RED_LIGHT_THERAPY",
                [
                    "red-light therapy",
                    "red light therapy",
                    "photobiomodulation"
                ],
                {
                    requiresFocusedMatch: true
                }
            )
        ]),
        outcomes: Object.freeze([
            concept(
                "BLOOD_PRESSURE",
                [
                    "blood pressure",
                    "systolic blood pressure",
                    "diastolic blood pressure",
                    "systolic BP",
                    "diastolic BP",
                    "hypertension"
                ]
            ),
            concept(
                "MOOD",
                [
                    "mood",
                    "positive affect",
                    "negative affect"
                ]
            ),
            concept(
                "WELLBEING",
                [
                    "wellbeing",
                    "well-being",
                    "quality of life"
                ]
            ),
            concept(
                "PERCEIVED_STRESS",
                [
                    "perceived stress",
                    "stress reduction",
                    "psychological stress"
                ]
            ),
            concept(
                "SLEEP_QUALITY",
                [
                    "sleep quality",
                    "sleep duration",
                    "sleep efficiency"
                ]
            ),
            concept(
                "SKIN_CANCER",
                [
                    "skin cancer",
                    "melanoma",
                    "keratinocyte cancer"
                ]
            ),
            concept(
                "MUSCLE_RECOVERY",
                [
                    "muscle recovery",
                    "muscular recovery",
                    "exercise recovery"
                ]
            ),
            concept(
                "CHOLESTEROL",
                [
                    "cholesterol",
                    "LDL cholesterol",
                    "HDL cholesterol"
                ]
            ),
            concept(
                "BODY_WEIGHT",
                [
                    "body weight",
                    "weight loss",
                    "weight reduction"
                ]
            )
        ])
    });


const ADULT_TERMS = Object.freeze([
    "adult",
    "adults"
]);


const CHILD_TERMS = Object.freeze([
    "child",
    "children",
    "pediatric",
    "paediatric",
    "adolescent",
    "adolescents",
    "teenager",
    "teenagers"
]);


const NARROW_POPULATION_MARKERS = Object.freeze([
    {
        label: "people with hypertension",
        terms: [
            "stage 1 hypertension",
            "adults with hypertension",
            "patients with hypertension",
            "hypertensive adults",
            "hypertensive patients"
        ]
    },
    {
        label: "people with prediabetes or diabetes",
        terms: [
            "adults with prediabetes",
            "people with prediabetes",
            "patients with prediabetes",
            "adults with diabetes",
            "people with diabetes",
            "patients with diabetes"
        ]
    },
    {
        label: "people with overweight or obesity",
        terms: [
            "adults with obesity",
            "people with obesity",
            "patients with obesity",
            "obese adults",
            "adults with overweight",
            "overweight adults"
        ]
    },
    {
        label: "people with cancer",
        terms: [
            "adults with cancer",
            "people with cancer",
            "patients with cancer",
            "cancer survivors",
            "cancer patients"
        ]
    },
    {
        label: "people with epilepsy",
        terms: [
            "adults with epilepsy",
            "people with epilepsy",
            "patients with epilepsy"
        ]
    },
    {
        label: "organ-transplant recipients",
        terms: [
            "organ transplant recipients",
            "transplant recipients"
        ]
    },
    {
        label: "pregnant or postpartum people",
        terms: [
            "pregnant women",
            "pregnant people",
            "pregnancy",
            "postpartum women",
            "postpartum people"
        ]
    }
]);


export function deriveResearchConcepts(
    question
) {
    const normalizedQuestion =
        normalizeConceptText(question);

    const interventions =
        findConcepts(
            normalizedQuestion,
            CONTROLLED_RESEARCH_CONCEPTS.interventions
        );

    const outcomes =
        findConcepts(
            normalizedQuestion,
            CONTROLLED_RESEARCH_CONCEPTS.outcomes
        );

    return {
        structured:
            interventions.length > 0 &&
            outcomes.length > 0,
        interventions,
        outcomes,
        population: {
            adults:
                containsAnyTerm(
                    normalizedQuestion,
                    ADULT_TERMS
                ),
            children:
                containsAnyTerm(
                    normalizedQuestion,
                    CHILD_TERMS
                )
        },
        normalizedQuestion
    };
}


export function evaluateResearchConceptGate({
    question,
    study,
    concepts = null
}) {
    const requiredConcepts =
        concepts ||
        deriveResearchConcepts(question);

    if (!requiredConcepts.structured) {
        return {
            applied: false,
            passed: true,
            interventionMatch: true,
            outcomeMatch: true,
            populationMatch: true,
            populationApplicability: "NOT_ASSESSED",
            applicabilityLimitations: []
        };
    }

    const title =
        normalizeConceptText(
            study && study.title
        );

    const abstract =
        normalizeConceptText(
            study && study.abstract
        );

    const combinedText =
        `${title} ${abstract}`.trim();

    const interventionMatch =
        requiredConcepts.interventions
            .every(item =>
                conceptMatchesText(
                    item,
                    combinedText
                )
            );

    const outcomeMatch =
        requiredConcepts.outcomes
            .every(item =>
                conceptMatchesText(
                    item,
                    combinedText
                )
            );

    const focusedInterventionMatch =
        requiredConcepts.interventions
            .every(item =>
                hasFocusedInterventionMatch(
                    item,
                    title,
                    abstract
                )
            );

    const linkedConceptMatch =
        interventionMatch &&
        outcomeMatch &&
        hasLinkedConceptEvidence(
            title,
            study && study.abstract,
            requiredConcepts
        );

    const populationAssessment =
        assessPopulationApplicability(
            requiredConcepts,
            combinedText
        );

    return {
        applied: true,
        passed:
            interventionMatch &&
            outcomeMatch &&
            focusedInterventionMatch &&
            linkedConceptMatch &&
            populationAssessment.passed,
        interventionMatch,
        outcomeMatch,
        focusedInterventionMatch,
        linkedConceptMatch,
        populationMatch:
            populationAssessment.passed,
        populationApplicability:
            populationAssessment.status,
        applicabilityLimitations:
            populationAssessment.limitations,
        requiredInterventions:
            requiredConcepts.interventions
                .map(item => item.id),
        requiredOutcomes:
            requiredConcepts.outcomes
                .map(item => item.id)
    };
}


function assessPopulationApplicability(
    requiredConcepts,
    studyText
) {
    if (
        requiredConcepts.population.adults &&
        containsAnyTerm(
            studyText,
            CHILD_TERMS
        ) &&
        !containsAnyTerm(
            studyText,
            ADULT_TERMS
        )
    ) {
        return {
            passed: false,
            status: "POPULATION_MISMATCH",
            limitations: []
        };
    }

    const narrowPopulations =
        NARROW_POPULATION_MARKERS
            .filter(marker =>
                containsAnyTerm(
                    studyText,
                    marker.terms
                ) &&
                !containsAnyTerm(
                    requiredConcepts.normalizedQuestion,
                    marker.terms
                )
            );

    if (narrowPopulations.length > 0) {
        return {
            passed: true,
            status: "NARROW_RELEVANT",
            limitations:
                narrowPopulations.map(marker =>
                    `The study population is limited to ${marker.label}; do not silently generalize the finding beyond that population.`
                )
        };
    }

    return {
        passed: true,
        status:
            requiredConcepts.population.adults &&
            containsAnyTerm(
                studyText,
                ADULT_TERMS
            )
                ? "DIRECT"
                : "REASONABLY_APPLICABLE",
        limitations: []
    };
}


function hasLinkedConceptEvidence(
    normalizedTitle,
    abstract,
    requiredConcepts
) {
    const segments = [
        normalizedTitle,
        ...String(abstract || "")
            .split(/[.!?;\n]+/)
            .map(normalizeConceptText)
            .filter(Boolean)
    ];

    const interventionLinked =
        requiredConcepts.interventions
            .every(intervention =>
                segments.some(segment =>
                    conceptMatchesText(
                        intervention,
                        segment
                    ) &&
                    requiredConcepts.outcomes
                        .some(outcome =>
                            conceptMatchesText(
                                outcome,
                                segment
                            )
                        )
                )
            );

    const outcomeLinked =
        requiredConcepts.outcomes
            .every(outcome =>
                segments.some(segment =>
                    conceptMatchesText(
                        outcome,
                        segment
                    ) &&
                    requiredConcepts.interventions
                        .some(intervention =>
                            conceptMatchesText(
                                intervention,
                                segment
                            )
                        )
                )
            );

    return interventionLinked && outcomeLinked;
}


function hasFocusedInterventionMatch(
    item,
    title,
    abstract
) {
    if (!item.requiresFocusedMatch) {
        return true;
    }

    if (conceptMatchesText(item, title)) {
        return true;
    }

    if (
        containsAnyTerm(
            title,
            item.broaderTerms
        )
    ) {
        return false;
    }

    return countConceptMatches(
        item,
        abstract
    ) >= 2;
}


function findConcepts(
    normalizedText,
    catalog
) {
    return catalog.filter(item =>
        conceptMatchesText(
            item,
            normalizedText
        )
    );
}


function conceptMatchesText(
    item,
    normalizedText
) {
    return containsAnyTerm(
        normalizedText,
        item.terms
    );
}


function countConceptMatches(
    item,
    normalizedText
) {
    const normalizedTerms =
        [...new Set(
            item.terms
                .map(normalizeConceptText)
                .filter(Boolean)
        )];

    return normalizedTerms.reduce(
        (total, term) =>
            total +
            countTermMatches(
                normalizedText,
                term
            ),
        0
    );
}


function countTermMatches(
    normalizedText,
    term
) {
    const normalizedTerm =
        normalizeConceptText(term);

    if (
        !normalizedText ||
        !normalizedTerm
    ) {
        return 0;
    }

    const paddedText =
        ` ${normalizedText} `;

    const paddedTerm =
        ` ${normalizedTerm} `;

    let matches = 0;
    let offset = 0;
    let matchIndex =
        paddedText.indexOf(
            paddedTerm,
            offset
        );

    while (matchIndex !== -1) {
        matches += 1;
        offset =
            matchIndex +
            paddedTerm.length;
        matchIndex =
            paddedText.indexOf(
                paddedTerm,
                offset
            );
    }

    return matches;
}


function containsAnyTerm(
    normalizedText,
    terms
) {
    return terms.some(term =>
        countTermMatches(
            normalizedText,
            term
        ) > 0
    );
}


function normalizeConceptText(
    value
) {
    return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
