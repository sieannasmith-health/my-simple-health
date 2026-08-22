import assert from "node:assert/strict";
import test from "node:test";

import {
    filterEvidenceRelevance,
    selectRelevantStudies
} from "../api/filterEvidenceRelevance.js";
import {
    buildResearchQuery
} from "../api/buildResearchQuery.js";
import {
    normalizeHelloPlainText
} from "../api/hello.js";
import {
    deriveResearchConcepts,
    evaluateResearchConceptGate
} from "../api/researchConceptGate.js";
import {
    synthesizeEvidence
} from "../api/synthesizeEvidence.js";


function study(
    title,
    abstract = "Mock abstract with enough detail for screening."
) {

    return {
        pmid: title.replace(/\D/g, "") || "100",
        title,
        abstract,
        evidenceDesign: "Randomized controlled trial",
        journal: "Mock Journal",
        publicationDate: "2025"
    };

}


function result({
    studyNumber,
    score = 90,
    population = "DIRECT",
    intervention = "DIRECT",
    outcome = "DIRECT",
    purpose = "DIRECT",
    applicability = "DIRECT"
}) {

    return {
        studyNumber,
        relevanceScore: score,
        populationMatch: population,
        interventionMatch: intervention,
        outcomeMatch: outcome,
        studyPurposeMatch: purpose,
        contextualApplicability: applicability,
        reason: "Mock relevance assessment."
    };

}


test(
    "strict evidence gate rejects tangential and narrowly applicable studies across the benchmark domains",
    () => {

        const benchmarkCases = [
            {
                domain: "Nutrition",
                question: "What does the research say about time-restricted eating and blood pressure in adults?",
                studies: [
                    study("101 Adult time-restricted eating and blood pressure"),
                    study("102 Intermittent fasting for weight and metabolic health"),
                    study("103 Early time-restricted eating in men with prediabetes")
                ],
                screenings: [
                    result({ studyNumber: 1, score: 94 }),
                    result({
                        studyNumber: 2,
                        score: 99,
                        intervention: "BROADER_RELATED",
                        outcome: "TANGENTIAL",
                        purpose: "TANGENTIAL"
                    }),
                    result({
                        studyNumber: 3,
                        score: 96,
                        population: "NARROW_LIMITED",
                        applicability: "LIMITED"
                    })
                ],
                expectedTitle: "101 Adult time-restricted eating and blood pressure"
            },
            {
                domain: "Movement",
                question: "Does walking improve mood in adults?",
                studies: [
                    study("201 Walking and mood in adults"),
                    study("202 Exercise therapy in adults with epilepsy")
                ],
                screenings: [
                    result({ studyNumber: 1 }),
                    result({
                        studyNumber: 2,
                        score: 97,
                        population: "NARROW_LIMITED",
                        applicability: "LIMITED"
                    })
                ],
                expectedTitle: "201 Walking and mood in adults"
            },
            {
                domain: "Sleep",
                question: "Do consistent sleep schedules help adult wellbeing?",
                studies: [
                    study("301 Consistent sleep schedules and adult wellbeing"),
                    study("302 CPAP treatment in severe sleep apnea")
                ],
                screenings: [
                    result({ studyNumber: 1 }),
                    result({
                        studyNumber: 2,
                        score: 98,
                        population: "NARROW_LIMITED",
                        intervention: "MISMATCH",
                        applicability: "LIMITED"
                    })
                ],
                expectedTitle: "301 Consistent sleep schedules and adult wellbeing"
            },
            {
                domain: "Wellbeing",
                question: "Does mindfulness reduce perceived stress in adults?",
                studies: [
                    study("401 Mindfulness and perceived stress in adults"),
                    study("402 Mindfulness during cancer chemotherapy")
                ],
                screenings: [
                    result({ studyNumber: 1 }),
                    result({
                        studyNumber: 2,
                        score: 95,
                        population: "NARROW_LIMITED",
                        applicability: "LIMITED"
                    })
                ],
                expectedTitle: "401 Mindfulness and perceived stress in adults"
            },
            {
                domain: "Prevention",
                question: "Does sunscreen help prevent skin cancer in adults?",
                studies: [
                    study("501 Sunscreen and skin cancer prevention in adults"),
                    study("502 Skin cancer prevention in organ transplant recipients")
                ],
                screenings: [
                    result({ studyNumber: 1 }),
                    result({
                        studyNumber: 2,
                        score: 99,
                        population: "NARROW_LIMITED",
                        applicability: "LIMITED"
                    })
                ],
                expectedTitle: "501 Sunscreen and skin cancer prevention in adults"
            },
            {
                domain: "Emerging wellness",
                question: "Does red-light therapy improve muscle recovery in adults?",
                studies: [
                    study("601 Red-light therapy and muscle recovery in adults"),
                    study("602 Phototherapy for psoriasis severity")
                ],
                screenings: [
                    result({ studyNumber: 1 }),
                    result({
                        studyNumber: 2,
                        score: 96,
                        intervention: "BROADER_RELATED",
                        outcome: "MISMATCH",
                        purpose: "TANGENTIAL"
                    })
                ],
                expectedTitle: "601 Red-light therapy and muscle recovery in adults"
            }
        ];

        for (const benchmark of benchmarkCases) {
            const selected = selectRelevantStudies(
                benchmark.studies,
                benchmark.screenings,
                benchmark.question
            );

            assert.deepEqual(
                selected.map(item => item.title),
                [benchmark.expectedTitle],
                benchmark.domain
            );
        }

    }
);


test(
    "deterministic concept gate rejects the two broad live-failure equivalents even when the model calls them direct",
    () => {

        const question =
            "What does the research say about time-restricted eating and blood pressure in adults?";


        const candidates = [
            {
                ...study(
                    "Effects of DASH diet with or without time-restricted eating in the management of stage 1 primary hypertension"
                ),
                pmid: "38886740",
                abstract:
                    "Adults with stage 1 hypertension were assigned to DASH with or without time-restricted eating. Time-restricted eating plus DASH reduced blood pressure during the trial."
            },
            {
                ...study(
                    "Intermittent fasting strategies and their effects on body weight and cardiometabolic risk factors"
                ),
                pmid: "40533200",
                abstract:
                    "This network meta-analysis evaluated intermittent fasting strategies for body weight and cardiometabolic risk factors in adults. Strategies included time-restricted eating and alternate-day fasting. Time-restricted eating and blood pressure were included among many secondary comparisons."
            },
            {
                ...study(
                    "Intermittent energy restriction compared with continuous energy restriction for body composition and cardiometabolic risk markers"
                ),
                pmid: "37827491",
                abstract:
                    "This review examined intermittent energy restriction, body composition, and general cardiometabolic risk markers in adults. Time-restricted eating was mentioned as one form of intermittent energy restriction. Time-restricted eating and blood pressure were not the review's specific purpose."
            }
        ];


        const selected =
            selectRelevantStudies(
                candidates,
                [
                    result({ studyNumber: 1, score: 92 }),
                    result({ studyNumber: 2, score: 99 }),
                    result({ studyNumber: 3, score: 98 })
                ],
                question
            );


        assert.deepEqual(
            selected.map(item => item.pmid),
            ["38886740"]
        );

        assert.equal(
            selected[0].deterministicConceptGate,
            true
        );

        assert.equal(
            selected[0].populationApplicability,
            "NARROW_RELEVANT"
        );

        assert.match(
            selected[0].applicabilityLimitations[0],
            /people with hypertension/
        );

    }
);


test(
    "TRE and blood-pressure synonyms must be directly present and linked",
    () => {

        const question =
            "What does the research say about time-restricted eating and blood pressure in adults?";


        const cases = [
            {
                name: "TRE plus blood pressure passes",
                study: study(
                    "Time-restricted eating and blood pressure in adults",
                    "Time-restricted eating was evaluated against blood pressure outcomes in adults."
                ),
                passed: true
            },
            {
                name: "TRE plus systolic and diastolic BP passes",
                study: study(
                    "Time-restricted eating in adults",
                    "TRE was evaluated for systolic BP and diastolic BP."
                ),
                passed: true
            },
            {
                name: "TRE without a blood-pressure outcome fails",
                study: study(
                    "Time-restricted eating and body weight in adults",
                    "TRE was evaluated for weight loss and body composition."
                ),
                passed: false
            },
            {
                name: "blood pressure plus general intermittent fasting fails",
                study: study(
                    "Intermittent fasting and blood pressure in adults",
                    "Intermittent fasting was evaluated for blood pressure outcomes."
                ),
                passed: false
            },
            {
                name: "intermittent energy restriction does not substitute for TRE",
                study: study(
                    "Intermittent energy restriction and blood pressure in adults",
                    "Intermittent energy restriction was evaluated for systolic blood pressure."
                ),
                passed: false
            }
        ];


        for (const testCase of cases) {
            const assessment =
                evaluateResearchConceptGate({
                    question,
                    study:
                        testCase.study
                });


            assert.equal(
                assessment.passed,
                testCase.passed,
                testCase.name
            );
        }

    }
);


test(
    "narrow clinical populations pass only with direct concepts and an applicability flag",
    () => {

        const question =
            "What does the research say about time-restricted eating and blood pressure in adults?";


        const directNarrowStudy =
            evaluateResearchConceptGate({
                question,
                study: study(
                    "Time-restricted eating and blood pressure in adults with hypertension",
                    "Adults with hypertension used time-restricted eating, and blood pressure was measured."
                )
            });


        assert.equal(
            directNarrowStudy.passed,
            true
        );

        assert.equal(
            directNarrowStudy.populationApplicability,
            "NARROW_RELEVANT"
        );

        assert.match(
            directNarrowStudy.applicabilityLimitations[0],
            /people with hypertension/
        );


        const narrowButTangential =
            evaluateResearchConceptGate({
                question,
                study: study(
                    "Intermittent fasting in adults with hypertension",
                    "Adults with hypertension used intermittent fasting, and blood pressure was measured."
                )
            });


        assert.equal(
            narrowButTangential.passed,
            false
        );

    }
);


test(
    "adult research questions reject child-only populations",
    () => {

        const assessment =
            evaluateResearchConceptGate({
                question:
                    "Does walking improve mood in adults?",
                study: study(
                    "Walking and mood in children",
                    "Walking improved mood outcomes in children."
                )
            });


        assert.equal(
            assessment.passed,
            false
        );

        assert.equal(
            assessment.populationApplicability,
            "POPULATION_MISMATCH"
        );

    }
);


test(
    "controlled catalog derives structured concepts across all benchmark domains",
    () => {

        const questions = [
            "Does dietary fiber affect cholesterol in adults?",
            "Does walking improve mood in adults?",
            "Do consistent sleep schedules improve wellbeing in adults?",
            "Does mindfulness reduce perceived stress in adults?",
            "Does sunscreen prevent skin cancer in adults?",
            "Does red-light therapy improve muscle recovery in adults?"
        ];


        for (const question of questions) {
            const concepts =
                deriveResearchConcepts(
                    question
                );


            assert.equal(
                concepts.structured,
                true,
                question
            );

            assert.ok(
                concepts.interventions.length > 0,
                question
            );

            assert.ok(
                concepts.outcomes.length > 0,
                question
            );
        }

    }
);


test(
    "strict evidence gate returns at most three unique highest-scoring direct studies and may return none",
    () => {

        const candidates = [1, 2, 3, 4].map(number =>
            study(`${number} Direct study`)
        );

        const selected = selectRelevantStudies(
            candidates,
            [
                result({ studyNumber: 1, score: 82 }),
                result({ studyNumber: 2, score: 97 }),
                result({ studyNumber: 3, score: 91 }),
                result({ studyNumber: 4, score: 88 }),
                result({ studyNumber: 2, score: 80 })
            ]
        );

        assert.deepEqual(
            selected.map(item => item.relevanceScore),
            [97, 91, 88]
        );

        assert.deepEqual(
            selectRelevantStudies(
                candidates,
                [
                    result({
                        studyNumber: 1,
                        score: 99,
                        outcome: "TANGENTIAL"
                    })
                ]
            ),
            []
        );

    }
);


test(
    "relevance model receives the exact live question and the five-axis contract",
    { concurrency: false },
    async () => {

        const originalFetch = globalThis.fetch;
        let requestBody;

        globalThis.fetch = async (_url, options) => {
            requestBody = JSON.parse(options.body);

            return {
                ok: true,
                async json() {
                    return {
                        output_text: JSON.stringify({
                            relevantStudies: [
                                result({ studyNumber: 1 })
                            ]
                        })
                    };
                }
            };
        };

        try {
            const question = "What does the research say about time-restricted eating and blood pressure in adults?";
            const selected = await filterEvidenceRelevance({
                question,
                studies: [
                    study("701 Direct adult TRE blood-pressure study")
                ]
            });

            assert.equal(selected.length, 1);
            assert.match(requestBody.input, new RegExp(question.replace(/[?]/g, "\\?")));
            assert.match(requestBody.instructions, /populationMatch/);
            assert.match(requestBody.instructions, /interventionMatch/);
            assert.match(requestBody.instructions, /outcomeMatch/);
            assert.match(requestBody.instructions, /studyPurposeMatch/);
            assert.match(requestBody.instructions, /contextualApplicability/);
        } finally {
            globalThis.fetch = originalFetch;
        }

    }
);


test(
    "research query instructions preserve population, specific intervention, and outcome",
    { concurrency: false },
    async () => {

        const originalFetch = globalThis.fetch;
        let requestBody;

        globalThis.fetch = async (_url, options) => {
            requestBody = JSON.parse(options.body);

            return {
                ok: true,
                async json() {
                    return {
                        output_text: "(adults) AND (time-restricted eating OR time-restricted feeding) AND (blood pressure OR hypertension)"
                    };
                }
            };
        };

        try {
            const query = await buildResearchQuery(
                "What does the research say about time-restricted eating and blood pressure in adults?"
            );

            assert.match(query, /adults/i);
            assert.match(query, /time-restricted/i);
            assert.match(query, /blood pressure/i);
            assert.match(requestBody.instructions, /population/);
            assert.match(requestBody.instructions, /intervention or exposure/);
            assert.match(requestBody.instructions, /outcome/);
            assert.match(requestBody.instructions, /intermittent fasting should not replace/);
        } finally {
            globalThis.fetch = originalFetch;
        }

    }
);


test(
    "deterministic population limitations are supplied to evidence synthesis",
    { concurrency: false },
    async () => {

        const originalFetch = globalThis.fetch;
        let requestBody;


        globalThis.fetch = async (_url, options) => {
            requestBody = JSON.parse(options.body);


            return {
                ok: true,
                async json() {
                    return {
                        output_text: JSON.stringify({
                            evidenceStrength: "EMERGING",
                            agreement: "LIMITED",
                            summary: "Mock synthesis.",
                            limitations: "Narrow population.",
                            plainLanguageAnswer: "Mock answer.",
                            whatWeKnow: "Mock known finding.",
                            whatWeDontKnowYet: "Mock uncertainty.",
                            relevantStatistic: null
                        })
                    };
                }
            };
        };


        try {
            await synthesizeEvidence({
                question:
                    "What does the research say about time-restricted eating and blood pressure in adults?",
                studies: [
                    {
                        ...study(
                            "Time-restricted eating and blood pressure in adults with hypertension"
                        ),
                        url:
                            "https://pubmed.ncbi.nlm.nih.gov/100/",
                        applicabilityLimitations: [
                            "The study population is limited to people with hypertension; do not silently generalize the finding beyond that population."
                        ]
                    }
                ],
                preliminaryStrength:
                    "EMERGING"
            });


            assert.match(
                requestBody.input,
                /study population is limited to people with hypertension/
            );

            assert.match(
                requestBody.instructions,
                /carry those\s+limitations into the synthesis/
            );
        } finally {
            globalThis.fetch = originalFetch;
        }

    }
);


test(
    "Hello plaintext normalization removes simple Markdown markers without interpreting HTML",
    () => {

        assert.equal(
            normalizeHelloPlainText(
                "You **do not** need __special__ `formatting`. <strong>Safe text</strong>"
            ),
            "You do not need special formatting. <strong>Safe text</strong>"
        );

    }
);
