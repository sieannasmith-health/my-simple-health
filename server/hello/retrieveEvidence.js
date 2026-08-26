import { evidenceRegistry } from "./evidence.js";


export function retrieveEvidence(message) {

    const text =
        message
            .toLowerCase()
            .trim();


    const matches =
        evidenceRegistry
            .map(source => {

                const score =
                    source.keywords.reduce(
                        (total, keyword) => {

                            if (
                                text.includes(
                                    keyword.toLowerCase()
                                )
                            ) {

                                return total + 1;

                            }

                            return total;

                        },
                        0
                    );


                return {
                    ...source,
                    score
                };

            })
            .filter(
                source =>
                    source.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );


    return matches.slice(0, 3);

}
