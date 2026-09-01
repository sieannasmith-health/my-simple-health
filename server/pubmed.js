const BASE =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";


export async function searchPubMed(
    query,
    maxResults = 5
) {

    /* =====================================================
       SEARCH PUBMED
    ====================================================== */

    const searchParams =
        new URLSearchParams({

            db: "pubmed",
            term: query,
            retmode: "json",
            retmax: String(maxResults),
            sort: "relevance",
            tool: "my-simple-health",
            email: process.env.NCBI_EMAIL || ""

        });


    if (process.env.NCBI_API_KEY) {

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


    if (ids.length === 0) {

        return [];

    }


    /* =====================================================
       GET METADATA
    ====================================================== */

    const summaryParams =
        new URLSearchParams({

            db: "pubmed",
            id: ids.join(","),
            retmode: "json",
            tool: "my-simple-health",
            email: process.env.NCBI_EMAIL || ""

        });


    if (process.env.NCBI_API_KEY) {

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


    /* =====================================================
       GET ABSTRACTS
    ====================================================== */

    const fetchParams =
        new URLSearchParams({

            db: "pubmed",
            id: ids.join(","),
            rettype: "abstract",
            retmode: "xml",
            tool: "my-simple-health",
            email: process.env.NCBI_EMAIL || ""

        });


    if (process.env.NCBI_API_KEY) {

        fetchParams.set(
            "api_key",
            process.env.NCBI_API_KEY
        );

    }


    const abstractResponse =
        await fetch(
            `${BASE}/efetch.fcgi?${fetchParams}`
        );


    if (!abstractResponse.ok) {

        throw new Error(
            "PubMed abstract retrieval failed."
        );

    }


    const abstractXML =
        await abstractResponse.text();


    const abstracts =
        extractAbstracts(
            abstractXML,
            ids
        );


    /* =====================================================
       COMBINE EVERYTHING
    ====================================================== */

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

                    abstract:
                        abstracts[id] || "",

                    url:
                        `https://pubmed.ncbi.nlm.nih.gov/${id}/`

                };

            }
        )
        .filter(Boolean);

}


/* =========================================================
   EXTRACT ABSTRACTS FROM PUBMED XML
========================================================= */

function extractAbstracts(
    xml,
    ids
) {

    const results = {};


    for (const id of ids) {

        results[id] = "";

    }


    const articleMatches =
        xml.match(
            /<PubmedArticle[\s\S]*?<\/PubmedArticle>/g
        ) || [];


    for (const articleXML of articleMatches) {

        const pmidMatch =
            articleXML.match(
                /<PMID[^>]*>([\s\S]*?)<\/PMID>/
            );


        if (!pmidMatch) {
            continue;
        }


        const pmid =
            stripXML(
                pmidMatch[1]
            );


        const abstractMatches =
            [
                ...articleXML.matchAll(
                    /<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/g
                )
            ];


        if (abstractMatches.length === 0) {
            continue;
        }


        const pieces =
            abstractMatches
                .map(
                    match => {

                        const attributes =
                            match[1] || "";

                        const body =
                            match[2] || "";


                        const labelMatch =
                            attributes.match(
                                /Label="([^"]+)"/
                            );


                        const label =
                            labelMatch
                                ? decodeXML(
                                    labelMatch[1]
                                )
                                : "";


                        const text =
                            stripXML(body);


                        if (!text) {
                            return "";
                        }


                        return label
                            ? `${label}: ${text}`
                            : text;

                    }
                )
                .filter(Boolean);


        results[pmid] =
            pieces
                .join("\n")
                .trim();

    }


    return results;

}


/* =========================================================
   XML HELPERS
========================================================= */

function stripXML(value) {

    return decodeXML(

        String(value || "")

            .replace(
                /<[^>]+>/g,
                " "
            )

            .replace(
                /\s+/g,
                " "
            )

            .trim()

    );

}


function decodeXML(value) {

    return String(value || "")

        .replace(/&lt;/g, "<")

        .replace(/&gt;/g, ">")

        .replace(/&amp;/g, "&")

        .replace(/&quot;/g, '"')

        .replace(/&#39;/g, "'");

}
