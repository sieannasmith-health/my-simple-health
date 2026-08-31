/* My Simple Health — bounded Calendar data projection */
(function (global) {
  'use strict';

  const EVENT_META = Object.freeze({
    cycle:{label:'Cycle',layer:'cycle'}, movement:{label:'Movement',layer:'movement'}, symptom:{label:'Symptoms',layer:'symptoms'}, care:{label:'Care & appointments',layer:'care'},
    medication:{label:'Medication',layer:'medications'}, sexualHealth:{label:'Sexual health',layer:'sexualHealth'}, measurement:{label:'Measurement',layer:'measurements'},
    practice:{label:'Practice',layer:'practices'}, project:{label:'Project',layer:'projects'}, prevention:{label:'Preventive care',layer:'care'},
    life:{label:'Life context',layer:'life'}, note:{label:'Observation',layer:'observations'}
  });

  const eventDate = value => {
    if (!value) return '';
    const raw=String(value).slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:'';
  };
  const inRange = (date, range) => Boolean(date) && (!range || ((!range.startDate || date>=range.startDate) && (!range.endDate || date<=range.endDate)));
  function eventCategory(event) {
    const value=String(event.category||event.type||event.sourceType||event.progressType||'').toLowerCase();
    if (/sexual|reproductive/.test(value)) return 'sexualHealth';
    if (/cycle|period|menstrual|fertil/.test(value)) return 'cycle';
    if (/movement|workout|walk|run|strength|cycling|swimming|mobility|yoga|sport/.test(value)) return 'movement';
    if (/symptom|body/.test(value)) return 'symptom';
    if (/appointment|screen|lab|care/.test(value)) return 'care';
    if (/medication|dose|refill|injection/.test(value)) return 'medication';
    if (/measurement|weight|temperature|blood.pressure|glucose/.test(value)) return 'measurement';
    if (/practice|routine/.test(value)) return 'practice';
    if (/project|milestone/.test(value)) return 'project';
    if (/prevent|reminder/.test(value)) return 'prevention';
    if (/travel|school|work|life|disruption/.test(value)) return 'life';
    return 'note';
  }
  const layerEnabled = (layers,category) => layers[EVENT_META[category]?.layer||'life']!==false;

  function deriveHealthEvents(state, importedEvents=[], range=null) {
    const byKey=new Map(), represented=new Set();
    const sources=[
      ['calendar',(state.calendar?.events||[]).filter(event=>event.category!=='cycle')],
      ['progress',state.progressEvents||[]]
    ];
    const availableCount=sources.reduce((sum,[,items])=>sum+items.length,0)+(state.practiceAttempts||[]).length+(state.practices||[]).length+(state.projects||[]).length+importedEvents.length;
    let processedCount=0;
    const add=(event,sourceKind) => {
      const date=eventDate(event.date||event.timestamp||event.createdAt||event.updatedAt||event.completedAt);
      if(!inRange(date,range))return;
      const category=eventCategory(event), meta=EVENT_META[category], id=event.id||`${sourceKind}-${date}-${processedCount}`;
      processedCount+=1;
      represented.add(id);
      const item={id,date,category,sourceKind,title:event.title||event.statement||event.label||meta.label,detail:event.detail||event.note||'',recordStatus:event.recordStatus||'recorded',informationClass:event.informationClass||'RECORDED',startAt:event.startAt||event.timestamp||'',movement:event.movement||null};
      byKey.set(`${id}|${date}|${category}`,item);
    };
    sources.forEach(([kind,items])=>items.forEach(event=>add(event,kind)));
    (state.practiceAttempts||[]).filter(item=>!represented.has(item.id)).forEach(item=>add({...item,title:item.note||'Practice check-in',category:'practice'},'practice'));
    (state.practices||[]).filter(item=>!represented.has(item.id)).forEach(item=>add({...item,title:`Practice · ${item.title||'Recorded'}`,category:'practice'},'practice'));
    (state.projects||[]).filter(item=>!represented.has(item.id)).forEach(item=>add({...item,title:`Project · ${item.title||'Recorded'}`,category:'project'},'project'));
    importedEvents.forEach(item=>add(item,item.sourceKind||'apple_health'));
    return {events:[...byKey.values()],availableCount,processedCount};
  }

  function cycleRelatedEvents(cycleEvents=[], range=null) {
    const items=[];
    cycleEvents.filter(event=>event.type==='cycle_day_observation'&&inRange(event.date,range)).forEach(event=>{
      const value=event.value||{}, date=event.date, base=`cycle-related-${event.id||date}`;
      if((value.symptoms||[]).length)items.push({id:`${base}-symptoms`,date,category:'symptom',sourceKind:'cycle',title:'Symptoms recorded',detail:value.symptoms.join(' · '),recordStatus:'recorded',informationClass:'RECORDED'});
      const medication=value.care&&value.care.medication;
      if(medication)items.push({id:`${base}-medication`,date,category:'medication',sourceKind:'cycle',title:'Medication or relief recorded',detail:medication,recordStatus:'recorded',informationClass:'RECORDED'});
      const sexual=value.sexualReproductive||{}, sexualDetail=[sexual.sexualActivity,sexual.contraception,sexual.context].filter(Boolean).join(' · ');
      if(sexualDetail)items.push({id:`${base}-sexual`,date,category:'sexualHealth',sourceKind:'cycle',title:'Sexual-health information recorded',detail:sexualDetail,recordStatus:'recorded',informationClass:'RECORDED'});
      const measurements=value.measurements||{}, measurementDetail=[measurements.temperature?`Temperature ${measurements.temperature}`:'',measurements.weight?`Weight ${measurements.weight}`:''].filter(Boolean).join(' · ');
      if(measurementDetail)items.push({id:`${base}-measurements`,date,category:'measurement',sourceKind:'cycle',title:'Measurement recorded',detail:measurementDetail,recordStatus:'recorded',informationClass:'RECORDED'});
      if(value.note)items.push({id:`${base}-note`,date,category:'note',sourceKind:'cycle',title:'Personal observation',detail:value.note,recordStatus:'recorded',informationClass:'RECORDED'});
    });
    return items;
  }

  function visibleHealthEvents({state,importedEvents=[],cycleEvents=[],range=null}) {
    const derived=deriveHealthEvents(state,importedEvents,range);
    const events=[...derived.events,...cycleRelatedEvents(cycleEvents,range)].filter(event=>layerEnabled(state.calendar.settings.layers,event.category));
    return {...derived,events};
  }

  function indexByDate(events) {
    const index=new Map();
    events.forEach(event=>{const dateEvents=index.get(event.date)||[];dateEvents.push(event);index.set(event.date,dateEvents);});
    return index;
  }

  function boundedTimeline(events,limit=60) {
    const boundedLimit=Math.max(1,Math.min(100,Number(limit)||60));
    return [...events].sort((a,b)=>b.date.localeCompare(a.date)||(b.startAt||'').localeCompare(a.startAt||'')).slice(0,boundedLimit);
  }

  const api=Object.freeze({EVENT_META,eventDate,eventCategory,inRange,deriveHealthEvents,cycleRelatedEvents,visibleHealthEvents,indexByDate,boundedTimeline});
  global.MSHCalendarData=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
