import assert from "node:assert/strict";
import test from "node:test";

import { searchPubMed } from "../api/pubmed.js";

import {
    getEvidenceStrength,
    rankEvidence
} from "../api/rankEvidence.js";

import { synthesizeEvidence } from "../api/synthesizeEvidence.js";


async function withMockFetch(
    mockFetch,
    callback
) {

    const originalFetch =
        globalThis.fetch;


    globalThis.fetch =
        mockFetch;


    try {

        return await callback();

    }

    finally {

        globalThis.fetch =
            originalFetch;

    }

}


function jsonResponse(
    data,
    ok = true
) {

    return {
        ok,

        async json() {
            return data;
        }
    };

}


test(
    "non-deployed PubMed and synthesis coverage",
    { concurrency: false },
    async t => {

        await t.test(
            "successful PubMed retrieval and evidence ranking",
            async () => {

                const calls = [];


                const results =
                    await withMockFetch(
                        async url => {

                            const requestUrl =
                                String(url);


                            calls.push(requestUrl);


                            if (requestUrl.includes("esearch.fcgi")) {

                                return jsonResponse({
                                    esearchresult: {
                                        idlist: [
                                            "123",
                                            "456"
                                        ]
                                    }
                                });

                            }


                            if (requestUrl.includes("esummary.fcgi")) {

                                return jsonResponse({
                                    result: {
                                        "123": {
                                            authors: [
                                                { name: "A. Author" }
                                            ],
                                            fulljournalname:
                                                "Journal of Walking",
                                            pubdate:
                                                "2025 Jan",
                                            pubtype: [
                                                "Meta-Analysis"
                                            ],
                                            title:
                                                "Walking after meals: a meta-analysis"
                                        },
                                        "456": {
                                            authors: [
                                                { name: "B. Author" }
                                            ],
                                            pubdate:
                                                "2024",
                                            pubtype: [
                                                "Randomized Controlled Trial"
                                            ],
                                            source:
                                                "Movement Journal",
                                            title:
                                                "A randomized controlled trial of post-meal walking"
                                        }
                                    }
                                });

                            }


                            if (requestUrl.includes("efetch.fcgi")) {

                                return {
                                    ok: true,

                                    async text() {
                                        return `
                                            <PubmedArticle>
                                                <PMID>123</PMID>
                                                <AbstractText Label="BACKGROUND">Walking was studied.</AbstractText>
                                                <AbstractText Label="RESULTS">Post-meal movement was associated with the reported outcome.</AbstractText>
                                            </PubmedArticle>
                                            <PubmedArticle>
                                                <PMID>456</PMID>
                                                <AbstractText>Participants completed a walking intervention.</AbstractText>
                                            </PubmedArticle>
                                        `;
                                    }
                                };

                            }


                            throw new Error(
                                "Unexpected mocked PubMed URL."
                            );

                        },
                        () => searchPubMed(
                            "walking after meals",
                            10
                        )
                    );


                assert.equal(calls.length, 3);
                assert.equal(results.length, 2);
                assert.equal(results[0].pmid, "123");
                assert.equal(results[0].authors[0], "A. Author");
                assert.match(results[0].abstract, /BACKGROUND: Walking was studied\./);
                assert.match(results[0].abstract, /RESULTS: Post-meal movement/);
                assert.equal(
                    results[1].url,
                    "https://pubmed.ncbi.nlm.nih.gov/456/"
                );


                const ranked =
                    rankEvidence(
                        results
                    );


                assert.equal(ranked[0].evidenceDesign, "META_ANALYSIS");
                assert.equal(getEvidenceStrength(ranked), "SUPPORTED");

            }
        );


        await t.test(
            "empty PubMed results stop before metadata or abstract calls",
            async () => {

                let calls = 0;


                const results =
                    await withMockFetch(
                        async () => {

                            calls++;


                            return jsonResponse({
                                esearchresult: {
                                    idlist: []
                                }
                            });

                        },
                        () => searchPubMed(
                            "no matching research",
                            5
                        )
                    );


                assert.deepEqual(results, []);
                assert.equal(calls, 1);

            }
        );


        await t.test(
            "malformed PubMed JSON rejects safely",
            async () => {

                await assert.rejects(
                    withMockFetch(
                        async () => ({
                            ok: true,

                            async json() {
                                throw new SyntaxError(
                                    "mock malformed JSON"
                                );
                            }
                        }),
                        () => searchPubMed(
                            "walking",
                            5
                        )
                    ),
                    SyntaxError
                );

            }
        );


        await t.test(
            "PubMed provider errors reject without additional calls",
            async () => {

                let calls = 0;


                await assert.rejects(
                    withMockFetch(
                        async () => {

                            calls++;


                            return jsonResponse(
                                {
                                    error:
                                        "mock provider error"
                                },
                                false
                            );

                        },
                        () => searchPubMed(
                            "walking",
                            5
                        )
                    ),
                    /PubMed search failed/
                );


                assert.equal(calls, 1);

            }
        );


        await t.test(
            "evidence synthesis parses fenced model JSON",
            async () => {

                const studies = [
                    {
                        abstract:
                            "The study reported a measured improvement after the intervention.",
                        evidenceDesign:
                            "RANDOMIZED_CONTROLLED_TRIAL",
                        journal:
                            "Movement Journal",
                        pmid:
                            "789",
                        publicationDate:
                            "2025",
                        title:
                            "A walking intervention trial",
                        url:
                            "https://pubmed.ncbi.nlm.nih.gov/789/"
                    }
                ];

                let calls = 0;


                const synthesis =
                    await withMockFetch(
                        async (url, options) => {

                            calls++;


                            assert.equal(
                                String(url),
                                "https://api.openai.com/v1/responses"
                            );

                            assert.equal(options.method, "POST");


                            return jsonResponse({
                                output_text: `
                                    \`\`\`json
                                    {
                                        "evidenceStrength": "SUPPORTED",
                                        "agreement": "CONSISTENT",
                                        "summary": "The supplied trial reported a favorable result.",
                                        "limitations": "Only one study was supplied.",
                                        "plainLanguageAnswer": "The study suggests walking may help in the situation it examined.",
                                        "whatWeKnow": "The intervention produced the reported outcome in this study.",
                                        "whatWeDontKnowYet": "Applicability beyond the study remains uncertain.",
                                        "relevantStatistic": null
                                    }
                                    \`\`\`
                                `
                            });

                        },
                        () => synthesizeEvidence({
                            preliminaryStrength:
                                "EMERGING",
                            question:
                                "What does research say about walking?",
                            studies
                        })
                    );


                assert.equal(calls, 1);
                assert.equal(synthesis.evidenceStrength, "SUPPORTED");
                assert.equal(synthesis.agreement, "CONSISTENT");
                assert.match(synthesis.plainLanguageAnswer, /walking may help/);
                assert.match(synthesis.whatWeKnow, /reported outcome/);
                assert.match(synthesis.whatWeDontKnowYet, /uncertain/);
                assert.equal(synthesis.sources.length, 1);
                assert.equal(synthesis.sources[0].pmid, "789");

            }
        );


        await t.test(
            "synthesis returns no-evidence fallback without OpenAI",
            async () => {

                let calls = 0;


                const synthesis =
                    await withMockFetch(
                        async () => {

                            calls++;


                            throw new Error(
                                "OpenAI should not be called."
                            );

                        },
                        () => synthesizeEvidence({
                            preliminaryStrength:
                                "INSUFFICIENT",
                            question:
                                "What does research say?",
                            studies: [
                                {
                                    abstract: "",
                                    pmid: "empty"
                                }
                            ]
                        })
                    );


                assert.equal(calls, 0);
                assert.equal(synthesis.evidenceStrength, "INSUFFICIENT");
                assert.equal(synthesis.agreement, "UNKNOWN");
                assert.deepEqual(synthesis.sources, []);

            }
        );


        await t.test(
            "synthesis rejects provider and malformed model responses",
            async () => {

                const studies = [
                    {
                        abstract: "Usable abstract.",
                        evidenceDesign: "COHORT",
                        journal: "Journal",
                        pmid: "999",
                        publicationDate: "2024",
                        title: "Cohort study",
                        url: "https://pubmed.ncbi.nlm.nih.gov/999/"
                    }
                ];


                await assert.rejects(
                    withMockFetch(
                        async () => jsonResponse(
                            {
                                error:
                                    "mock provider error"
                            },
                            false
                        ),
                        () => synthesizeEvidence({
                            preliminaryStrength: "EMERGING",
                            question: "Question",
                            studies
                        })
                    ),
                    /Evidence synthesis failed/
                );


                await assert.rejects(
                    withMockFetch(
                        async () => jsonResponse({
                            output_text:
                                "not valid JSON"
                        }),
                        () => synthesizeEvidence({
                            preliminaryStrength: "EMERGING",
                            question: "Question",
                            studies
                        })
                    ),
                    /Invalid synthesis output/
                );

            }
        );

    }
);
