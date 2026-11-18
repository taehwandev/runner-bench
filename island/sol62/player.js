import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { atmosphere } from './atmosphere.js';
import { populateIsland } from './island.js';
import { soundtrack } from './sound.js';

const DURATION=60;
// Each camera path is a cubic Bézier, paired with its own drifting point of interest.
const shots=[
  { start:0, name:'Offshore', fov:55, path:[[7,19,111],[5,17,101],[-6,14,91],[-12,12,78]], aim:[[1,13,0],[1,10,0]] },
  { start:15, name:'The headland', fov:53, path:[[65,37,58],[51,44,69],[29,43,73],[14,37,71]], aim:[[1,8,0],[0,8,0]] },
  { start:31, name:'The last tide', fov:61, path:[[-40,6.0,43],[-29,4.4,37],[-10,3.7,32],[9,4.0,30]], aim:[[-5,6,0],[5,7,-3]] },
  { start:46, name:'The beacon', fov:54, path:[[32,13,55],[41,17,66],[47,27,88],[41,33,113]], aim:[[6,12,0],[1,16,0]] }
];
const keys=[
  { t:0,  y:.34,  horizon:[.63,.76,.74], zenith:[.23,.47,.59], warm:[1,.73,.42] },
  { t:15, y:.23,  horizon:[.83,.73,.62], zenith:[.29,.48,.63], warm:[1,.61,.35] },
  { t:31, y:-.019,horizon:[.91,.48,.37], zenith:[.24,.32,.49], warm:[1,.46,.25] },
  { t:40, y:-.087,horizon:[.56,.294,.39],zenith:[.12,.19,.35], warm:[1,.34,.21] },
  { t:48, y:-.13, horizon:[.20,.234,.37],zenith:[.048,.091,.192],warm:[.51,.29,.33] },
  { t:60, y:-.28, horizon:[.096,.154,.266],zenith:[.025,.045,.11],warm:[.24,.28,.45] }
];

const get=id=>document.getElementById(id);
const frame=get('frame'), picture=get('picture'), opening=get('opening');
const transport=get('transport'), skip=get('skip'), sound=get('sound');
const chapter=get('chapter'), clock=get('clock');
const bars=[...get('rail').querySelectorAll('b')];
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
picture.append(renderer.domElement);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(55,9/16,.17,2500);
const uniforms=Object.fromEntries(
  ['Time','Dusk','Night','Beacon','Sun','Horizon','Zenith','Warm','Lamp','Beam'].map((key,i)=>[
    'u'+key,{value:i<4?0:new T.Vector3()}
  ])
);
const fill=new T.HemisphereLight(0xffedcf,0x516272,2.35);
const keylight=new T.DirectionalLight(0xffddaa,2.25);
scene.add(fill,keylight);
atmosphere(T,scene,uniforms);
const updateIsland=populateIsland(T,scene,uniforms);
const audio=soundtrack();
const aim=new T.Vector3();
const nextAim=new T.Vector3();
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const u=clamp((n-a)/(b-a)); return u*u*(3-2*u);};
const mix=(a,b,u)=>a+(b-a)*u;

let time=0, shot=0, playing=false, started=false, muted=false, anchor=0, request=0, lastWidth=0, lastHeight=0;
function lighting(t) {
  const i=keys.findIndex(k=>k.t>t);
  const [a,b]=i<0 ? keys.slice(-2) : [keys[i-1],keys[i]];
  const u=smooth(a.t,b.t,t);
  for (const name of ['horizon','zenith','warm']) {
    const left=a[name], right=b[name];
    uniforms['u'+name[0].toUpperCase()+name.slice(1)].value.set(
      mix(left[0],right[0],u),mix(left[1],right[1],u),mix(left[2],right[2],u)
    );
  }
  const angle=-.17-.15*t/DURATION;
  const height=mix(a.y,b.y,u);
  const sun=uniforms.uSun.value.set(Math.sin(angle),height,-Math.cos(angle)).normalize();
  const dusk=smooth(12,39,t);
  const night=smooth(36,54,t);
  const beacon=smooth(40.5,46,t);
  uniforms.uTime.value=t;
  uniforms.uDusk.value=dusk;
  uniforms.uNight.value=night;
  uniforms.uBeacon.value=beacon;
  const sweep=(t-41)*.58+2.6;
  uniforms.uBeam.value.set(Math.cos(sweep),-.057,Math.sin(sweep)).normalize();
  fill.color.setRGB(mix(.89,.21,night),mix(.86,.33,night),mix(.74,.62,night));
  fill.intensity=mix(2.3,1.08,night);
  keylight.color.setRGB(1,mix(.9,.44,dusk),mix(.73,.27,dusk));
  keylight.intensity=mix(2.04,.08,night);
  keylight.position.copy(sun).multiplyScalar(60);
  keylight.position.y=Math.max(20,keylight.position.y);
  updateIsland(t,beacon);
}

function cameraAt(t) {
  shot=shots.findLastIndex(s=>s.start<=t);
  const { start, fov, path, aim: targets }=shots[shot];
  const end=shots[shot+1]?.start ?? DURATION;
  const u=(t-start)/(end-start), v=1-u;
  const coordinate=n=>v*v*v*path[0][n]+3*v*v*u*path[1][n]
                      +3*v*u*u*path[2][n]+u*u*u*path[3][n];
  camera.position.set(coordinate(0),coordinate(1),coordinate(2));
  aim.set(...targets[0]).lerp(nextAim.set(...targets[1]),u);
  camera.lookAt(aim);
  if (camera.fov!==fov) {
    camera.fov=fov;
    camera.updateProjectionMatrix();
  }
}
function resize() {
  const rect=frame.getBoundingClientRect();
  const w=Math.max(1,Math.round(rect.width)), h=Math.max(1,Math.round(rect.height));
  if (w===lastWidth && h===lastHeight) return;
  lastWidth=w;
  lastHeight=h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5,1080/w,1920/h));
  renderer.setSize(w,h,false);
}
const setText=(el,value)=>{if(el.textContent!==value) el.textContent=value;};
function interfaceAt() {
  opening.hidden=started && time>=3.5;
  opening.style.opacity=started ? String(1-smooth(.15,3.5,time)) : '1';
  const ended=time===DURATION;
  setText(transport,ended?'Replay':!started?'Start':playing?'Pause':'Resume');
  skip.hidden=!started || ended;
  skip.disabled=shot===3;
  sound.hidden=!started;
  sound.setAttribute('aria-pressed',String(muted));
  sound.setAttribute('aria-label',muted?'Unmute audio':'Mute audio');
  setText(chapter,shots[shot].name);
  const elapsed=ended?'01:00':`00:${String(Math.floor(time)).padStart(2,'0')}`;
  setText(clock,`${elapsed} / 01:00`);
  bars.forEach((bar,i)=>{
    const start=shots[i].start, end=shots[i+1]?.start ?? DURATION;
    bar.style.transform=`scaleX(${clamp((time-start)/(end-start))})`;
  });
}
function draw() {
  resize();
  lighting(time);
  cameraAt(time);
  renderer.render(scene,camera);
  interfaceAt();
  audio.sync(time,shot,playing,muted);
}
function stop() {
  playing=false;
  cancelAnimationFrame(request);
}
function tick(now) {
  if (!playing) return;
  time=clamp((now-anchor)/1000,0,DURATION);
  if (time===DURATION) stop();
  draw();
  if (playing) request=requestAnimationFrame(tick);
}
function seek(t) {
  if (typeof t!=='number' || Number.isNaN(t)) return;
  time=clamp(t,0,DURATION);
  if (time>0) started=true;
  if (time===DURATION) stop();
  else if (playing) anchor=performance.now()-time*1000;
  draw();
}
function toggle() {
  if (playing) {
    time=clamp((performance.now()-anchor)/1000,0,DURATION);
    stop();
  } else {
    if (time===DURATION) time=0;
    started=true;
    playing=true;
    audio.enable();
    anchor=performance.now()-time*1000;
    request=requestAnimationFrame(tick);
  }
  draw();
}
function nextShot() {
  if (shot<shots.length-1) seek(shots[shot+1].start);
}
function mute() {
  muted=!muted;
  if (!muted && started) audio.enable();
  interfaceAt();
  audio.sync(time,shot,playing,muted);
}
transport.addEventListener('click',toggle);
skip.addEventListener('click',nextShot);
sound.addEventListener('click',mute);
document.addEventListener('keydown',event=>{
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code==='Space' && event.target.tagName!=='BUTTON') {
    event.preventDefault();
    toggle();
  } else if (event.code==='ArrowRight') {
    event.preventDefault();
    nextShot();
  } else if (event.code==='KeyM') mute();
});
new ResizeObserver(draw).observe(frame);
window.__scene={
  get shot(){return shot;},
  get time(){return time;},
  get playing(){return playing;},
  seek
};
draw();
transport.disabled=false;
