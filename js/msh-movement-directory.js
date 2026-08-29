/* My Simple Health — reusable Movement Directory vocabulary */
(function (root) {
  'use strict';

  const DIRECTORY = Object.freeze([
    {id:'exercise_modalities',label:'Exercise modalities',items:[
      ['hiit','HIIT'],['miit','MIIT'],['barre','Barre'],['pilates','Pilates'],['strength_training','Strength training'],['yoga','Yoga'],['circuit_training','Circuit training'],['calisthenics','Calisthenics']
    ]},
    {id:'aerobic_locomotor',label:'Aerobic and locomotor movement',items:[
      ['walking','Walking'],['running','Running'],['cycling','Cycling'],['swimming','Swimming'],['rowing','Rowing'],['stair_climbing','Stair climbing']
    ]},
    {id:'mobility_recovery',label:'Mobility and recovery-oriented movement',items:[
      ['stretching','Stretching'],['mobility','Mobility'],['gentle_movement','Gentle movement']
    ]},
    {id:'sports',label:'Sports',items:[
      ['basketball','Basketball'],['tennis','Tennis'],['pickleball','Pickleball'],['soccer','Soccer'],['volleyball','Volleyball'],['golf','Golf'],['softball_baseball','Softball / baseball'],['martial_arts','Martial arts'],['other_sport','Other sport']
    ]},
    {id:'recreation',label:'Recreation',items:[
      ['hiking','Hiking'],['dancing','Dancing'],['kayaking','Kayaking'],['skiing_snowboarding','Skiing / snowboarding'],['skating','Skating'],['gardening','Gardening']
    ]},
    {id:'daily_living',label:'Activities of daily living',items:[
      ['housework','Housework'],['yard_work','Yard work'],['carrying_groceries','Carrying groceries'],['moving_furniture','Moving furniture'],['stairs','Stairs'],['active_errands','Active errands'],['physical_caregiving','Physical caregiving'],['other_daily_movement','Other daily-life movement']
    ]},
    {id:'events_accomplishments',label:'Events and meaningful accomplishments',items:[
      ['ran_5k','Ran a 5K'],['ran_10k','Ran a 10K'],['ran_half_marathon','Ran a half marathon'],['ran_marathon','Ran a marathon'],['walked_event','Walked a race/event'],['cycling_event','Cycling event'],['hiking_event','Hiking event'],['custom_event','Custom event']
    ]}
  ].map(category=>Object.freeze({...category,items:Object.freeze(category.items.map(([id,label])=>Object.freeze({id,label,categoryId:category.id,categoryLabel:category.label})))})));

  const flat=Object.freeze(DIRECTORY.flatMap(category=>category.items));
  const normalize=value=>String(value||'').trim().toLocaleLowerCase();
  function get(id){return flat.find(item=>item.id===id)||null;}
  function search(query,limit=8){
    const value=normalize(query);
    if(!value)return [];
    return flat.filter(item=>normalize(item.label).includes(value)||normalize(item.categoryLabel).includes(value)).slice(0,Math.max(1,limit));
  }

  root.MSHMovementDirectory=Object.freeze({DIRECTORY,items:flat,get,search});
})(typeof window!=='undefined'?window:globalThis);
