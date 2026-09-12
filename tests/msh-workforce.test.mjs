import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../workforce.html", import.meta.url), "utf8");
const script = await readFile(new URL("../js/msh-workforce.js", import.meta.url), "utf8");
const contract = await readFile(new URL("../docs/MSH_WORKFORCE_PRODUCT_CONTRACT.md", import.meta.url), "utf8");

test("Workforce is a separate employee surface", () => {
  assert.match(html, /MSH Workforce/);
  assert.match(html, /Employee workspace/);
  assert.doesNotMatch(html, /data-msh-page="onboarding"/);
});

test("Workforce declares all five execution types", () => {
  for (const executionType of ["ai", "review", "collaborative", "human_action", "approval"]) {
    assert.match(script, new RegExp(`${executionType}:`));
    assert.match(contract, new RegExp(`\\`${executionType}\\``));
  }
});

test("human attention is separated from AI activity", () => {
  assert.match(html, /What actually needs you/);
  assert.match(html, /AI is handling/);
  assert.match(script, /function humanTasks\(\)/);
  assert.match(script, /function aiTasks\(\)/);
});

test("v0.1 supports local progress without production backend coupling", () => {
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /state\.employee\.xp \+= task\.xp/);
  assert.doesNotMatch(script, /supabase/i);
  assert.doesNotMatch(script, /fetch\s*\(/);
});

test("onboarding and everyday work share the same task model", () => {
  assert.match(script, /campaign: "Onboarding"/);
  assert.match(script, /campaign: "Daily work"/);
  assert.match(script, /function onboardingTasks\(\)/);
});

test("gamification contract rejects surveillance mechanics", () => {
  assert.match(contract, /punitive leaderboards/i);
  assert.match(contract, /hours-online scoring/i);
  assert.match(contract, /activity surveillance/i);
  assert.match(contract, /verified contribution or competency/i);
});

test("Workforce v0.1 contains no member health-data integration", () => {
  assert.doesNotMatch(script, /HealthKit|medical record|diagnosis|medication/i);
  assert.match(contract, /v0\.1 contains no member health data/i);
});
