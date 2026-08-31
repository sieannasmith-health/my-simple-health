import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = path => fs.readFileSync(new URL(path, root), 'utf8');

function recordsAPI() {
  const sandbox={window:{}}; sandbox.globalThis=sandbox.window;
  vm.runInNewContext(source('js/msh-health-records.js'),sandbox);
  return sandbox.window.MSHHealthRecords;
}

let sequence=0;
function record(type,value,unit,eventStart,metadata={}) {
  sequence+=1;
  return {
    id:`apple_health:activity-${sequence}`,domain:'movement',recordType:type,value,unit,
    eventStart,eventEnd:null,timezoneIdentifier:'UTC',
    source:{provider:'apple_health',sourceSystem:'healthkit',sourceRecordID:`activity-${sequence}`,sourceName:'Apple Health'},
    provenance:'IMPORTED',informationClass:'RECORDED',lifecycleStatus:'ACTIVE',metadata
  };
}

test('Activity projects Today and recent movement from canonical HealthKit records', () => {
  const api=recordsAPI();
  const records=[
    record('movement.step_daily_summary',6432,'count','2026-08-30T00:00:00Z',{summary:'daily',day:'2026-08-30'}),
    record('movement.active_energy',412.4,'kcal','2026-08-30T00:00:00Z',{summary:'daily',day:'2026-08-30'}),
    record('movement.exercise_time',1860,'s','2026-08-30T00:00:00Z',{summary:'daily',day:'2026-08-30'}),
    record('movement.distance_walking_running',4828,'m','2026-08-30T00:00:00Z',{summary:'daily',day:'2026-08-30'}),
    record('movement.step_daily_summary',5110,'count','2026-08-29T00:00:00Z',{summary:'daily',day:'2026-08-29'}),
    {...record('movement.workout',null,null,'2026-08-30T13:00:00Z',{activityName:'Walk',activityType:'52',durationSeconds:'1800',activeEnergyKcal:'160',distanceMeters:'2400'}),eventEnd:'2026-08-30T13:30:00Z'}
  ];

  const activity=api.activity(records,{now:'2026-08-30T18:00:00Z',timezoneIdentifier:'UTC',days:7});

  assert.equal(activity.today.steps.value,6432);
  assert.equal(activity.today.activeEnergy.value,412.4);
  assert.equal(activity.today.exerciseTime.value,1860);
  assert.equal(activity.today.distanceWalkingRunning.value,4828);
  assert.equal(activity.today.workoutCount,1);
  assert.equal(activity.days.length,7);
  assert.equal(activity.workouts[0].activityName,'Walk');
  assert.equal(activity.workouts[0].durationSeconds,1800);
  assert.equal(activity.workouts[0].activeEnergy.value,160);
  assert.equal(activity.workouts[0].distance.value,2400);
});

test('daily HealthKit statistics take precedence over raw samples', () => {
  const api=recordsAPI();
  const records=[
    record('movement.active_energy',200,'kcal','2026-08-30T00:00:00Z',{summary:'daily',day:'2026-08-30'}),
    record('movement.active_energy',75,'kcal','2026-08-30T10:00:00Z'),
    record('movement.active_energy',80,'kcal','2026-08-30T11:00:00Z')
  ];
  const activity=api.activity(records,{now:'2026-08-30T18:00:00Z',timezoneIdentifier:'UTC',days:7});
  assert.equal(activity.today.activeEnergy.value,200);
  assert.equal(activity.today.activeEnergy.summarized,true);
});

test('Activity remains neutral when movement or workouts are absent', () => {
  const api=recordsAPI();
  const activity=api.activity([],{now:'2026-08-30T18:00:00Z',timezoneIdentifier:'UTC',days:30});
  assert.equal(activity.today.steps,null);
  assert.equal(activity.today.workoutCount,0);
  assert.equal(activity.workouts.length,0);
  const ui=source('js/msh-health-activity.js');
  assert.doesNotMatch(ui,/missed workout|broken streak|failure badge|close your rings|goal compliance/i);
  assert.match(ui,/not a missed target/i);
  assert.match(ui,/does not make causal or personalized interpretations yet/i);
  assert.doesNotMatch(ui,/localStorage|sessionStorage/);
});

test('Activity reuses existing movement permissions and the native bridge', () => {
  const provider=source('ios/MySimpleHealthHealthKit/Sources/MSHAppleHealthKit/AppleHealthKitProvider.swift');
  const activityUI=source('js/msh-health-activity.js');
  assert.match(provider,/\.stepCount/);
  assert.match(provider,/\.activeEnergyBurned/);
  assert.match(provider,/\.appleExerciseTime/);
  assert.match(provider,/\.distanceWalkingRunning/);
  assert.match(provider,/HKObjectType\.workoutType\(\)/);
  assert.match(provider,/requestAuthorization\(toShare: \[\], read: readTypes\)/);
  assert.match(activityUI,/MSHConnectedHealth/);
  assert.match(activityUI,/initialSyncRequested/);
  assert.match(activityUI,/MSHConnectedHealth\.sync\(\['movement'\]\)/);
  assert.match(activityUI,/MSHHealthRecords\.activity/);
  assert.doesNotMatch(activityUI,/webkit|HKHealthStore/);
  const bridge=source('ios/MySimpleHealthApp/App/AppleHealthBridge.swift');
  assert.match(bridge,/areas: responseAreas/);
  assert.match(bridge,/movementCutoff/);
});
