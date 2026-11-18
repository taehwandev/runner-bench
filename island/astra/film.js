import {islandMesh} from './island.js';
import {screenVertex,screenFragment,meshVertex,meshFragment} from './shaders.js';

const $=s=>document.querySelector(s), canvas=$('canvas');
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});
if(!gl){
  $('.cover').innerHTML='<h1>Last Light <em>Cay</em></h1><p>This film needs WebGL. Enable hardware acceleration to play.</p>';
  throw Error('WebGL unavailable');
}
function program(vs,fs){
  const p=gl.createProgram();
  for(const [src,type] of [[vs,gl.VERTEX_SHADER],[fs,gl.FRAGMENT_SHADER]]){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p,s);
  }
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  const u={},a={};
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){
    const name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name);
  }
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){
    const name=gl.getActiveAttrib(p,i).name;a[name]=gl.getAttribLocation(p,name);
  }
  return {p,u,a};
}
const sea=program(screenVertex,screenFragment),land=program(meshVertex,meshFragment);
function buffer(values){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);return b}
const mesh=islandMesh(),terrain=buffer(mesh.vertices),screen=buffer(new Float32Array([-1,-1,3,-1,-1,3]));
function texture(unit,wrap){
  gl.activeTexture(gl.TEXTURE0+unit);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,wrap);
  for(const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);
  return tex;
}
texture(0,gl.REPEAT);
let seed=452711;const noise=new Uint8Array(65536);
for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed>>>24}
gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,256,256,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,noise);
const reflection=texture(1,gl.CLAMP_TO_EDGE),fbo=gl.createFramebuffer(),depth=gl.createRenderbuffer();
const starts=[0,16,31,44,60],names=['Landfall','The headland','Waterline','The night watch'];
const mix=(a,b,x)=>a+(b-a)*x;
function ease(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)}
function unit(v){let l=Math.hypot(...v);return v.map(x=>x/l)}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
let time=0,playing=false,mode='cover',anchor=0,raf=0,shot=0;
function camera(t){
  shot=t<16?0:t<31?1:t<44?2:3;
  let u=(t-starts[shot])/(starts[shot+1]-starts[shot]),eye,aim,lens;
  if(shot===0){
    eye=[mix(-5.6,-3.2,u),mix(8.5,6.8,u),mix(42,34,u)];aim=[0,2.75,0];lens=.475;
  }else if(shot===1){
    let a=mix(-.72,.16,u);eye=[Math.sin(a)*29,mix(12,9.2,u),Math.cos(a)*29];aim=[.25,3.35,0];lens=.54;
  }else if(shot===2){
    eye=[mix(-7.4,1.1,u),mix(1.34,1.85,u),mix(14.4,15.8,u)];aim=[mix(-1.3,1.4,u),3.5,-.9];lens=.61;
  }else{
    eye=[mix(8,12,u),mix(6.2,9.1,u),mix(24,44,u)];aim=[.6,mix(4.9,4.2,u),-.5];lens=.51;
  }
  const forward=unit(aim.map((v,i)=>v-eye[i])),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
  const sun=unit([mix(.027,-.32,t/60),mix(.21,-.13,Math.min(1,t/47)),-1]);
  return {eye,forward,right,up,sun,lamp:mesh.lamp,t,lens,night:ease(29,51,t),dusk:ease(3,28,t)};
}
let rw=0,rh=0;
function resize(){
  const {width,height}=canvas.getBoundingClientRect(),pixelBudget=matchMedia('(pointer: coarse)').matches?1140:1920;
  const ratio=Math.min(devicePixelRatio||1,1.55,pixelBudget/height);
  canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
  rw=Math.ceil(canvas.width*.5);rh=Math.ceil(canvas.height*.5);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,reflection);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,rw,rh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,reflection,0);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,rw,rh);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);render();
}
function bind(prog,view){
  gl.useProgram(prog.p);
  for(const [k,v] of Object.entries(view)){
    if(!prog.u[k])continue;
    if(Array.isArray(v))gl.uniform3fv(prog.u[k],v);else gl.uniform1f(prog.u[k],v);
  }
}
function attribute(loc,size,stride,offset){
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);
}
function drawIsland(mirror){
  gl.uniform1f(land.u.mirror,mirror);
  gl.bindBuffer(gl.ARRAY_BUFFER,terrain);
  for(const [k,size,offset] of [['pos',3,0],['norm',3,12],['pigment',3,24],['wind',1,36]])attribute(land.a[k],size,40,offset);
  gl.drawArrays(gl.TRIANGLES,0,mesh.vertices.length/10);
  for(const loc of Object.values(land.a))gl.disableVertexAttribArray(loc);
}
function render(){
  const view=camera(time);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,rw,rh);gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  bind(land,view);drawIsland(-1);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);bind(sea,view);gl.uniform1i(sea.u.grain,0);gl.uniform1i(sea.u.reflection,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,screen);attribute(sea.a.pos,2,0,0);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(sea.a.pos);
  gl.enable(gl.DEPTH_TEST);bind(land,view);drawIsland(1);
  updateUI();
}
const segments=starts.slice(0,-1).map((t,i)=>{
  let seg=document.createElement('span'),bar=document.createElement('i');seg.className='seg';seg.style.flex=starts[i+1]-t;
  seg.append(bar);$('.track').append(seg);return bar;
});
let lastUI='',lastSecond=-1;
function updateUI(){
  const second=Math.floor(time);
  if(second!==lastSecond){
    $('#clock').textContent=time===60?'01:00':'00:'+String(second).padStart(2,'0');lastSecond=second;
  }
  const key=mode+shot+playing;
  const progress=(time-starts[shot])/(starts[shot+1]-starts[shot]);
  segments[shot].style.transform='scaleX('+progress+')';
  if(key===lastUI)return;
  lastUI=key;
  segments.forEach((el,i)=>{if(i!==shot)el.style.transform=i<shot?'scaleX(1)':'scaleX(0)'});
  $('#shot').textContent='Shot 0'+(shot+1)+' / 04';$('#phase').textContent=names[shot];
  $('.cover').hidden=mode==='film';$('.live').hidden=mode!=='film';
  $('#startText').textContent=mode==='end'?'Replay':'Start film';
  $('#pause').textContent=playing?'Ⅱ':'▸';$('#pause').ariaLabel=playing?'Pause':'Resume';
}
// A loop of filtered surf and softly voiced fifths, scheduled from the film clock.
let audio,source,level,filter,voices=[];
function soundStart(){
  try{
    if(!audio){
      audio=new AudioContext();const wave=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),samples=wave.getChannelData(0);
      let value=0,s=884;
      for(let i=0;i<samples.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;value=.968*value+.032*(s/2147483648-1);samples[i]=value*3}
      source=audio.createBufferSource();source.buffer=wave;source.loop=true;filter=audio.createBiquadFilter();filter.type='lowpass';
      level=audio.createGain();level.gain.value=0;source.connect(filter).connect(level).connect(audio.destination);source.start();
      for(const hz of [110,164.81,246.94]){const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=hz;gain.gain.value=0;osc.connect(gain).connect(audio.destination);osc.start();voices.push(gain)}
    }
    audio.resume().catch(()=>{});
  }catch{}
}
function sound(){
  if(!audio||!level)return;
  const fade=playing?Math.min(1,(60-time)/1.7):0,swell=.5+.5*Math.sin(time*1.08+.45*Math.sin(time*.44));
  level.gain.setTargetAtTime(fade*(.12+.23*swell),audio.currentTime,.065);
  filter.frequency.setTargetAtTime(520+swell*1000,audio.currentTime,.08);
  voices.forEach((v,i)=>v.gain.setTargetAtTime(fade*(.007+.005*Math.cos(time*.16+i))*(.45+ease(25,52,time)),audio.currentTime,.095));
}
function tick(now){
  if(!playing)return;
  time=Math.min(60,(now-anchor)/1000);
  if(time===60){playing=false;mode='end'}
  render();sound();if(playing)raf=requestAnimationFrame(tick);
}
function seek(value){
  const x=Number(value);if(!Number.isFinite(x))return;
  time=Math.min(60,Math.max(0,x));mode=time===60?'end':'film';
  if(time===60){playing=false;cancelAnimationFrame(raf)}
  anchor=performance.now()-time*1000;render();sound();
}
function toggle(){
  if(playing){cancelAnimationFrame(raf);time=Math.min(60,(performance.now()-anchor)/1000);playing=false;if(time===60)mode='end'}
  else{if(mode==='end')time=0;mode='film';soundStart();playing=true;anchor=performance.now()-time*1000;raf=requestAnimationFrame(tick)}
  render();sound();
}
$('.start').onclick=toggle;$('#pause').onclick=toggle;$('#next').onclick=()=>seek(starts[shot+1]);
document.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.code==='Space'||e.key.toLowerCase()==='k'){e.preventDefault();toggle()}
  else if(e.key==='ArrowRight'){e.preventDefault();seek(starts[shot+1])}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)toggle()});
window.__scene={get shot(){return shot+1},get time(){return time},get playing(){return playing},seek};
new ResizeObserver(resize).observe(canvas);resize();
