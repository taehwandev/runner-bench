import {createRenderer,Geometry} from './renderer.js';
import {segmentLength,districtAt,districts,buildSegment,railCar} from './city.js';
import {hazards,hazardModel,pickupModel,runnerModel,trailModel} from './models.js';
import {createRun,advance,move,movingPose,updateParticles,runnerZ,powerDuration} from './simulation.js';
import {soundEngine} from './audio.js';

const $=id=>document.getElementById(id);
const stage=$('stage'), canvas=$('city'), play=$('play'), again=$('again'), audio=soundEngine();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const ease=(a,b,n)=>a+(b-a)*n;
let state='ready', run=createRun(), muted=read('afterlight.mute')==='1';
let best=Number(read('afterlight.best'))||0;
let scene, dynamic, transparent, g, light;
let time=0,lastFrame=0,crashAt=0,crashType='car',lastUi=-1,uiDistrict=-1;
let toastLeft=0,toastPriority=0,eyeX=0,eyeY=4.44,eyeZ=8.6,pitch=.263,zoom=1.28,scale=.94;
let frameEMA=17,slowFor=0,fastFor=0;
let pointer=null, raf=0, stopped=false;
let accent=[...districts[0].accent],fog=[...districts[0].fog];
const segments=new Map();
const keyboard={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'jump',w:'jump',arrowdown:'slide',s:'slide'};

window.__game={
  get state(){return state;},
  get score(){return Math.floor(run.score);},
  get combo(){return run.combo;},
  get alive(){return state==='running';}
};
function read(key){
  try{return localStorage.getItem(key);}catch{return null;}
}
function store(key,value){
  try{localStorage.setItem(key,value);}catch{}
}
function syncSound(){
  audio.mute(muted);
  $('sound').setAttribute('aria-pressed',String(muted));
  $('sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');
}
function mode(value){
  state=value;
  stage.dataset.mode=value;
  $('start').hidden=value!=='ready';
  $('hud').hidden=value!=='running' && value!=='crashing';
  $('over').hidden=value!=='over';
}
function start(){
  if(!scene || (state!=='ready' && state!=='over')) return;
  audio.open();
  audio.play('start');
  run=createRun();
  toastLeft=toastPriority=0;
  $('toast').style.opacity=0;
  $('cue').style.opacity=0;
  lastUi=-1;
  uiDistrict=-1;
  eyeX=0;
  pointer=null;
  document.activeElement?.blur();
  mode('running');
  updateHud();
  if(matchMedia('(pointer: coarse)').matches && !document.fullscreenElement && stage.requestFullscreen){
    stage.requestFullscreen().catch(()=>{});
  }
}
function end(){
  const score=Math.floor(run.score), record=score>best;
  if(record){best=score;store('afterlight.best',String(best));}
  $('cause').textContent=record?'NEW PERSONAL BEST':hazards[crashType].label;
  $('total').textContent=score.toLocaleString();
  $('best').textContent=best.toLocaleString();
  mode('over');
}
function toast(text,seconds=1.08,priority=1){
  if(toastLeft>.28 && priority<toastPriority) return;
  const label=$('toast');
  label.textContent=text;
  toastLeft=seconds;
  toastPriority=priority;
}
function event(type,detail){
  audio.play(type,detail);
  if(type==='near') toast(detail.label+'  +'+detail.points,1.08,2);
  if(type==='shield') toast('SHIELD · ABSORBS ONE HIT',1.52,3);
  if(type==='magnet') toast('MAGNET · ATTRACTS CHIPS',1.52,3);
  if(type==='break') toast('SHIELD BROKEN',1.12,4);
  if(type==='crash'){
    crashAt=time;
    crashType=detail;
    mode('crashing');
    if(!reduced.matches && navigator.vibrate) navigator.vibrate(40);
  }
}
function interact(action){
  if(state==='running') move(run,action,event);
}
function gesture(e){
  if(!pointer || e.pointerId!==pointer.id || pointer.sent) return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<23)return;
  pointer.sent=true;
  interact(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');
}
function bind(){
  play.addEventListener('click',start);
  again.addEventListener('click',start);
  $('over').addEventListener('click',start);
  $('sound').addEventListener('click',()=>{
    muted=!muted;
    if(!muted) audio.open();
    store('afterlight.mute',muted?'1':'0');
    syncSound();
  });
  $('reload').addEventListener('click',()=>location.reload());
  stage.addEventListener('pointerdown',e=>{
    if(state!=='running' || pointer || e.target.closest('button') || e.button!==0) return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sent:false};
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove',gesture);
  stage.addEventListener('pointerup',e=>{gesture(e);if(e.pointerId===pointer?.id)pointer=null;});
  for(const name of ['pointercancel','lostpointercapture']){
    stage.addEventListener(name,e=>{if(e.pointerId===pointer?.id)pointer=null;});
  }
  stage.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(e.ctrlKey || e.metaKey){
      if(['+','=','-','0'].includes(key)) e.preventDefault();
      return;
    }
    if(keyboard[key]){
      e.preventDefault();
      if(!e.repeat) interact(keyboard[key]);
    }
    if((key==='enter'||key===' ') && !e.target.closest?.('button') && (state==='ready'||state==='over')){
      e.preventDefault();
      start();
    }
  });
  new ResizeObserver(()=>{if(scene && !stopped) scene.resize(scale);}).observe(stage);
  document.addEventListener('visibilitychange',()=>{lastFrame=0;pointer=null;});
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();
    fail('Graphics were interrupted. Reload to reconnect.');
  });
}
function padded(n,length){return String(Math.max(0,Math.floor(n))).padStart(length,'0');}
function updateHud(){
  $('score').textContent=padded(run.score,6);
  $('combo').textContent='×'+run.combo;
  $('chain-bar').style.transform='scaleX('+run.comboLeft/4.6+')';
  $('pace').textContent=padded(run.speed*3.6,3);
  for(const [type,total] of Object.entries(powerDuration)){
    const element=$(type), value=run[type];
    element.hidden=value<=0;
    if(value>0){
      element.querySelector('b').textContent=Math.ceil(value)+'s';
      element.querySelector('i').style.transform='scaleX('+value/total+')';
    }
  }
  const guide=run.guides.find(row=>row.d-run.distance<25 && row.d-run.distance>-1.2);
  const cue=$('cue');
  cue.style.opacity=guide?1:0;
  if(guide){
    cue.querySelector('strong').textContent=guide.text[0];
    cue.querySelector('span').textContent=guide.text[1];
  }
}
function worldMeshes(distance){
  const opaque=[],glow=[];
  const first=Math.floor((distance-12)/segmentLength);
  for(let i=first;i<=first+5;i++){
    if(!segments.has(i)){
      const {g:geometry,light:lamps}=buildSegment(i);
      segments.set(i,[scene.buffer(geometry),scene.buffer(lamps)]);
    }
    const pair=segments.get(i);
    const offset=distance-i*segmentLength;
    opaque.push([pair[0],offset]);
    glow.push([pair[1],offset]);
  }
  for(const [index,[solid,lamps]] of segments){
    if(index<first || index>first+5){
      scene.drop(solid);
      scene.drop(lamps);
      segments.delete(index);
    }
  }
  return [opaque,glow];
}
function actors(distance){
  g.length=light.length=0;
  const ready=state==='ready';
  if(ready){
    // Parked traffic bookends the hero without obscuring the live course.
    hazardModel(g,light,{x:-2.65,type:'car'},-11.5);
    hazardModel(g,light,{x:2.65,type:'taxi'},-26.1);
    hazardModel(g,light,{x:0,type:'car'},-49.8);
    for(const d of [11,15,19,23]) pickupModel(g,light,{x:0,y:.81,d,type:'chip'},runnerZ-d,time);
  } else {
    for(const o of run.objects){
      const z=runnerZ+distance-o.d;
      if(z< -113 || z>10) continue;
      movingPose(o,distance);
      if(o.type==='tram' && o.d===181){
        const x=-4.09-Math.max(0,o.d-distance-9)*.21;
        railCar(g,light,x,z);
        railCar(g,light,x-5.05,z);
      } else hazardModel(g,light,o,z);
    }
    for(const p of run.pickups){
      const z=runnerZ+distance-p.d;
      if(!p.collected && z> -101 && z<8) pickupModel(g,light,p,z,time);
    }
  }
  let index=Math.floor((distance-12)/segmentLength);
  for(let end=index+3;index<=end;index++){
    const slot=((index%10)+10)%10;
    if(slot!==3 && slot!==8) continue;
    const z=distance-index*segmentLength-29;
    if(z>10 || z< -99) continue;
    const t=(Math.sin((z+38)*.092)+1)*.5;
    railCar(g,light,-8.4-t*12,z);
    railCar(g,light,-13.5-t*12,z);
  }
  runnerModel(g,light,run,runnerZ,run.time||time,ready);
  trailModel(g,light,run.particles);
  scene.upload(dynamic,g);
  scene.upload(transparent,light);
}
function draw(dt){
  const ready=state==='ready', distance=ready?0:run.distance;
  const zone=districtAt(distance);
  if(zone!==uiDistrict){
    if(!ready && uiDistrict>=0){
      toast('ENTERING '+districts[zone].name.toUpperCase(),1.62,3);
      audio.play('district');
    }
    uiDistrict=zone;
    $('district').textContent=districts[zone].name;
  }
  const mood=districts[zone];
  for(let i=0;i<3;i++){
    fog[i]=ease(fog[i],mood.fog[i],dt*1.5);
    accent[i]=ease(accent[i],mood.accent[i],dt*1.5);
  }
  const shake=reduced.matches?0:run.impact*.22;
  const motion=reduced.matches?0:1;
  eyeX=ease(eyeX,run.x*.45+(ready?Math.sin(time*.60)*.24:0),dt*5);
  eyeY=ease(eyeY,ready?3.8:4.62+run.y*.28,dt*5);
  eyeZ=ease(eyeZ,ready?8.8:9.92+(run.speed-15)*.036,dt*4);
  pitch=ease(pitch,ready?.19:.285,dt*5);
  zoom=ease(zoom,ready?1.35:1.34-(run.speed-15)*.007,dt*4);
  const [opaque,glow]=worldMeshes(distance);
  actors(distance);
  opaque.push([dynamic,0]);
  glow.push([transparent,0]);
  scene.render({
    eye:[eyeX+Math.sin(time*86)*shake,eyeY+Math.sin(time*68+1)*shake+Math.sin(run.time*14)*.025*motion,eyeZ],
    pitch,zoom,roll:(run.bank*.19+Math.sin(time*123)*shake*.11)*motion,
    fog,accent,travel:distance%308,time,
    impact:run.impact*(reduced.matches?.28:1),
    velocity:ready?0:(.29+(run.speed-15)*.039)*motion
  },opaque,glow);
}
function performanceScale(interval,dt){
  if(interval>115 || !interval || state!=='running') return;
  frameEMA+=(interval-frameEMA)*.035;
  slowFor=frameEMA>21?slowFor+dt:0;
  fastFor=frameEMA<17.5?fastFor+dt:0;
  if(slowFor>1.25 && scale>.69){
    scale=Math.max(.69,scale-.10);
    scene.resize(scale);
    slowFor=fastFor=0;
  } else if(fastFor>9 && scale<.94) {
    scale=Math.min(.94,scale+.05);
    scene.resize(scale);
    slowFor=fastFor=0;
  }
}
function frame(now){
  if(stopped) return;
  const elapsed=lastFrame?now-lastFrame:16.7;
  lastFrame=now;
  const dt=Math.min(.052,elapsed*.001);
  time+=dt;
  performanceScale(elapsed,dt);
  if(state==='running'){
    // Substeps keep collisions and gestures consistent if a browser frame slips.
    let remain=dt;
    while(remain>0 && state==='running'){
      const step=Math.min(remain,1/120);
      advance(run,step,event);
      remain-=step;
    }
    audio.beat(dt,run.speed);
  }
  if(state==='crashing' && time-crashAt>.40) end();
  if(state==='running' || state==='crashing'){
    toastLeft=Math.max(0,toastLeft-dt);
    $('toast').style.opacity=Math.min(1,toastLeft*4.5);
    if(time-lastUi>.066){updateHud();lastUi=time;}
  }
  updateParticles(run,dt,state==='running'||state==='ready');
  draw(dt);
  raf=requestAnimationFrame(frame);
}
function fail(message){
  stopped=true;
  cancelAnimationFrame(raf);
  mode('error');
  if(message) $('error-text').textContent=message;
  $('error').hidden=false;
  $('sound').hidden=true;
}
bind();
syncSound();
try{
  scene=createRenderer(canvas);
  g=new Geometry();
  light=new Geometry(8192);
  dynamic=scene.buffer(g,true);
  transparent=scene.buffer(light,true);
  scene.resize(scale);
  draw(.016);
  play.disabled=false;
  raf=requestAnimationFrame(frame);
} catch(error){
  console.error(error);
  fail();
}
