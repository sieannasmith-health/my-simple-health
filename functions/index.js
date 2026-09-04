import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const PLAID_CLIENT_ID = defineSecret("PLAID_CLIENT_ID");
const PLAID_SECRET = defineSecret("PLAID_SECRET");

const PLAID_ENVIRONMENTS = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

function plaidBaseURL() {
  const environment = process.env.PLAID_ENV || "production";
  const baseURL = PLAID_ENVIRONMENTS[environment];
  if (!baseURL) throw new HttpsError("failed-precondition", "Unsupported Plaid environment.");
  return baseURL;
}

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to connect a financial account.");
  return uid;
}

async function callPlaid(path, body) {
  const response = await fetch(`${plaidBaseURL()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID.value(),
      secret: PLAID_SECRET.value(),
      ...body,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error("Plaid request failed", { path, status: response.status, error_type: payload?.error_type, error_code: payload?.error_code });
    throw new HttpsError("unavailable", "Plaid could not complete the request.");
  }
  return payload;
}

export const createPlaidLinkToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    const uid = requireUser(request);

    const body = {
      client_name: "My Simple Health",
      language: "en",
      country_codes: ["US"],
      products: ["transactions"],
      transactions: { days_requested: 730 },
      user: { client_user_id: uid },
    };

    if (process.env.PLAID_REDIRECT_URI) body.redirect_uri = process.env.PLAID_REDIRECT_URI;
    if (process.env.PLAID_WEBHOOK_URL) body.webhook = process.env.PLAID_WEBHOOK_URL;

    const payload = await callPlaid("/link/token/create", body);
    return { linkToken: payload.link_token, expiration: payload.expiration };
  },
);

export const exchangePlaidPublicToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    const uid = requireUser(request);
    const publicToken = typeof request.data?.publicToken === "string" ? request.data.publicToken.trim() : "";
    if (!publicToken) throw new HttpsError("invalid-argument", "A Plaid public token is required.");

    const payload = await callPlaid("/item/public_token/exchange", { public_token: publicToken });
    const itemId = payload.item_id;
    const accessToken = payload.access_token;

    // This collection is server-owned. Firebase clients must be denied direct access by
    // deployed Firestore rules before real-user connections are enabled.
    await db.collection("mshServerPlaidItems").doc(`${uid}_${itemId}`).set({
      ownerUid: uid,
      provider: "plaid",
      itemId,
      accessToken,
      status: "connected",
      provenance: "USER_CONFIRMED",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      syncCursor: null,
    }, { merge: false });

    // Never return Plaid access tokens to the iOS client.
    return { itemId, connected: true };
  },
);
