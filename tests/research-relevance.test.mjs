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
                benchmark.screenings
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
