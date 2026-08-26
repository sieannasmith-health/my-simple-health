import {
    searchPubMed
} from "../server/hello/pubmed.js";

import {
    rankEvidence,
    getEvidenceStrength
} from "../server/hello/rankEvidence.js";


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


        const results =
            await searchPubMed(
                query,
                10
            );


        const rankedResults =
            rankEvidence(
                results
            );


        const evidenceStrength =
            getEvidenceStrength(
                rankedResults
            );


        return res.status(200).json({

            success: true,

            query,

            evidenceStrength,

            count:
                rankedResults.length,

            results:
                rankedResults

        });


    }

    catch (error) {

        console.error(
            "PubMed test error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "PubMed retrieval or ranking failed."

        });

    }

}
