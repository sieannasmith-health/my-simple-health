import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";

initializeApp();

const db = getFirestore();
const PLAID_CLIENT_ID = defineSecret("PLAID_CLIENT_ID");
const PLAID_SECRET = defineSecret("PLAID_SECRET");

const PLAID_ENVIRONMENTS = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || "https://mysimplehealth.org/plaid/";
const PLAID_WEBHOOK_URL = process.env.PLAID_WEBHOOK_URL ||
  "https://us-central1-my-simple-health-2fd8b.cloudfunctions.net/plaidWebhook";

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
    console.error("Plaid request failed", {
      path,
      status: response.status,
      error_type: payload?.error_type,
      error_code: payload?.error_code,
    });
    throw new HttpsError("unavailable", "Plaid could not complete the request.");
  }
  return payload;
}

function serverItemRef(uid, itemId) {
  return db.collection("mshServerPlaidItems").doc(`${uid}_${itemId}`);
}

function userPlaidRoot(uid) {
  return db.collection("users").doc(uid);
}

async function requireOwnedItem(uid, itemId) {
  if (!itemId) throw new HttpsError("invalid-argument", "A Plaid Item ID is required.");
  const ref = serverItemRef(uid, itemId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) {
    throw new HttpsError("not-found", "This financial connection was not found.");
  }
  return { ref, data: snapshot.data() };
}

async function writeInChunks(operations) {
  for (let start = 0; start < operations.length; start += 450) {
    const batch = db.batch();
    for (const operation of operations.slice(start, start + 450)) operation(batch);
    await batch.commit();
  }
}

function accountData(uid, itemId, account) {
  return {
    ownerUid: uid,
    provider: "plaid",
    itemId,
    accountId: account.account_id,
    name: account.name ?? null,
    officialName: account.official_name ?? null,
    mask: account.mask ?? null,
    type: account.type ?? null,
    subtype: account.subtype ?? null,
    balances: account.balances ?? null,
    verificationStatus: account.verification_status ?? null,
    persistentAccountId: account.persistent_account_id ?? null,
    provenance: "OBSERVED_DATA",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function transactionData(uid, itemId, transaction) {
  return {
    ownerUid: uid,
    provider: "plaid",
    itemId,
    transactionId: transaction.transaction_id,
    accountId: transaction.account_id,
    amount: transaction.amount,
    isoCurrencyCode: transaction.iso_currency_code ?? null,
    unofficialCurrencyCode: transaction.unofficial_currency_code ?? null,
    date: transaction.date ?? null,
    authorizedDate: transaction.authorized_date ?? null,
    datetime: transaction.datetime ?? null,
    authorizedDatetime: transaction.authorized_datetime ?? null,
    name: transaction.name ?? null,
    merchantName: transaction.merchant_name ?? null,
    merchantEntityId: transaction.merchant_entity_id ?? null,
    pending: Boolean(transaction.pending),
    pendingTransactionId: transaction.pending_transaction_id ?? null,
    paymentChannel: transaction.payment_channel ?? null,
    personalFinanceCategory: transaction.personal_finance_category ?? null,
    counterparties: transaction.counterparties ?? [],
    website: transaction.website ?? null,
    logoUrl: transaction.logo_url ?? null,
    location: transaction.location ?? null,
    provenance: "OBSERVED_DATA",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function syncPlaidItemInternal(itemRef) {
  const snapshot = await itemRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Plaid Item not found.");

  const item = snapshot.data();
  const uid = item.ownerUid;
  const itemId = item.itemId;
  const accessToken = item.accessToken;
  let cursor = item.syncCursor || null;
  let hasMore = true;
  let pages = 0;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;
  const root = userPlaidRoot(uid);

  await root.collection("plaidConnections").doc(itemId).set({
    ownerUid: uid,
    provider: "plaid",
    itemId,
    status: "syncing",
    provenance: "USER_CONFIRMED",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    while (hasMore) {
      if (++pages > 100) throw new Error("Plaid sync exceeded the safety page limit.");

      const payload = await callPlaid("/transactions/sync", {
        access_token: accessToken,
        cursor,
        count: 500,
      });

      const operations = [];

      for (const account of payload.accounts ?? []) {
        const ref = root.collection("plaidAccounts").doc(account.account_id);
        operations.push((batch) => batch.set(ref, accountData(uid, itemId, account), { merge: true }));
      }

      for (const transaction of payload.added ?? []) {
        addedCount += 1;
        const ref = root.collection("plaidTransactions").doc(transaction.transaction_id);
        operations.push((batch) => batch.set(ref, transactionData(uid, itemId, transaction), { merge: true }));
      }

      for (const transaction of payload.modified ?? []) {
        modifiedCount += 1;
        const ref = root.collection("plaidTransactions").doc(transaction.transaction_id);
        operations.push((batch) => batch.set(ref, transactionData(uid, itemId, transaction), { merge: true }));
      }

      for (const removed of payload.removed ?? []) {
        removedCount += 1;
        const ref = root.collection("plaidTransactions").doc(removed.transaction_id);
        operations.push((batch) => batch.delete(ref));
      }

      await writeInChunks(operations);
      cursor = payload.next_cursor;
      hasMore = Boolean(payload.has_more);
    }

    await itemRef.set({
      syncCursor: cursor,
      lastSuccessfulSyncAt: FieldValue.serverTimestamp(),
      lastSyncError: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await root.collection("plaidConnections").doc(itemId).set({
      status: "connected",
      lastSuccessfulSyncAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { added: addedCount, modified: modifiedCount, removed: removedCount };
  } catch (error) {
    await itemRef.set({
      lastSyncError: error instanceof Error ? error.message : "sync_failed",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await root.collection("plaidConnections").doc(itemId).set({
      status: "needs_attention",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw error;
  }
}

async function deleteQuery(query) {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

async function verifyPlaidWebhook(req) {
  const signedJwt = req.get("Plaid-Verification");
  if (!signedJwt) return false;

  try {
    const header = decodeProtectedHeader(signedJwt);
    if (header.alg !== "ES256" || typeof header.kid !== "string") return false;

    const keyPayload = await callPlaid("/webhook_verification_key/get", { key_id: header.kid });
    const key = await importJWK(keyPayload.key, "ES256");
    const { payload } = await jwtVerify(signedJwt, key, {
      algorithms: ["ES256"],
      maxTokenAge: "5 min",
    });

    if (typeof payload.iat !== "number" || typeof payload.request_body_sha256 !== "string") return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - payload.iat) > 300) return false;

    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body ?? {}));
    const actualHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const expectedHash = payload.request_body_sha256;
    if (actualHash.length !== expectedHash.length) return false;

    return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
  } catch (error) {
    console.warn("Rejected Plaid webhook", { message: error instanceof Error ? error.message : "verification_failed" });
    return false;
  }
}

export const createPlaidLinkToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    const uid = requireUser(request);
    const payload = await callPlaid("/link/token/create", {
      client_name: "My Simple Health",
      language: "en",
      country_codes: ["US"],
      products: ["transactions"],
      transactions: { days_requested: 730 },
      user: { client_user_id: uid },
      redirect_uri: PLAID_REDIRECT_URI,
      webhook: PLAID_WEBHOOK_URL,
    });
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
    const privateRef = serverItemRef(uid, itemId);

    await privateRef.set({
      ownerUid: uid,
      provider: "plaid",
      itemId,
      accessToken,
      status: "connected",
      provenance: "USER_CONFIRMED",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      syncCursor: null,
      lastSyncError: null,
    }, { merge: false });

    await userPlaidRoot(uid).collection("plaidConnections").doc(itemId).set({
      ownerUid: uid,
      provider: "plaid",
      itemId,
      status: "connected",
      provenance: "USER_CONFIRMED",
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const sync = await syncPlaidItemInternal(privateRef);
    return { itemId, connected: true, sync };
  },
);

export const syncPlaidItem = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    const uid = requireUser(request);
    const itemId = typeof request.data?.itemId === "string" ? request.data.itemId.trim() : "";
    const { ref } = await requireOwnedItem(uid, itemId);
    return { itemId, sync: await syncPlaidItemInternal(ref) };
  },
);

export const disconnectPlaidItem = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (request) => {
    const uid = requireUser(request);
    const itemId = typeof request.data?.itemId === "string" ? request.data.itemId.trim() : "";
    const { ref, data } = await requireOwnedItem(uid, itemId);

    await callPlaid("/item/remove", { access_token: data.accessToken });

    const root = userPlaidRoot(uid);
    await Promise.all([
      deleteQuery(root.collection("plaidAccounts").where("itemId", "==", itemId)),
      deleteQuery(root.collection("plaidTransactions").where("itemId", "==", itemId)),
    ]);
    await root.collection("plaidConnections").doc(itemId).delete();
    await ref.delete();

    return { itemId, disconnected: true };
  },
);

export const plaidWebhook = onRequest(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST").status(405).send("Method Not Allowed");
      return;
    }

    if (!(await verifyPlaidWebhook(req))) {
      res.status(401).send("Invalid webhook signature");
      return;
    }

    const webhookType = req.body?.webhook_type;
    const webhookCode = req.body?.webhook_code;
    const itemId = req.body?.item_id;

    if (webhookType === "TRANSACTIONS" && webhookCode === "SYNC_UPDATES_AVAILABLE" && typeof itemId === "string") {
      const snapshot = await db.collection("mshServerPlaidItems").where("itemId", "==", itemId).limit(1).get();
      if (!snapshot.empty) await syncPlaidItemInternal(snapshot.docs[0].ref);
    }

    res.status(200).json({ received: true });
  },
);
