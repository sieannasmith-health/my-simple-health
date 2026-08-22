import assert from "node:assert/strict";
import test from "node:test";

import handler from "../api/hello.js";

import {
    consumeRateLimit,
    DEFAULT_NORMAL_LIMIT,
    DEFAULT_RESEARCH_LIMIT,
    DEFAULT_WINDOW_SECONDS,
    getClientIdentityHash,
    getRateLimitConfiguration
} from "../api/rateLimit.js";


const MANAGED_ENVIRONMENT_KEYS = [
    "HELLO_ALLOWED_ORIGINS",
    "HELLO_RATE_LIMIT_NORMAL_MAX",
    "HELLO_RATE_LIMIT_RESEARCH_MAX",
    "HELLO_RATE_LIMIT_SECRET",
    "HELLO_RATE_LIMIT_WINDOW_SECONDS",
    "KV_REST_API_TOKEN",
    "KV_REST_API_URL",
    "NODE_ENV",
    "VERCEL",
    "VERCEL_BRANCH_URL",
    "VERCEL_ENV",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL"
];

const TEST_SECRET =
    "test-only-rate-limit-secret-with-at-least-32-characters";

const TEST_REDIS_URL =
    "https://mock-upstash.example";

const originalEnvironment =
    Object.fromEntries(
        MANAGED_ENVIRONMENT_KEYS.map(
            key => [key, process.env[key]]
        )
    );

const originalFetch =
    globalThis.fetch;

const originalConsoleError =
    console.error;


function setEnvironment(overrides = {}) {

    for (const key of MANAGED_ENVIRONMENT_KEYS) {
        delete process.env[key];
    }


    Object.assign(
        process.env,
        {
            HELLO_RATE_LIMIT_SECRET:
                TEST_SECRET,
            KV_REST_API_TOKEN:
                "mock-token",
            KV_REST_API_URL:
                TEST_REDIS_URL,
            NODE_ENV:
                "production",
            VERCEL:
                "1",
            VERCEL_ENV:
                "production"
        },
        overrides
    );

}


function restoreEnvironment() {

    for (const key of MANAGED_ENVIRONMENT_KEYS) {

        if (originalEnvironment[key] === undefined) {
            delete process.env[key];
        }

        else {
            process.env[key] =
                originalEnvironment[key];
        }

    }

}


function createResponse() {

    return {
        body: undefined,
        ended: false,
        headers: {},
        statusCode: 200,

        end() {
            this.ended = true;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        },

        setHeader(name, value) {
            this.headers[name.toLowerCase()] =
                value;
        },

        status(code) {
            this.statusCode = code;
            return this;
        }
    };

}


function createMockNetwork({
    redisUnavailable = false,
    providerUnavailable = false
} = {}) {

    const counters =
        new Map();

    const calls = [];


    const fetchImplementation =
        async (url, options = {}) => {

            const requestUrl =
                String(url);

            const call = {
                body:
                    options.body,
                headers:
                    options.headers,
                url:
                    requestUrl
            };


            calls.push(call);


            if (requestUrl === TEST_REDIS_URL) {

                call.type =
                    "redis";


                if (redisUnavailable) {
                    throw new Error("mock redis unavailable");
                }


                const command =
                    JSON.parse(
                        options.body
                    );


                assert.equal(
                    command[0],
                    "EVAL"
                );


                const key =
                    command[3];

                const limit =
                    Number(command[4]);

                const expiration =
                    Number(command[5]);

                const current =
                    counters.get(key) || 0;

                const allowed =
                    current < limit;

                const next =
                    allowed
                        ? current + 1
                        : current;


                counters.set(
                    key,
                    next
                );


                return {
                    ok: true,

                    async json() {
                        return {
                            result: [
                                allowed ? 1 : 0,
                                next,
                                expiration
                            ]
                        };
                    }
                };

            }


            call.type =
                requestUrl.includes("api.openai.com")
                    ? "openai"
                    : "external";


            if (providerUnavailable) {

                return {
                    ok: false,

                    async json() {
                        return {
                            error:
                                "mock provider detail that must not be logged"
                        };
                    }
                };

            }


            return {
                ok: true,

                async json() {
                    return {
                        output_text:
                            "Mock Hello response"
                    };
                }
            };

        };


    return {
        calls,
        counters,
        fetchImplementation
    };

}


async function invokeHello({
    body = {},
    contentLength,
    contentType = "application/json",
    forwardedFor = "203.0.113.10",
    method = "POST",
    network = createMockNetwork(),
    origin,
    remoteAddress = "127.0.0.1",
    vercelForwardedFor
} = {}) {

    globalThis.fetch =
        network.fetchImplementation;


    const headers = {};


    if (contentType !== null) {
        headers["content-type"] =
            contentType;
    }


    if (contentLength !== undefined) {
        headers["content-length"] =
            String(contentLength);
    }


    if (forwardedFor !== null) {
        headers["x-forwarded-for"] =
            forwardedFor;
    }


    if (vercelForwardedFor !== undefined) {
        headers["x-vercel-forwarded-for"] =
            vercelForwardedFor;
    }


    if (origin !== undefined) {
        headers.origin =
            origin;
    }


    const request = {
        body,
        headers,
        method,
        socket: {
            remoteAddress
        }
    };

    const response =
        createResponse();


    await handler(
        request,
        response
    );


    return {
        network,
        request,
        response
    };

}


function callsOfType(
    network,
    type
) {

    return network.calls.filter(
        call => call.type === type
    );

}


test(
    "durable Hello limiter and regressions",
    { concurrency: false },
    async t => {

        await t.test(
            "default and configured limits are explicit",
            () => {

                setEnvironment();


                const defaults =
                    getRateLimitConfiguration();


                assert.equal(
                    defaults.normalLimit,
                    DEFAULT_NORMAL_LIMIT
                );

                assert.equal(
                    defaults.researchLimit,
                    DEFAULT_RESEARCH_LIMIT
                );

                assert.equal(
                    defaults.windowSeconds,
                    DEFAULT_WINDOW_SECONDS
                );


                setEnvironment({
                    HELLO_RATE_LIMIT_NORMAL_MAX:
                        "7",
                    HELLO_RATE_LIMIT_RESEARCH_MAX:
                        "2",
                    HELLO_RATE_LIMIT_WINDOW_SECONDS:
                        "30"
                });


                const configured =
                    getRateLimitConfiguration();


                assert.equal(configured.normalLimit, 7);
                assert.equal(configured.researchLimit, 2);
                assert.equal(configured.windowSeconds, 30);

            }
        );


        await t.test(
            "normal requests pass below 20 and stop at 21",
            async () => {

                setEnvironment();


                const network =
                    createMockNetwork();


                for (
                    let index = 0;
                    index < DEFAULT_NORMAL_LIMIT;
                    index++
                ) {

                    const result =
                        await invokeHello({
                            body: {
                                message:
                                    "Help me organize my week."
                            },
                            network
                        });


                    assert.equal(
                        result.response.statusCode,
                        200
                    );

                }


                const limited =
                    await invokeHello({
                        body: {
                            message:
                                "Help me organize my week."
                        },
                        network
                    });


                assert.equal(
                    limited.response.statusCode,
                    429
                );

                assert.equal(
                    limited.response.body.code,
                    "RATE_LIMITED"
                );

                assert.ok(
                    Number(limited.response.headers["retry-after"]) > 0
                );

                assert.equal(
                    callsOfType(network, "openai").length,
                    DEFAULT_NORMAL_LIMIT
                );

            }
        );


        await t.test(
            "research requests consume normal and stricter research quotas",
            async () => {

                setEnvironment();


                const network =
                    createMockNetwork();


                for (
                    let index = 0;
                    index < DEFAULT_RESEARCH_LIMIT;
                    index++
                ) {

                    const result =
                        await invokeHello({
                            body: {
                                message:
                                    "What does fiber do?"
                            },
                            network
                        });


                    assert.equal(
                        result.response.statusCode,
                        200
                    );

                }


                const limited =
                    await invokeHello({
                        body: {
                            message:
                                "What does fiber do?"
                        },
                        network
                    });


                assert.equal(
                    limited.response.statusCode,
                    429
                );

                assert.equal(
                    limited.response.body.code,
                    "RESEARCH_RATE_LIMITED"
                );


                const redisCommands =
                    callsOfType(network, "redis")
                        .map(
                            call => JSON.parse(call.body)
                        );

                const normalCommands =
                    redisCommands.filter(
                        command => command[3].includes(":normal:")
                    );

                const researchCommands =
                    redisCommands.filter(
                        command => command[3].includes(":research:")
                    );


                assert.equal(normalCommands.length, 6);
                assert.equal(researchCommands.length, 6);
                assert.equal(callsOfType(network, "openai").length, 5);

            }
        );


        await t.test(
            "separate canonical client identities receive separate quotas",
            async () => {

                setEnvironment({
                    HELLO_RATE_LIMIT_NORMAL_MAX:
                        "1"
                });


                const network =
                    createMockNetwork();


                const first =
                    await invokeHello({
                        body: {
                            message:
                                "Help me organize my week."
                        },
                        network,
                        vercelForwardedFor:
                            "203.0.113.10"
                    });

                const second =
                    await invokeHello({
                        body: {
                            message:
                                "Help me organize my week."
                        },
                        network,
                        vercelForwardedFor:
                            "203.0.113.11"
                    });


                assert.equal(first.response.statusCode, 200);
                assert.equal(second.response.statusCode, 200);


                const keys =
                    callsOfType(network, "redis")
                        .map(
                            call => JSON.parse(call.body)[3]
                        );


                assert.equal(new Set(keys).size, 2);


                for (const key of keys) {

                    assert.match(
                        key,
                        /^hello:rl:v1:normal:\d+:[a-f0-9]{64}$/
                    );

                    assert.ok(!key.includes("203.0.113"));

                }

            }
        );


        await t.test(
            "fixed-window bucket expires into a new quota",
            async () => {

                const network =
                    createMockNetwork();

                const identityHash =
                    getClientIdentityHash(
                        {
                            headers: {
                                "x-vercel-forwarded-for":
                                    "203.0.113.20"
                            }
                        },
                        TEST_SECRET,
                        { VERCEL: "1" }
                    );

                const parameters = {
                    fetchImplementation:
                        network.fetchImplementation,
                    identityHash,
                    limit: 1,
                    limiterType: "normal",
                    restToken: "mock-token",
                    restUrl: TEST_REDIS_URL,
                    windowSeconds: 10
                };


                const first =
                    await consumeRateLimit({
                        ...parameters,
                        nowMs: 9999
                    });

                const blocked =
                    await consumeRateLimit({
                        ...parameters,
                        nowMs: 9999
                    });

                const nextWindow =
                    await consumeRateLimit({
                        ...parameters,
                        nowMs: 10000
                    });


                assert.equal(first.allowed, true);
                assert.equal(blocked.allowed, false);
                assert.equal(nextWindow.allowed, true);

            }
        );


        await t.test(
            "concurrent quota checks use one atomic EVAL command each",
            async () => {

                const network =
                    createMockNetwork();

                const identityHash =
                    getClientIdentityHash(
                        {
                            headers: {
                                "x-vercel-forwarded-for":
                                    "203.0.113.25"
                            }
                        },
                        TEST_SECRET,
                        { VERCEL: "1" }
                    );


                const results =
                    await Promise.all(
                        Array.from(
                            { length: 20 },
                            () => consumeRateLimit({
                                fetchImplementation:
                                    network.fetchImplementation,
                                identityHash,
                                limit: 5,
                                limiterType: "normal",
                                nowMs: 5000,
                                restToken: "mock-token",
                                restUrl: TEST_REDIS_URL,
                                windowSeconds: 10
                            })
                        )
                    );


                assert.equal(
                    results.filter(result => result.allowed).length,
                    5
                );

                assert.equal(
                    callsOfType(network, "redis").length,
                    20
                );

            }
        );


        await t.test(
            "missing or malformed trusted IP fails closed",
            async () => {

                setEnvironment();


                for (const forwardedFor of [
                    null,
                    "not-an-ip",
                    "203.0.113.10, 198.51.100.4",
                    [
                        "203.0.113.10",
                        "198.51.100.4"
                    ]
                ]) {

                    const network =
                        createMockNetwork();

                    const result =
                        await invokeHello({
                            body: {
                                message:
                                    "Help me organize my week."
                            },
                            forwardedFor,
                            network,
                            vercelForwardedFor:
                                forwardedFor === null
                                    ? undefined
                                    : forwardedFor
                        });


                    assert.equal(result.response.statusCode, 503);
                    assert.equal(
                        result.response.body.code,
                        "RATE_LIMIT_UNAVAILABLE"
                    );
                    assert.equal(network.calls.length, 0);

                }

            }
        );


        await t.test(
            "Redis unavailable fails closed without provider work",
            async () => {

                setEnvironment();


                const network =
                    createMockNetwork({
                        redisUnavailable: true
                    });

                const result =
                    await invokeHello({
                        body: {
                            message:
                                "What does fiber do?"
                        },
                        network
                    });


                assert.equal(result.response.statusCode, 503);
                assert.equal(
                    result.response.body.code,
                    "RATE_LIMIT_UNAVAILABLE"
                );
                assert.equal(callsOfType(network, "openai").length, 0);
                assert.equal(callsOfType(network, "external").length, 0);

            }
        );


        await t.test(
            "missing or invalid limiter configuration fails closed",
            async () => {

                for (const environment of [
                    {
                        HELLO_RATE_LIMIT_SECRET: ""
                    },
                    {
                        KV_REST_API_URL: ""
                    },
                    {
                        HELLO_RATE_LIMIT_NORMAL_MAX: "0"
                    }
                ]) {

                    setEnvironment(environment);


                    const network =
                        createMockNetwork();

                    const result =
                        await invokeHello({
                            body: {
                                message:
                                    "Help me organize my week."
                            },
                            network
                        });


                    assert.equal(result.response.statusCode, 503);
                    assert.equal(
                        result.response.body.code,
                        "RATE_LIMIT_UNAVAILABLE"
                    );
                    assert.equal(network.calls.length, 0);

                }

            }
        );


        await t.test(
            "urgent safety bypasses unavailable and exhausted paid limits",
            async () => {

                setEnvironment({
                    HELLO_RATE_LIMIT_NORMAL_MAX:
                        "1"
                });


                const unavailableNetwork =
                    createMockNetwork({
                        redisUnavailable: true
                    });

                const medical =
                    await invokeHello({
                        body: {
                            message:
                                "I have severe chest pain"
                        },
                        forwardedFor: null,
                        network:
                            unavailableNetwork
                    });


                assert.equal(medical.response.body.route, "SAFETY_MEDICAL");
                assert.equal(unavailableNetwork.calls.length, 0);


                const exhaustedNetwork =
                    createMockNetwork();


                await invokeHello({
                    body: {
                        message:
                            "Help me organize my week."
                    },
                    network:
                        exhaustedNetwork
                });

                await invokeHello({
                    body: {
                        message:
                            "Help me organize my week."
                    },
                    network:
                        exhaustedNetwork
                });


                const callsBeforeCrisis =
                    exhaustedNetwork.calls.length;

                const crisis =
                    await invokeHello({
                        body: {
                            message:
                                "I want to kill myself"
                        },
                        network:
                            exhaustedNetwork
                    });


                assert.equal(crisis.response.body.route, "SAFETY_CRISIS");
                assert.equal(
                    exhaustedNetwork.calls.length,
                    callsBeforeCrisis
                );

            }
        );


        await t.test(
            "content type, body size, and malformed containers reject before external work",
            async () => {

                setEnvironment();


                const cases = [
                    {
                        contentType: "text/plain",
                        expectedCode: "UNSUPPORTED_MEDIA_TYPE",
                        expectedStatus: 415
                    },
                    {
                        contentLength: 1000000,
                        expectedCode: "PAYLOAD_TOO_LARGE",
                        expectedStatus: 413
                    },
                    {
                        body: {
                            conversation: {},
                            message: "Hello"
                        },
                        expectedCode: "INVALID_REQUEST",
                        expectedStatus: 400
                    },
                    {
                        body: {
                            message: "Hello",
                            profile: "invalid"
                        },
                        expectedCode: "INVALID_REQUEST",
                        expectedStatus: 400
                    }
                ];


                for (const testCase of cases) {

                    const network =
                        createMockNetwork();

                    const result =
                        await invokeHello({
                            body:
                                testCase.body || {
                                    message: "Hello"
                                },
                            contentLength:
                                testCase.contentLength,
                            contentType:
                                testCase.contentType === undefined
                                    ? "application/json"
                                    : testCase.contentType,
                            network
                        });


                    assert.equal(
                        result.response.statusCode,
                        testCase.expectedStatus
                    );

                    assert.equal(
                        result.response.body.code,
                        testCase.expectedCode
                    );

                    assert.equal(network.calls.length, 0);

                }

            }
        );


        await t.test(
            "message and conversation text retain their approved caps",
            async () => {

                setEnvironment();


                const network =
                    createMockNetwork();

                const message =
                    "m".repeat(4100);

                const historyContent =
                    "h".repeat(1600);


                const result =
                    await invokeHello({
                        body: {
                            conversation: [
                                {
                                    role: "user",
                                    content: historyContent
                                }
                            ],
                            message
                        },
                        network
                    });


                assert.equal(result.response.statusCode, 200);


                const providerInput =
                    JSON.parse(
                        callsOfType(network, "openai")[0].body
                    )
                    .input;


                assert.ok(
                    providerInput.includes(
                        `USER MESSAGE:\n${"m".repeat(4000)}\n`
                    )
                );

                assert.ok(
                    !providerInput.includes(
                        "m".repeat(4001)
                    )
                );

                assert.ok(
                    providerInput.includes(
                        `USER: ${"h".repeat(1500)}\n`
                    )
                );

                assert.ok(
                    !providerInput.includes(
                        "h".repeat(1501)
                    )
                );

            }
        );


        await t.test(
            "CORS rejection and method handling precede limiter work",
            async () => {

                setEnvironment();


                const rejectedNetwork =
                    createMockNetwork();

                const rejected =
                    await invokeHello({
                        body: {
                            message:
                                "What does fiber do?"
                        },
                        network:
                            rejectedNetwork,
                        origin:
                            "https://malicious.example"
                    });


                assert.equal(rejected.response.statusCode, 403);
                assert.equal(rejected.response.body.code, "ORIGIN_NOT_ALLOWED");
                assert.equal(rejectedNetwork.calls.length, 0);


                const optionsNetwork =
                    createMockNetwork();

                const options =
                    await invokeHello({
                        contentType: null,
                        method: "OPTIONS",
                        network: optionsNetwork,
                        origin:
                            "https://mysimplehealth.org"
                    });


                assert.equal(options.response.statusCode, 200);
                assert.equal(options.response.ended, true);
                assert.equal(
                    options.response.headers["access-control-allow-origin"],
                    "https://mysimplehealth.org"
                );
                assert.equal(optionsNetwork.calls.length, 0);


                const invalidOptionsNetwork =
                    createMockNetwork();

                const invalidOptions =
                    await invokeHello({
                        contentType: null,
                        method: "OPTIONS",
                        network:
                            invalidOptionsNetwork,
                        origin:
                            "https://malicious.example"
                    });


                assert.equal(invalidOptions.response.statusCode, 403);
                assert.equal(invalidOptionsNetwork.calls.length, 0);


                const methodNetwork =
                    createMockNetwork();

                const method =
                    await invokeHello({
                        method: "GET",
                        network: methodNetwork
                    });


                assert.equal(method.response.statusCode, 405);
                assert.equal(method.response.body.code, "METHOD_NOT_ALLOWED");
                assert.equal(methodNetwork.calls.length, 0);

            }
        );


        await t.test(
            "production, configured, Vercel, local, and missing-origin CORS behavior remains intact",
            async () => {

                const allowedCases = [
                    {
                        environment: {},
                        origin: "https://mysimplehealth.org"
                    },
                    {
                        environment: {},
                        origin: "https://www.mysimplehealth.org"
                    },
                    {
                        environment: {
                            HELLO_ALLOWED_ORIGINS:
                                "https://staging.example.com"
                        },
                        origin: "https://staging.example.com"
                    },
                    {
                        environment: {
                            VERCEL_ENV: "preview",
                            VERCEL_URL:
                                "my-simple-health-git-test-owner.vercel.app"
                        },
                        origin:
                            "https://my-simple-health-git-test-owner.vercel.app"
                    }
                ];


                for (const allowedCase of allowedCases) {

                    setEnvironment(
                        allowedCase.environment
                    );


                    const result =
                        await invokeHello({
                            body: {},
                            origin:
                                allowedCase.origin
                        });


                    assert.equal(result.response.statusCode, 400);
                    assert.equal(
                        result.response.headers["access-control-allow-origin"],
                        allowedCase.origin
                    );
                    assert.equal(result.response.headers.vary, "Origin");

                }


                for (const origin of [
                    "http://localhost:3000",
                    "http://127.0.0.1:5500"
                ]) {

                    setEnvironment({
                        NODE_ENV: "development",
                        VERCEL_ENV: "development"
                    });


                    const result =
                        await invokeHello({
                            body: {},
                            origin
                        });


                    assert.equal(result.response.statusCode, 400);
                    assert.equal(
                        result.response.headers["access-control-allow-origin"],
                        origin
                    );

                }


                setEnvironment();


                const localProduction =
                    await invokeHello({
                        body: {},
                        origin:
                            "http://localhost:3000"
                    });

                assert.equal(localProduction.response.statusCode, 403);


                const missingOrigin =
                    await invokeHello({
                        body: {}
                    });

                assert.equal(missingOrigin.response.statusCode, 400);
                assert.equal(
                    missingOrigin.response.headers["access-control-allow-origin"],
                    undefined
                );

            }
        );


        await t.test(
            "history, Wellness, safety, clinical, evidence, and care contracts remain intact",
            async () => {

                setEnvironment();


                const conversation =
                    Array.from(
                        { length: 12 },
                        (_, index) => ({
                            role:
                                index % 2 === 0
                                    ? "user"
                                    : "assistant",
                            content:
                                `turn-${index}`
                        })
                    );


                conversation.splice(
                    3,
                    0,
                    {
                        role: "system",
                        content: "discard-system"
                    }
                );


                const network =
                    createMockNetwork();

                const contextual =
                    await invokeHello({
                        body: {
                            conversation,
                            message:
                                "Help me organize my week.",
                            profile: {
                                goals: [
                                    "discard-profile-field"
                                ],
                                wellnessContext: {
                                    source:
                                        "wellness-wheel",
                                    selectedDimension:
                                        "Physical Wellness",
                                    selectedScore: 6,
                                    unexpected:
                                        "discard-wellness-field",
                                    wheelScores: {
                                        emotional: 7,
                                        physical: 6,
                                        unexpected: 10
                                    }
                                }
                            }
                        },
                        network
                    });


                assert.equal(contextual.response.statusCode, 200);


                const providerInput =
                    JSON.parse(
                        callsOfType(network, "openai")[0].body
                    )
                    .input;


                assert.ok(!providerInput.includes("USER: turn-0\n"));
                assert.ok(!providerInput.includes("HELLO: turn-1\n"));
                assert.ok(providerInput.includes("USER: turn-2\n"));
                assert.ok(!providerInput.includes("discard-system"));
                assert.ok(!providerInput.includes("discard-profile-field"));
                assert.ok(!providerInput.includes("discard-wellness-field"));
                assert.ok(providerInput.includes("Physical Wellness"));


                for (const [message, route] of [
                    ["I have severe chest pain", "SAFETY_MEDICAL"],
                    ["I want to kill myself", "SAFETY_CRISIS"]
                ]) {

                    const safety =
                        await invokeHello({
                            body: { message },
                            forwardedFor: null,
                            network:
                                createMockNetwork({
                                    redisUnavailable: true
                                })
                        });


                    assert.equal(safety.response.body.route, route);

                }


                for (const message of [
                    "Should I stop my medication?",
                    "You are wrong; diagnose me."
                ]) {

                    const clinical =
                        await invokeHello({
                            body: { message },
                            network:
                                createMockNetwork()
                        });


                    assert.equal(clinical.response.body.route, "RED");
                    assert.equal(clinical.response.body.offerVisitPrep, true);

                }


                const relational =
                    await invokeHello({
                        body: {
                            message:
                                "You are not listening to me."
                        },
                        network:
                            createMockNetwork()
                    });

                assert.equal(relational.response.body.route, "GREEN");
                assert.equal(
                    relational.response.body.conversationIntent,
                    "RELATIONAL"
                );


                const hidden =
                    await invokeHello({
                        body: {
                            message:
                                "What does fiber do?"
                        },
                        network:
                            createMockNetwork()
                    });

                assert.equal(hidden.response.body.evidenceAvailable, true);
                assert.equal(hidden.response.body.showEvidence, false);


                const shown =
                    await invokeHello({
                        body: {
                            message:
                                "Show me the evidence about fiber."
                        },
                        network:
                            createMockNetwork()
                    });

                assert.equal(shown.response.body.showEvidence, true);


                const yellow =
                    await invokeHello({
                        body: {
                            message:
                                "I have diabetes. Help me organize questions for my doctor."
                        },
                        network:
                            createMockNetwork()
                    });

                assert.equal(yellow.response.body.route, "YELLOW");
                assert.equal(yellow.response.body.offerVisitPrep, true);

            }
        );


        await t.test(
            "limiter keys and logs contain no health text, raw IP, or HMAC identity",
            async () => {

                setEnvironment({
                    HELLO_RATE_LIMIT_NORMAL_MAX:
                        "1"
                });


                const logs = [];


                console.error =
                    value => {
                        logs.push(String(value));
                    };


                const network =
                    createMockNetwork();

                const healthMessage =
                    "My private health message";

                const rawIp =
                    "203.0.113.77";


                await invokeHello({
                    body: {
                        message: healthMessage
                    },
                    forwardedFor:
                        rawIp,
                    network,
                    vercelForwardedFor:
                        rawIp
                });


                const limited =
                    await invokeHello({
                        body: {
                            message: healthMessage
                        },
                        forwardedFor:
                            rawIp,
                        network,
                        vercelForwardedFor:
                            rawIp
                    });


                const identityHash =
                    getClientIdentityHash(
                        limited.request,
                        TEST_SECRET,
                        { VERCEL: "1" }
                    );


                const redisBodies =
                    callsOfType(network, "redis")
                        .map(call => call.body)
                        .join("\n");

                const logOutput =
                    logs.join("\n");


                assert.ok(!redisBodies.includes(healthMessage));
                assert.ok(!redisBodies.includes(rawIp));
                assert.ok(!logOutput.includes(healthMessage));
                assert.ok(!logOutput.includes(rawIp));
                assert.ok(!logOutput.includes(identityHash));
                assert.match(logOutput, /"code":"RATE_LIMITED"/);
                assert.ok(limited.response.body.requestId);
                assert.equal(
                    limited.response.headers["x-request-id"],
                    limited.response.body.requestId
                );


                setEnvironment();


                const providerFailureNetwork =
                    createMockNetwork({
                        providerUnavailable: true
                    });


                await invokeHello({
                    body: {
                        message: healthMessage
                    },
                    forwardedFor:
                        rawIp,
                    network:
                        providerFailureNetwork,
                    vercelForwardedFor:
                        rawIp
                });


                const providerFailureLogs =
                    logs.join("\n");


                assert.ok(
                    !providerFailureLogs.includes(
                        "mock provider detail"
                    )
                );

                assert.ok(!providerFailureLogs.includes(healthMessage));
                assert.ok(!providerFailureLogs.includes(rawIp));


                console.error =
                    originalConsoleError;

            }
        );

    }
);


test.after(() => {

    restoreEnvironment();

    globalThis.fetch =
        originalFetch;

    console.error =
        originalConsoleError;

});
