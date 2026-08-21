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


export default async function handler(
    req,
    res
) {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );


    try {

        const query =
            req.query.q ||
            "walking after meals blood glucose";


        /* =========================================
           1. SEARCH PUBMED
        ========================================== */

        const studies =
            await searchPubMed(
                query,
                10
            );


        /* =========================================
           2. RANK EVIDENCE
        ========================================== */

        const rankedStudies =
            rankEvidence(
                studies
            );


        /* =========================================
           3. PRELIMINARY STRENGTH
        ========================================== */

        const preliminaryStrength =
            getEvidenceStrength(
                rankedStudies
            );


        /* =========================================
           4. SYNTHESIZE ABSTRACTS
        ========================================== */

        const synthesis =
            await synthesizeEvidence({

                question:
                    query,

                studies:
                    rankedStudies,

                preliminaryStrength

            });


        /* =========================================
           5. RETURN COMPLETE RESULT
        ========================================== */

        return res.status(200).json({

            success: true,

            query,

            preliminaryStrength,

            finalEvidenceStrength:
                synthesis.evidenceStrength,

            agreement:
                synthesis.agreement,

            summary:
                synthesis.summary,

            limitations:
                synthesis.limitations,
            
plainLanguageAnswer:
    synthesis.plainLanguageAnswer,

whatWeKnow:
    synthesis.whatWeKnow,

whatWeDontKnowYet:
    synthesis.whatWeDontKnowYet,
            sources:
                synthesis.sources

        });


    }

    catch (error) {

        console.error(
            "Synthesis test error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Research synthesis failed."

        });

    }

}
