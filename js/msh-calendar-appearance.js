/* My Simple Health — Calendar accent preference, shared as the personal sensory accent */
(function (root) {
  'use strict';

  const PRESETS=Object.freeze([
    {id:'forest',label:'Forest',color:'#496b3c'},
    {id:'sage',label:'Sage',color:'#7a9168'},
    {id:'moss',label:'Moss',color:'#657344'},
    {id:'clay',label:'Clay',color:'#a66f52'},
    {id:'rose',label:'Rose',color:'#a35f6d'},
    {id:'plum',label:'Plum',color:'#76536f'},
    {id:'blue',label:'Blue',color:'#4f748a'},
    {id:'slate',label:'Slate',color:'#65717a'}
  ].map(item=>Object.freeze(item)));
  const DEFAULT=Object.freeze({accentId:'default',customColor:null});
  const isHex=value=>/^#[0-9a-f]{6}$/i.test(String(value||''));
  const preset=id=>PRESETS.find(item=>item.id===id)||null;

  function normalizePreference(value){
    const source=value&&typeof value==='object'?value:{};
    if(source.accentId==='custom'&&isHex(source.customColor))return{accentId:'custom',customColor:String(source.customColor).toLowerCase()};
    if(preset(source.accentId))return{accentId:source.accentId,customColor:null};
    return{...DEFAULT};
  }
  function getPreference(state){return normalizePreference((state||root.MSHStorage?.getState())?.calendar?.settings?.appearance);}
  function hexToRgb(hex){const value=parseInt(hex.slice(1),16);return[(value>>16)&255,(value>>8)&255,value&255];}
  function luminance(hex){return hexToRgb(hex).map(value=>{const channel=value/255;return channel<=.03928?channel/12.92:((channel+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
  function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05);}
  function blend(a,b,amount){const left=hexToRgb(a),right=hexToRgb(b),channels=left.map((value,index)=>Math.round(value+(right[index]-value)*amount));return`#${channels.map(value=>value.toString(16).padStart(2,'0')).join('')}`;}
  function readableAccent(color,theme){
    const background=theme==='dark'?'#1b241d':'#f7f3e8',anchor=theme==='dark'?'#eef0e6':'#173d2a';let result=color;
    for(let step=0;step<8&&contrast(result,background)<3;step++)result=blend(result,anchor,.18);
    return result;
  }
  function chosenColor(preference){const next=normalizePreference(preference);return next.accentId==='custom'?next.customColor:preset(next.accentId)?.color||null;}
  function apply(preference){
    const next=normalizePreference(preference),target=root.document?.querySelector('[data-msh-calendar]');
    if(!target)return next;
    const color=chosenColor(next);
    if(!color){target.classList.remove('has-calendar-accent');target.style.removeProperty('--msh-calendar-accent-base');target.style.removeProperty('--msh-calendar-accent');root.MSHFeedback?.setAccent(null);return next;}
    const theme=root.document.documentElement.dataset.theme==='dark'?'dark':'light';
    target.classList.add('has-calendar-accent');
    target.style.setProperty('--msh-calendar-accent-base',color);
    target.style.setProperty('--msh-calendar-accent',readableAccent(color,theme));
    root.MSHFeedback?.setAccent(color);
    return next;
  }
  function savePreference(value){
    if(!root.MSHStorage)return null;
    if(value?.accentId==='custom'&&!isHex(value.customColor))return null;
    const next=normalizePreference(value);
    root.MSHStorage.updateState(state=>{state.calendar.settings.appearance=next;return state;});
    apply(next);return next;
  }
  function reset(){return savePreference(DEFAULT);}

  root.MSHCalendarAppearance=Object.freeze({PRESETS,DEFAULT,isHex,normalizePreference,getPreference,chosenColor,readableAccent,contrast,apply,savePreference,reset});
})(typeof window!=='undefined'?window:globalThis);
