import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizeEvent, classifyFailure, handlePayload, parseAddress, verifySlackSignature } from '../api/slack-events.js';

const env = { MSH_SLACK_TEAM_ID: 'T1', MSH_SLACK_ALLOWED_CHANNELS: 'C0C0T9F3LUF', MSH_SLACK_ALLOWED_USERS: 'U_SIEA,U_BRANDON' };
const names = ['Nomy','Selah','Sage','Clara','Mira','Eden','Vera','Aiden','Ellis','Genesis','Newton','Harper','June','Atlas','Reese','Iris','Tessa'];
const event = (text = 'Iris: summarize the research plan', user_id = 'U_SIEA') => ({ event_id: crypto.randomUUID(), team_id: 'T1', event: { type: 'message', user_id, channel_id: 'C0C0T9F3LUF', ts: '123.456', text } });
const store = () => { const seen = new Set(); return { claim: async (key) => !seen.has(key) && (seen.add(key), true) }; };

test('rejects invalid, stale, malformed, and replayed requests', async () => { const body = '{}'; const timestamp = String(Math.floor(Date.now()/1000)); const signature = `v0=${crypto.createHmac('sha256','secret').update(`v0:${timestamp}:${body}`).digest('hex')}`; assert.equal(verifySlackSignature({body,timestamp,signature,secret:'secret'}),true); assert.equal(verifySlackSignature({body,timestamp:'1',signature,secret:'secret'}),false); assert.equal(parseAddress('Iris hello').ok,false); const item=event(); const s=store(); await handlePayload(item,{env,runtime:async()=> 'ok',publisher:async()=>{},idempotencyStore:s}); assert.equal((await handlePayload(item,{env,runtime:async()=> 'bad',idempotencyStore:s})).body.duplicate,true); });

test('routes every registered agent and Everyone to Nomy', () => { for (const name of names) assert.equal(parseAddress(`${name}: hello`).ok,true); assert.equal(parseAddress('Everyone: coordinate').key,'nomy'); assert.equal(parseAddress('Unknown: hello').ok,false); });

test('enforces every authorization dimension for Siea and Brandon', () => { for (const user_id of ['U_SIEA','U_BRANDON']) assert.equal(authorizeEvent({team_id:'T1',channel_id:'C0C0T9F3LUF',user_id},env).ok,true); for (const value of [{team_id:'T2',channel_id:'C0C0T9F3LUF',user_id:'U_SIEA'},{team_id:'T1',channel_id:'CNO',user_id:'U_SIEA'},{team_id:'T1',channel_id:'C0C0T9F3LUF',user_id:'U_BAD'}]) assert.equal(authorizeEvent(value,env).ok,false); });

test('fails closed for sensitive content and durable mutation without invoking runtime', async () => { let called=false; for (const text of ['Iris: my diagnosis is private','Nomy: merge the GitHub pull request']) { const result=await handlePayload(event(text),{env,runtime:async()=>{called=true}}); assert.equal(result.body.denied,true); } assert.equal(called,false); });

test('publishes attributed threaded reply and audit contains no body', async () => { const calls=[]; const audits=[]; const result=await handlePayload(event(),{env,idempotencyStore:store(),runtime:async(input)=>{calls.push(input);return 'answer'},publisher:async(input)=>calls.push(input),audit:(entry)=>audits.push(entry)}); assert.equal(result.status,200); assert.match(calls[1].text,/^\\*Iris \| Research & Insights\\*/); assert.equal(calls[1].thread,'123.456'); assert.equal(Object.hasOwn(audits[0],'message_body'),false); assert.equal(calls[0].prompt,'summarize the research plan'); });

test('classifies transient and permanent failures', () => { assert.equal(classifyFailure(Object.assign(new Error(),{status:503})).retry,true); assert.equal(classifyFailure(Object.assign(new Error(),{status:403})).retry,false); });
