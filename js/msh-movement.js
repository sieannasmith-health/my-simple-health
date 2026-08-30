/* My Simple Health — movement events within Calendar */
(function (root) {
  'use strict';

  const MOVEMENT_TYPES = Object.freeze(['walk','run','strength','cycling','swimming','mobility','yoga','sport','other']);
  const MOVEMENT_STATUSES = Object.freeze(['planned','completed','skipped','modified']);
  const EXPERIENCE_LEVELS = Object.freeze(['much_lower','lower','about_the_same','higher','much_higher','not_sure']);
  const ATTRIBUTIONS = Object.freeze(['sleep','stress','nutrition','hydration','cycle','soreness','illness','schedule','environment','unknown','other']);
  const TYPE_LABELS = Object.freeze({walk:'Walk',run:'Run',strength:'Strength training',cycling:'Cycling',swimming:'Swimming',mobility:'Mobility',yoga:'Yoga',sport:'Sport',other:'Movement'});
  const EXPERIENCE_LABELS = Object.freeze({much_lower:'Much lower',lower:'Lower',about_the_same:'About the same',higher:'Higher',much_higher:'Much higher',not_sure:'Not sure'});
  const clean = (value, length=500) => String(value == null ? '' : value).trim().slice(0,length);
  const number = value => value === '' || value == null ? null : Number(value);
  const dateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||'')) ? String(value) : '';
  const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
  const uniqueAllowed = (values, options) => [...new Set((Array.isArray(values)?values:[]).filter(value=>options.includes(value)))];

  function rpeDescription(value) {
    const rpe=number(value);
    if(rpe==null)return '';
    if(rpe<=1)return 'Very light';
    if(rpe<=3)return 'Light';
    if(rpe<=5)return 'Moderate';
    if(rpe<=7)return 'Hard';
    if(rpe<=9)return 'Very hard';
    return 'Maximum effort';
  }

  function provenance(id) {
    return root.MSHStorage.createProvenance(root.MSHStorage.PROVENANCE.USER_STATED,{sourceId:id});
  }

  function startAt(date,time) {
    const key=dateKey(date);
    if(!key)return '';
    const clock=/^\d{2}:\d{2}$/.test(String(time||''))?String(time):'';
    if(!clock)return '';
    const parsed=new Date(`${key}T${clock}:00`);
    return Number.isFinite(parsed.getTime())?parsed.toISOString():'';
  }

  function cleanVideo(value) {
    if(!value||typeof value!=='object')return null;
    const provider=clean(value.provider,40), videoId=clean(value.videoId,120), youtubeUrl=clean(value.youtubeUrl,600), thumbnailUrl=clean(value.thumbnailUrl,600);
    if(provider!=='youtube'||!videoId||!youtubeUrl)return null;
    return {
      provider:'youtube', videoId, title:clean(value.title,220), youtubeUrl, thumbnailUrl,
      playlistId:clean(value.playlistId,160)||null,
      durationMinutes:Number.isFinite(Number(value.durationMinutes))?Number(value.durationMinutes):null,
      focusTags:Array.isArray(value.focusTags)?value.focusTags.map(item=>clean(item,60)).filter(Boolean).slice(0,12):[]
    };
  }

  function movementEvents(state) {
    const source=state||root.MSHStorage.getState();
    return (source.calendar?.events||[]).filter(event=>event?.category==='movement'&&event?.type==='movement');
  }

  function getEvent(id,state) {
    return movementEvents(state).find(event=>event.id===id)||null;
  }

  function plan(input={}) {
    if(!root.MSHStorage)return null;
    const date=dateKey(input.date), requestedType=allowed(input.movementType,MOVEMENT_TYPES,''), directoryItem=root.MSHMovementDirectory?.get(clean(input.directoryItemId,80));
    const movementLabel=clean(input.movementLabel||input.title||(directoryItem&&directoryItem.label)||TYPE_LABELS[requestedType],160);
    if(!date||!movementLabel)return null;
    const movementType=requestedType||'other', entryMode=directoryItem&&directoryItem.label===movementLabel?'directory':cleanVideo(input.video)?'connected_resource':'custom';
    const duration=number(input.durationMinutes);
    if(duration!=null&&(!Number.isFinite(duration)||duration<1||duration>1440))return null;
    const timestamp=new Date().toISOString(), id=root.MSHStorage.uid('calendar_movement'), video=cleanVideo(input.video);
    const event={
      id, category:'movement', type:'movement', date,
      startAt:startAt(date,input.time), timestamp,
      title:movementLabel,
      detail:clean(input.notes,500), recordStatus:'recorded', informationClass:'RECORDED',
      source:video?{type:'CONNECTED_RESOURCE',channel:'youtube',provider:'youtube',playlistId:video.playlistId,videoId:video.videoId}:{type:'USER_ENTRY',channel:'calendar'}, prediction:null,
      movement:{status:'planned',movementType,movementLabel,entryMode,directoryItemId:entryMode==='directory'?directoryItem.id:null,directoryCategory:entryMode==='directory'?directoryItem.categoryId:null,durationMinutes:duration,focusArea:clean(input.focusArea,80)||null,video},
      provenance:provenance(id), createdAt:timestamp, updatedAt:timestamp
    };
    root.MSHStorage.updateState(state=>{state.calendar.events.push(event);return state;});
    return event;
  }

  function recordExperience(id,input={}) {
    if(!root.MSHStorage)return null;
    const status=allowed(input.status,MOVEMENT_STATUSES,'');
    if(!id||!status||status==='planned')return null;
    const duration=number(input.durationMinutes),rpe=number(input.rpe);
    if(duration!=null&&(!Number.isFinite(duration)||duration<1||duration>1440))return null;
    if(rpe!=null&&(!Number.isInteger(rpe)||rpe<1||rpe>10))return null;
    const experience=allowed(input.energy,EXPERIENCE_LEVELS,'');
    const attributions=uniqueAllowed(input.attributions,ATTRIBUTIONS);
    let saved=null;
    root.MSHStorage.updateState(state=>{
      const event=movementEvents(state).find(item=>item.id===id);
      if(!event)return state;
      const updatedAt=new Date().toISOString();
      event.movement={
        ...event.movement,status,durationMinutes:duration??event.movement.durationMinutes??null,
        experience:{
          perceivedEffort:rpe==null?null:{value:rpe,scale:'RPE_1_10',description:rpeDescription(rpe)},
          energy:experience?{value:experience,label:EXPERIENCE_LABELS[experience]}:null,
          possibleInfluences:attributions,
          attributionMeaning:'USER_SELECTED_POSSIBLE_INFLUENCE',
          attributionProvenance:provenance(id),
          reflection:clean(input.reflection,1200)
        },
        recordedAt:updatedAt
      };
      event.updatedAt=updatedAt;
      saved=event;
      return state;
    });
    return saved;
  }

  root.MSHMovement=Object.freeze({MOVEMENT_TYPES,MOVEMENT_STATUSES,EXPERIENCE_LEVELS,ATTRIBUTIONS,TYPE_LABELS,EXPERIENCE_LABELS,rpeDescription,movementEvents,getEvent,plan,recordExperience});
})(typeof window!=='undefined'?window:globalThis);
