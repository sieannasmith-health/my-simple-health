import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const calendar = await readFile(new URL('../calendar.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../js/msh-medication-continuity.js', import.meta.url), 'utf8');

test('Calendar loads the medication continuity workflow', () => {
  assert.match(calendar, /msh-medication-continuity\.css/);
  assert.match(calendar, /msh-medication-continuity\.js/);
});

test('Medication continuity schedules refill outreach as a medication calendar event', () => {
  assert.match(source, /medication_refill_outreach/);
  assert.match(source, /category:\s*'medication'/);
  assert.match(source, /status:\s*'scheduled'/);
  assert.match(source, /requiresUserApproval:\s*true/);
});

test('Refill outreach requires explicit approval and does not claim delivery without an integration', () => {
  assert.match(source, /data-approve-medication-request/);
  assert.match(source, /approved_pending_connection/);
  assert.match(source, /Automatic delivery will use the connected provider channel once that integration is available/);
  assert.match(source, /sentAt:\s*null/);
});

test('Users can defer a due refill request instead of approving it', () => {
  assert.match(source, /data-reschedule-medication-request/);
  assert.match(source, /plusDays\(isoToday\(\), 1\)/);
});
