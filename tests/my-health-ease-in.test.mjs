import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const arrival = fs.readFileSync('ios/MySimpleHealthApp/App/MSHMyHealthEaseInScreen.swift', 'utf8');
const shell = fs.readFileSync('ios/MySimpleHealthApp/App/MSHNativeShell.swift', 'utf8');

test('My Health opens with the ease-in experience rather than the data dashboard', () => {
  assert.match(shell, /case \.myHealth:[\s\S]*MSHMyHealthEaseInScreen\(\)/);
});

test('health data and work are explicit choices from the arrival screen', () => {
  assert.match(arrival, /Explore your health/);
  assert.match(arrival, /Work on something/);
  assert.match(arrival, /MSHMyHealthScreen\(\)/);
  assert.match(arrival, /destination: \.path/);
});

test('arrival screen does not load or render health measurements', () => {
  assert.doesNotMatch(arrival, /MSHMyHealthViewModel/);
  assert.doesNotMatch(arrival, /MSHAppleHealthStatusCard/);
  assert.doesNotMatch(arrival, /MSHHealthDataVisualization/);
});
