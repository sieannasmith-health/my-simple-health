import {
    searchPubMed
} from "./pubmed.js";


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
                5
            );


        return res.status(200).json({

            success: true,

            query,

            count:
                results.length,

            results

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
                "PubMed retrieval failed."

        });

    }

}
