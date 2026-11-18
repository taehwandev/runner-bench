import * as T from './lib/three-0.160.0.module.min.js';
import {atmosphere,V} from './geometry.js';
import {buildWorld} from './world.js';
import {buildTrain} from './train.js';
import {sky,weather} from './weather.js';
import {motion,cuts,titles} from './route.js';
import {Soundtrack} from './sound.js';

const $=id=>document.getElementById(id), clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const lerp=(a,b,u)=>a+(b-a)*u;
const stage=$('screen'),scene=new T.Scene(),camera=new T.PerspectiveCamera(49,9/16,.18,760);
const audio=new Soundtrack();
let renderer,engine,flakes,t=0,playing=false,poster=true,shot=0,train=motion(0),stamp=0,frame=0;
function cameraAt(t,d){
 const u=(t-cuts[shot])/(cuts[shot+1]-cuts[shot]),s=smooth(u);
 let eye,aim,fov;
 switch(shot){
 case 0:
   eye=[lerp(-9.6,-8,s),lerp(6.0,4.8,s),lerp(16.9,14.1,s)];
   aim=[-.25,lerp(4.72,3.84,s),-5.7];fov=49;break;
 case 1:
   eye=[-6.5,3.1+u*.7,lerp(-42,-15,s)];
   aim=[0,3.12,eye[2]+10.9];fov=55;break;
 case 2:
   eye=[lerp(-12,-8,s),lerp(-.65,1.35,s),lerp(13,5,s)];
   aim=[0,2.1,-5.9];fov=53;break;
 case 3:
   eye=[lerp(-13.99,-8.6,s),lerp(6.1,3.85,s),lerp(15.7,11.7,s)];
   aim=[.45,3.5,-3.3];fov=54;break;
 case 4:
   eye=[lerp(-9,-6.4,s),lerp(2.4,3.25,s),12-(d-648)*.40];
   aim=[0,3.12,lerp(-1.3,eye[2]+8,s)];fov=55;break;
 case 5:
   eye=[lerp(-5.8,-5.2,s),lerp(3.0,4.2,s),lerp(8.6,11.3,s)];
   aim=[0,3.03,-2.4];fov=57;break;
 case 6:
   eye=[lerp(-15,-21,s),lerp(7.1,9.7,s),lerp(23,26,s)];
   aim=[0,2.1,-10];fov=49;break;
 default:
   eye=[lerp(-30,-42,s),lerp(13,22,s),lerp(-105,-130,s)];
   aim=[0,1.1,-47];fov=49;
 }
 camera.fov=fov;camera.position.set(eye[0],eye[1],d+eye[2]);
 camera.lookAt(V(aim[0],aim[1],d+aim[2]));camera.updateProjectionMatrix();
}
const format=value=>value>=60?'01:00':'00:'+String(Math.floor(value)).padStart(2,'0');
function render(value){
 t=clamp(value,0,60);shot=cuts.slice(1,-1).filter(c=>t>=c).length;
 train=motion(t);engine.position.z=train.distance;atmosphere.nose.value=train.distance;
 atmosphere.night.value=.12*smooth((t-4)/30)+.88*smooth((t-39)/19);
 atmosphere.bore.value=smooth((t-39.9)/.6)*(1-smooth((t-43)/2.8));
 cameraAt(t,train.distance);flakes(t);renderer.render(scene,camera);
 $('time').textContent=format(t)+' / 01:00';$('chapter').textContent=titles[shot];
 $('scrub').value=t;$('scrub').style.setProperty('--progress',(t/60*100)+'%');
}
function controls(){
 stage.classList.toggle('watching',!poster);$('credits').hidden=$('posterControls').hidden=!poster;$('transport').hidden=poster;
 $('startText').textContent=t>=60?'Replay':'Start film';
 $('start').setAttribute('aria-label',t>=60?'Replay film':'Start film');
 $('pause').classList.toggle('running',playing);$('pause').firstElementChild.className=playing?'':'playIcon';
 $('pause').setAttribute('aria-label',playing?'Pause film':'Resume film');
}
function finish(){
 playing=false;poster=true;audio.stop();controls();$('start').focus({preventScroll:true});
}
function tick(now){
 if(!playing)return;
 render((now-stamp)/1000);
 if(t>=60)finish();else frame=requestAnimationFrame(tick);
}
function seek(value){
 const n=Number(value);if(!Number.isFinite(n))return t;
 const dest=clamp(n,0,60);render(dest);
 if(dest>=60){cancelAnimationFrame(frame);finish();}
 else {poster=false;if(playing){stamp=performance.now()-t*1000;audio.play(t);}controls();}
 return t;
}
function toggle(){
 if(playing){cancelAnimationFrame(frame);render((performance.now()-stamp)/1000);if(t>=60){finish();return;}playing=false;audio.stop();}
 else{
   audio.unlock();if(t>=60)render(0);
   playing=true;poster=false;stamp=performance.now()-t*1000;audio.play(t);frame=requestAnimationFrame(tick);
 }
 controls();
}
function resize(){
 const box=stage.getBoundingClientRect();
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5,1080/box.width));
 renderer.setSize(box.width,box.height,false);render(t);
}
function init(){
 renderer=new T.WebGLRenderer({canvas:$('film'),antialias:true,alpha:false,powerPreference:'high-performance'});
 sky(scene,camera);buildWorld(scene);engine=buildTrain(scene);flakes=weather(scene,renderer);
 resize();new ResizeObserver(resize).observe(stage);
 Object.defineProperty(window,'__scene',{value:{get shot(){return shot;},get time(){return t;},get playing(){return playing;},seek,get train(){return {...train};}}});
 $('start').disabled=false;controls();
 $('start').onclick=toggle;$('pause').onclick=toggle;$('film').onclick=()=>{if(!poster)toggle();};
 $('next').onclick=()=>seek(cuts[shot+1]);$('scrub').oninput=e=>seek(e.target.value);
 $('sound').onclick=()=>{audio.toggle();$('sound').setAttribute('aria-pressed',audio.muted);$('sound').setAttribute('aria-label',audio.muted?'Unmute sound':'Mute sound');};
 window.addEventListener('keydown',e=>{
   if(e.altKey||e.metaKey||e.ctrlKey||e.repeat)return;
   if(e.code==='Space'&&e.target.matches('button'))return;
   if(e.code==='Space'||e.code==='KeyK'){e.preventDefault();toggle();}
   if(e.code==='ArrowRight'||e.code==='KeyN'){e.preventDefault();seek(cuts[shot+1]);}
   if(e.code==='KeyM')$('sound').click();
 });
}
try{init();}catch(error){$('notice').textContent='The film needs WebGL. Enable graphics acceleration and reload to start.';console.error(error);}

