const BASE =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";


export async function searchPubMed(
    query,
    maxResults = 5
) {

    const searchParams =
        new URLSearchParams({

            db: "pubmed",

            term: query,

            retmode: "json",

            retmax:
                String(maxResults),

            sort: "relevance",

            tool:
                "my-simple-health",

            email:
                process.env.NCBI_EMAIL || ""

        });


    if (
        process.env.NCBI_API_KEY
    ) {

        searchParams.set(
            "api_key",
            process.env.NCBI_API_KEY
        );

    }


    const searchResponse =
        await fetch(
            `${BASE}/esearch.fcgi?${searchParams}`
        );


    if (!searchResponse.ok) {

        throw new Error(
            "PubMed search failed."
        );

    }


    const searchData =
        await searchResponse.json();


    const ids =
        searchData?.esearchresult?.idlist || [];


    if (
        ids.length === 0
    ) {

        return [];

    }


    const summaryParams =
        new URLSearchParams({

            db: "pubmed",

            id: ids.join(","),

            retmode: "json",

            tool:
                "my-simple-health",

            email:
                process.env.NCBI_EMAIL || ""

        });


    if (
        process.env.NCBI_API_KEY
    ) {

        summaryParams.set(
            "api_key",
            process.env.NCBI_API_KEY
        );

    }


    const summaryResponse =
        await fetch(
            `${BASE}/esummary.fcgi?${summaryParams}`
        );


    if (!summaryResponse.ok) {

        throw new Error(
            "PubMed summary retrieval failed."
        );

    }


    const summaryData =
        await summaryResponse.json();


    return ids
        .map(
            id => {

                const item =
                    summaryData.result?.[id];


                if (!item) {
                    return null;
                }


                return {

                    pmid: id,

                    title:
                        item.title || "",

                    journal:
                        item.fulljournalname ||
                        item.source ||
                        "",

                    publicationDate:
                        item.pubdate || "",

                    authors:
                        Array.isArray(
                            item.authors
                        )
                            ? item.authors
                                .map(
                                    author =>
                                        author.name
                                )
                                .filter(Boolean)
                            : [],

                    publicationTypes:
                        item.pubtype || [],

                    url:
                        `https://pubmed.ncbi.nlm.nih.gov/${id}/`

                };

            }
        )
        .filter(Boolean);

}
