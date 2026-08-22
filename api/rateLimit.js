import {
    createHmac,
    randomUUID
} from "node:crypto";

import { isIP } from "node:net";


export const DEFAULT_NORMAL_LIMIT = 20;

export const DEFAULT_RESEARCH_LIMIT = 5;

export const DEFAULT_WINDOW_SECONDS = 10 * 60;

export const RATE_LIMIT_STORE_TIMEOUT_MS = 1500;


const RATE_LIMIT_SCRIPT = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local ttl = redis.call("PTTL", KEYS[1])
local limit = tonumber(ARGV[1])
local expiration = tonumber(ARGV[2])

if current >= limit then
    if ttl < 0 then
        redis.call("PEXPIRE", KEYS[1], expiration)
        ttl = expiration
    end

    return {0, current, ttl}
end

current = redis.call("INCR", KEYS[1])

if current == 1 then
    redis.call("PEXPIRE", KEYS[1], expiration)
    ttl = expiration
else
    ttl = redis.call("PTTL", KEYS[1])
end

return {1, current, ttl}
`.trim();


export class RateLimitUnavailableError extends Error {

    constructor() {

        super("Rate limiter unavailable.");

        this.name =
            "RateLimitUnavailableError";

    }

}


export function createHelloRequestId() {

    return randomUUID();

}


export function getRateLimitConfiguration(
    environment = process.env
) {

    const normalLimit =
        readPositiveInteger(
            environment.HELLO_RATE_LIMIT_NORMAL_MAX,
            DEFAULT_NORMAL_LIMIT,
            10000
        );

    const researchLimit =
        readPositiveInteger(
            environment.HELLO_RATE_LIMIT_RESEARCH_MAX,
            DEFAULT_RESEARCH_LIMIT,
            10000
        );

    const windowSeconds =
        readPositiveInteger(
            environment.HELLO_RATE_LIMIT_WINDOW_SECONDS,
            DEFAULT_WINDOW_SECONDS,
            86400
        );

    const restUrl =
        normalizeRestUrl(
            environment.KV_REST_API_URL
        );

    const restToken =
        typeof environment.KV_REST_API_TOKEN === "string"
            ? environment.KV_REST_API_TOKEN.trim()
            : "";

    const identitySecret =
        typeof environment.HELLO_RATE_LIMIT_SECRET === "string"
            ? environment.HELLO_RATE_LIMIT_SECRET
            : "";


    if (
        normalLimit === null ||
        researchLimit === null ||
        windowSeconds === null ||
        !restUrl ||
        !restToken ||
        identitySecret.length < 32
    ) {

        throw new RateLimitUnavailableError();

    }


    return {
        normalLimit,
        researchLimit,
        windowSeconds,
        restUrl,
        restToken,
        identitySecret
    };

}


export function getClientIdentityHash(
    request,
    identitySecret,
    environment = process.env
) {

    if (
        typeof identitySecret !== "string" ||
        identitySecret.length < 32
    ) {

        return null;

    }


    const clientIp =
        getCanonicalClientIp(
            request,
            environment
        );


    if (!clientIp) {
        return null;
    }


    return createHmac(
        "sha256",
        identitySecret
    )
    .update(clientIp)
    .digest("hex");

}


export function getCanonicalClientIp(
    request,
    environment = process.env
) {

    if (environment.VERCEL === "1") {

        const hasVercelForwardedFor =
            hasRequestHeader(
                request,
                "x-vercel-forwarded-for"
            );


        if (hasVercelForwardedFor) {

            return canonicalizeIp(
                getRequestHeader(
                    request,
                    "x-vercel-forwarded-for"
                )
            );

        }


        return canonicalizeIp(
            getRequestHeader(
                request,
                "x-forwarded-for"
            )
        );

    }


    const remoteAddress =
        request &&
        request.socket &&
        typeof request.socket.remoteAddress === "string"
            ? request.socket.remoteAddress
            : request &&
                request.connection &&
                typeof request.connection.remoteAddress === "string"
                    ? request.connection.remoteAddress
                    : null;


    return canonicalizeIp(
        remoteAddress
    );

}


export async function consumeRateLimit({
    identityHash,
    limiterType,
    limit,
    windowSeconds,
    restUrl,
    restToken,
    nowMs = Date.now(),
    fetchImplementation = globalThis.fetch
}) {

    if (
        !/^[a-f0-9]{64}$/.test(identityHash || "") ||
        (
            limiterType !== "normal" &&
            limiterType !== "research"
        ) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        !Number.isInteger(windowSeconds) ||
        windowSeconds < 1 ||
        typeof fetchImplementation !== "function"
    ) {

        throw new RateLimitUnavailableError();

    }


    const windowMilliseconds =
        windowSeconds * 1000;

    const bucket =
        Math.floor(
            nowMs /
            windowMilliseconds
        );

    const bucketEnd =
        (bucket + 1) *
        windowMilliseconds;

    const expirationMilliseconds =
        Math.max(
            1,
            bucketEnd - nowMs
        );

    const key =
        `hello:rl:v1:${limiterType}:${bucket}:${identityHash}`;

    const controller =
        typeof AbortController === "function"
            ? new AbortController()
            : null;

    const timeout =
        controller
            ? setTimeout(
                () => controller.abort(),
                RATE_LIMIT_STORE_TIMEOUT_MS
            )
            : null;


    try {

        const response =
            await fetchImplementation(
                restUrl,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${restToken}`,

                        "Content-Type":
                            "application/json"
                    },

                    signal:
                        controller
                            ? controller.signal
                            : undefined,

                    body:
                        JSON.stringify([
                            "EVAL",
                            RATE_LIMIT_SCRIPT,
                            1,
                            key,
                            limit,
                            expirationMilliseconds
                        ])
                }
            );


        if (!response || !response.ok) {
            throw new RateLimitUnavailableError();
        }


        const data =
            await response.json();


        if (
            !data ||
            data.error ||
            !Array.isArray(data.result) ||
            data.result.length < 3
        ) {

            throw new RateLimitUnavailableError();

        }


        const allowed =
            Number(data.result[0]) === 1;

        const count =
            Number(data.result[1]);

        const ttlMilliseconds =
            Number(data.result[2]);


        if (
            !Number.isFinite(count) ||
            !Number.isFinite(ttlMilliseconds)
        ) {

            throw new RateLimitUnavailableError();

        }


        return {
            allowed,
            count,
            limit,
            retryAfterSeconds:
                Math.max(
                    1,
                    Math.ceil(
                        ttlMilliseconds /
                        1000
                    )
                )
        };

    }

    catch (error) {

        if (error instanceof RateLimitUnavailableError) {
            throw error;
        }


        throw new RateLimitUnavailableError();

    }

    finally {

        if (timeout) {
            clearTimeout(timeout);
        }

    }

}


function readPositiveInteger(
    value,
    fallback,
    maximum
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return fallback;

    }


    if (!/^\d+$/.test(String(value))) {
        return null;
    }


    const parsed =
        Number(value);


    if (
        !Number.isSafeInteger(parsed) ||
        parsed < 1 ||
        parsed > maximum
    ) {

        return null;

    }


    return parsed;

}


function normalizeRestUrl(value) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        return null;

    }


    try {

        const url =
            new URL(
                value.trim()
            );


        if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
        ) {

            return null;

        }


        return url.href.replace(/\/$/, "");

    }

    catch {

        return null;

    }

}


function getRequestHeader(
    request,
    name
) {

    if (
        !request ||
        !request.headers
    ) {

        return null;

    }


    const value =
        request.headers[
            name.toLowerCase()
        ];


    return typeof value === "string"
        ? value
        : null;

}


function hasRequestHeader(
    request,
    name
) {

    return Boolean(
        request &&
        request.headers &&
        Object.prototype.hasOwnProperty.call(
            request.headers,
            name.toLowerCase()
        )
    );

}


function canonicalizeIp(value) {

    if (
        typeof value !== "string" ||
        !value.trim() ||
        value.includes(",")
    ) {

        return null;

    }


    const candidate =
        value.trim();

    const version =
        isIP(candidate);


    if (version === 4) {

        return candidate
            .split(".")
            .map(part => String(Number(part)))
            .join(".");

    }


    if (version === 6) {

        try {

            return new URL(
                `http://[${candidate}]/`
            )
            .hostname
            .slice(1, -1)
            .toLowerCase();

        }

        catch {

            return null;

        }

    }


    return null;

}
