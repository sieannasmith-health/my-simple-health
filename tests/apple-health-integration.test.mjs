import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = path => fs.readFileSync(new URL(path, root), 'utf8');
function healthRecordsAPI() {
  const sandbox = {window:{}}; sandbox.globalThis=sandbox.window;
  vm.runInNewContext(source('js/msh-health-records.js'), sandbox);
  return sandbox.window.MSHHealthRecords;
}
const sample = (overrides={}) => ({
  id:'apple_health:workout-1', domain:'movement', recordType:'movement.workout', value:null, unit:null,
  eventStart:'2026-08-29T13:00:00Z', eventEnd:'2026-08-29T13:30:00Z', timezoneIdentifier:'America/Indiana/Indianapolis',
  source:{provider:'apple_health',sourceSystem:'healthkit',sourceRecordID:'workout-1',sourceName:'Apple Watch'},
  provenance:'IMPORTED', informationClass:'RECORDED', lifecycleStatus:'ACTIVE', metadata:{activityName:'Walk',durationSeconds:'1800'}, ...overrides
});

test('canonical imported records require source, provenance, time, type, and canonical units', () => {
  const api=healthRecordsAPI();
  assert.equal(api.validate(sample()), true);
  assert.equal(api.validate(sample({provenance:'USER_STATED'})), false);
  assert.equal(api.validate(sample({eventStart:'not-a-date'})), false);
  assert.equal(api.validate(sample({unit:'miles'})), false);
  assert.equal(api.validate(sample({recordType:'diagnosis'})), false);
});

test('deduplication uses provider plus source record ID', () => {
  const api=healthRecordsAPI();
  const records=api.normalize([sample(),sample({id:'replacement',metadata:{activityName:'Run'}})]);
  assert.equal(records.length,1);
  assert.equal(records[0].id,'replacement');
});

test('workouts, sleep, and body mass project into existing Calendar semantics', () => {
  const api=healthRecordsAPI();
  const events=api.calendarEvents([
    sample(),
    sample({id:'sleep',recordType:'sleep.session',unit:'s',value:27000,source:{provider:'apple_health',sourceRecordID:'sleep-1'},metadata:{}}),
    sample({id:'weight',recordType:'body.body_mass',domain:'body',unit:'kg',value:70,source:{provider:'apple_health',sourceRecordID:'weight-1'},metadata:{}})
  ]);
  assert.deepEqual(Array.from(events, event=>event.category),['movement','note','measurement']);
  assert.ok(events.every(event=>event.provenance==='IMPORTED' && event.informationClass==='RECORDED'));
  assert.equal(events[0].source.provider,'apple_health');
});

test('native bridge keeps records in memory and never writes browser storage', async () => {
  const posted=[]; let storageWrites=0;
  const sandbox={
    crypto:{randomUUID:()=> 'request-1'}, CustomEvent:class { constructor(name,options){this.type=name;this.detail=options?.detail;} },
    dispatchEvent(){}, addEventListener(){}, localStorage:{setItem(){storageWrites++;}},
    webkit:{messageHandlers:{mshHealth:{postMessage:value=>posted.push(value)}}}
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  vm.runInNewContext(source('js/msh-health-records.js'),sandbox);
  vm.runInNewContext(source('js/msh-connected-health.js'),sandbox);
  const pending=sandbox.MSHConnectedHealth.connect(['movement']);
  assert.equal(posted[0].action,'connect');
  sandbox.MSHConnectedHealthReceive({requestId:'request-1',state:{available:true,connected:true,status:'connected',selectedAreas:['movement'],records:[sample()],partialFailures:[]}});
  await pending;
  assert.equal(sandbox.MSHConnectedHealth.records().length,1);
  assert.equal(storageWrites,0);
});

test('metadata-only status preserves any explicitly loaded record subset in browser memory', () => {
  const sandbox={
    crypto:{randomUUID:()=> 'request-1'}, CustomEvent:class { constructor(name,options){this.type=name;this.detail=options?.detail;} },
    dispatchEvent(){}, addEventListener(){},
    webkit:{messageHandlers:{mshHealth:{postMessage(){}}}}
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  vm.runInNewContext(source('js/msh-health-records.js'),sandbox);
  vm.runInNewContext(source('js/msh-connected-health.js'),sandbox);
  sandbox.MSHConnectedHealthReceive({state:{available:true,connected:true,status:'connected',selectedAreas:['movement'],records:[sample()],partialFailures:[]}});
  sandbox.MSHConnectedHealthReceive({state:{available:true,connected:true,status:'connected',selectedAreas:['movement'],partialFailures:[],lastAttemptedSyncAt:'2026-08-30T12:00:00Z'}});
  assert.equal(sandbox.MSHConnectedHealth.records().length,1);
  assert.equal(sandbox.MSHConnectedHealth.status().lastAttemptedSyncAt,'2026-08-30T12:00:00Z');
});

test('web code has no direct HealthKit access and Calendar consumes the provider-neutral projection', () => {
  const bridge=source('js/msh-connected-health.js');
  const calendar=source('js/msh-calendar.js');
  assert.doesNotMatch(bridge,/HKHealthStore|HealthKit\.request/);
  assert.match(bridge,/webkit\?\.messageHandlers\?\.mshHealth/);
  assert.match(calendar,/MSHHealthRecords\.calendarEvents\(nativeRangeRecords\)/);
  assert.match(calendar,/MSHConnectedHealth\.calendarRange/);
});

test('native integration is read-only and declares the required privacy purpose', () => {
  const provider=source('ios/MySimpleHealthHealthKit/Sources/MSHAppleHealthKit/AppleHealthKitProvider.swift');
  const info=source('ios/MySimpleHealthApp/App/Info.plist');
  const entitlements=source('ios/MySimpleHealthApp/App/MySimpleHealth.entitlements');
  assert.match(provider,/requestAuthorization\(toShare: \[\], read:/);
  assert.doesNotMatch(provider,/\.save\(/);
  assert.match(info,/NSHealthShareUsageDescription/);
  assert.doesNotMatch(info,/NSHealthUpdateUsageDescription/);
  assert.match(entitlements,/com\.apple\.developer\.healthkit/);
});

test('physical-device Debug uses a LAN server without changing the production URL', () => {
  const server=source('dev-server.js');
  const packageJson=JSON.parse(source('package.json'));
  const scheme=source('ios/MySimpleHealthApp/MySimpleHealth.xcodeproj/xcshareddata/xcschemes/MySimpleHealth.xcscheme');
  const webView=source('ios/MySimpleHealthApp/App/MSHWebView.swift');

  assert.equal(packageJson.scripts['dev:device'],'MSH_DEV_HOST=0.0.0.0 MSH_DEV_PORT=43128 node dev-server.js');
  assert.match(server,/process\.env\.MSH_DEV_HOST \|\| process\.env\.HOST \|\| '127\.0\.0\.1'/);
  assert.match(server,/process\.env\.MSH_DEV_PORT \|\| process\.env\.PORT/);
  assert.match(server,/Physical device URL:/);
  assert.match(scheme,/key\s*=\s*"MSH_WEB_APP_URL"/);
  assert.match(scheme,/value\s*=\s*"http:\/\/192\.168\.12\.241:43128\/my-health\.html"/);
  assert.doesNotMatch(scheme,/\.local:43128/);
  assert.match(webView,/productionURL = URL\(string: "https:\/\/mysimplehealth\.org\/my-health\.html"\)!/);
  assert.match(webView,/#if DEBUG[\s\S]*showNavigationFailure/);
  assert.match(webView,/My Simple Health development page could not be reached\./);
});

test('native Debug lifecycle diagnostics distinguish process, scene, WebView, navigation, and HealthKit events', () => {
  const app=source('ios/MySimpleHealthApp/App/MySimpleHealthApp.swift');
  const webView=source('ios/MySimpleHealthApp/App/MSHWebView.swift');
  const bridge=source('ios/MySimpleHealthApp/App/AppleHealthBridge.swift');

  assert.match(app,/#if DEBUG[\s\S]*processIdentifier[\s\S]*processSessionID/);
  assert.match(app,/Logger\([\s\S]*category: "Lifecycle"/);
  assert.match(app,/MSHDebugLifecycle\.log\("process_launch"\)/);
  assert.match(app,/"scene_created"/);
  assert.match(app,/"scene_activated"/);
  assert.match(app,/"scene_backgrounded"/);
  assert.match(webView,/"webview_created"/);
  assert.match(webView,/"navigation_started"/);
  assert.match(webView,/"navigation_failed"/);
  assert.match(bridge,/"healthkit_authorization_started"/);
  assert.match(bridge,/"healthkit_sync_started"/);
  assert.match(bridge,/"healthkit_sync_finished"/);
});

test('native Debug memory diagnostics bracket the complete status response allocation chain', () => {
  const app=source('ios/MySimpleHealthApp/App/MySimpleHealthApp.swift');
  const store=source('ios/MySimpleHealthApp/App/FileHealthStore.swift');
  const recordStore=source('ios/MySimpleHealthApp/App/SQLiteHealthRecordStore.swift');
  const bridge=source('ios/MySimpleHealthApp/App/AppleHealthBridge.swift');

  assert.match(app,/MACH_TASK_BASIC_INFO/);
  assert.match(app,/residentBytes=/);
  assert.match(recordStore,/"health_store_apply_started"/);
  assert.match(recordStore,/"health_store_apply_complete"/);
  assert.match(recordStore,/databaseBytesWritten=/);
  assert.match(recordStore,/residentBytesBefore=/);
  assert.match(recordStore,/residentBytesAfter=/);
  assert.match(recordStore,/bulkRecordDecoding=false/);
  assert.match(store,/recordFileBytes=/);
  assert.match(bridge,/"healthkit_response_before_state_read"/);
  assert.match(bridge,/"healthkit_response_after_state_read"/);
  assert.match(bridge,/"healthkit_response_after_record_read"/);
  assert.match(bridge,/"healthkit_response_after_filtering"/);
  assert.match(bridge,/"healthkit_response_after_json_encoding"/);
  assert.match(bridge,/"healthkit_response_before_javascript_callback"/);
  assert.match(bridge,/"healthkit_response_after_javascript_callback"/);
  assert.match(bridge,/encodedResponseBytes=/);
  assert.match(bridge,/recordCount=/);
});

test('native startup status is metadata-only and record transfer requires an explicit scoped import', () => {
  const bridge=source('ios/MySimpleHealthApp/App/AppleHealthBridge.swift');

  assert.match(bridge,/let shouldIncludeRecords = \(\(action == "connect" \|\| action == "sync"\) && !areas\.isEmpty\)/);
  assert.match(bridge,/if shouldIncludeRecords \{[\s\S]*store\.records\([\s\S]*areas: areas[\s\S]*dateRange: dateRange[\s\S]*\} else \{[\s\S]*bridgeRecords = nil/);
  assert.match(bridge,/"healthkit_response_metadata_only"/);
  assert.match(bridge,/"action=\\\(action\) responseRecordCount=0"/);
  assert.match(bridge,/let records: \[HealthRecord\]\?/);
  assert.match(bridge,/let lastAttemptedSyncAt: Date\?/);
  const store=source('ios/MySimpleHealthApp/App/FileHealthStore.swift');
  const recordStore=source('ios/MySimpleHealthApp/App/SQLiteHealthRecordStore.swift');
  assert.match(store,/func records\([\s\S]*areas: Set<HealthDataArea>[\s\S]*openRecordStore\(\)\.records/);
  assert.match(recordStore,/SELECT payload FROM health_records/);
  assert.match(recordStore,/domain IN/);
});

test('Calendar uses a bounded native record request without weakening metadata-only status', () => {
  const bridge=source('ios/MySimpleHealthApp/App/AppleHealthBridge.swift');
  const store=source('ios/MySimpleHealthApp/App/SQLiteHealthRecordStore.swift');
  const web=source('js/msh-connected-health.js');

  assert.match(web,/request\('calendarRange',\{areas,startDate,endDate\}\)/);
  assert.match(bridge,/case "calendarRange"/);
  assert.match(bridge,/action == "calendarRange" && !areas\.isEmpty && dateRange != nil/);
  assert.match(store,/event_start >= \? AND event_start < \?/);
  assert.match(store,/calendarProjectionOnly[\s\S]*let types: \[HealthRecordType\] = \[\.workout, \.sleepSession, \.sleepInterval, \.bodyMass\]/);
  assert.match(bridge,/calendarProjectionOnly: action == "calendarRange"/);
  assert.match(bridge,/action=\\\(action\) responseRecordCount=0/);
  assert.doesNotMatch(web,/calendarRange:[^\n]*localStorage/);
});
