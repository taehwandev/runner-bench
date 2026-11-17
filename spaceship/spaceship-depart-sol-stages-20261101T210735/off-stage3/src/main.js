import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const $ = id => document.getElementById(id);
const host=$('world');
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9e8e1');scene.fog=new THREE.Fog('#d9e8e1',95,290);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(38,1,.1,1600);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=17;controls.maxDistance=85;controls.maxPolarAngle=Math.PI*.465;controls.minPolarAngle=.15;controls.autoRotateSpeed=.65;
scene.add(new THREE.HemisphereLight(0xf2fbff,0xb6bba0,2.7));const sun=new THREE.DirectionalLight(0xfff7dd,3.1);sun.position.set(-28,50,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:150});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const grass=mat('#a9b69b'),sand=mat('#d9d6b9'),dark=mat('#4b5d54'),edge=mat('#889184'),cream=mat('#f0eee0',.46,.3),orange=mat('#d77d43',.5,.22),glass=mat('#254549',.16,.7),metal=mat('#6f8078',.4,.55);
function mesh(geo,material,parent=scene,x=0,y=0,z=0){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(w,h,d,m,p=scene,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
const cyl=(a,b,h,m,p=scene,x=0,y=0,z=0,n=64)=>mesh(new THREE.CylinderGeometry(a,b,h,n),m,p,x,y,z);
const water=mesh(new THREE.PlaneGeometry(3000,3000),mat('#b2ccc2',.32,.12),scene,0,-1.2,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
let seed=182;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
function island(radius,y,color){const shape=new THREE.Shape();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;const r=radius*(1+.09*Math.sin(a*3)+.04*Math.cos(a*7));const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;if(!i)shape.moveTo(x,z);else shape.lineTo(x,z);}const geo=new THREE.ExtrudeGeometry(shape,{depth:1.1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:1.5,bevelThickness:.6});const o=mesh(geo,color,scene,0,y,0);o.rotation.x=-Math.PI/2;return o;}
island(58,-1,sand);island(52,-.45,grass);
// Quiet ripples around the shore.
for(let i=0;i<8;i++){const r=62+i*3;const arc=new THREE.EllipseCurve(0,0,r,r*.8,0,Math.PI*2);const g=new THREE.BufferGeometry().setFromPoints(arc.getPoints(140).map(p=>new THREE.Vector3(p.x,-1.15,p.y)));scene.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xd1e1d5,transparent:true,opacity:.2-i*.017})));}
// Low poly mountains provide depth and a calm horizon.
for(let i=0;i<27;i++){const x=-145+i*12,z=-92-rand()*47,h=10+rand()*20;const mountain=mesh(new THREE.ConeGeometry(13+rand()*16,h,5),mat(new THREE.Color().setHSL(.36,.1,.56+rand()*.13)),scene,x,h/2-2,z);mountain.rotation.y=rand()*6;}
// Landing apron and inset concentric rings.
cyl(10.6,11, .35,sand,scene,0,.78,0,80);cyl(9.1,9.4,.42,edge,scene,0,1.05,0,80);cyl(8.7,8.7,.14,dark,scene,0,1.33,0,80);
function ring(r,t,m,y=1.415){const o=mesh(new THREE.RingGeometry(r-t,r,128),m,scene,0,y,0);o.rotation.x=-Math.PI/2;o.castShadow=false;return o;}
ring(8.18,.07,mat('#dad7ae'));ring(6.6,.12,mat('#9da99a'));ring(3.7,.045,mat('#7b8e7d'));
for(let i=0;i<32;i++){const a=i/32*Math.PI*2;const tick=box(.09,.02,i%4===0?.65:.25,mat('#b3bba7'),scene,Math.sin(a)*7.65,1.43,Math.cos(a)*7.65);tick.rotation.y=a;}
const padCanvas=document.createElement('canvas');padCanvas.width=512;padCanvas.height=512;const pc=padCanvas.getContext('2d');pc.fillStyle='#c6cebc';pc.font='500 140px sans-serif';pc.textAlign='center';pc.fillText('01',256,294);pc.font='18px sans-serif';pc.fillText('A S T E R  /  L A N D I N G',256,350);const padLabel=mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(padCanvas),transparent:true,depthWrite:false}),scene,0,1.44,0);padLabel.rotation.x=-Math.PI/2;padLabel.rotation.z=Math.PI;padLabel.castShadow=false;
const lightMat=new THREE.MeshStandardMaterial({color:'#dcebc1',emissive:'#d4ed9a',emissiveIntensity:1.8});
for(let i=0;i<8;i++){let a=i*Math.PI/4;cyl(.14,.17,.13,lightMat,scene,Math.cos(a)*8.85,1.4,Math.sin(a)*8.85,12);}
// Service road and paintwork.
box(5,.025,38,mat('#bdc1ab'),scene,0,.69,28);for(let i=0;i<12;i++)box(.08,.03,1,mat('#e6e7cd'),scene,0,.72,13+i*2.6);
// Outpost buildings, roof ribs, a satellite dish and a windsock.
const base=new THREE.Group();base.position.set(21,0,-11);scene.add(base);box(11,3.8,7,cream,base,0,2.5,0);box(11.6,.45,7.6,mat('#8b9d8e'),base,0,4.6,0);box(6,2.6,.08,glass,base,-.8,2.2,3.55);for(let i=0;i<5;i++)box(.09,2.6,.13,edge,base,-3.3+i*1.3,2.2,3.62);box(2,2,.1,orange,base,4,1.8,3.6);for(let i=0;i<8;i++)box(.08,.18,7.3,metal,base,-5+i*1.4,4.91,0);cyl(.12,.16,5,metal,base,3,7.2,-1);const dish=mesh(new THREE.SphereGeometry(1.6,20,12,0,Math.PI*2,0,.85),cream,base,3,9.1,-1);dish.rotation.z=-.5;
for(let i=0;i<3;i++){box(2.2,1.3,2,mat('#a0ac98'),scene,16+i*2.8,1.3,-3);box(.12,1.34,2.05,edge,scene,15.5+i*2.8,1.3,-3);}
cyl(.08,.12,9,metal,scene,-14,5,0,12);const sock=new THREE.Group();sock.position.set(-14,9.3,0);sock.rotation.z=-1.15;scene.add(sock);for(let i=0;i<5;i++)cyl(.28-i*.027,.3-i*.027,.45,i%2?cream:orange,sock,0,-i*.45,0,12);
// A scatter of sculptural pines, shrubs, and warm stone.
const treeMat=[mat('#638374'),mat('#79927b'),mat('#8ba184')];function tree(x,z,s){const p=new THREE.Group();scene.add(p);p.position.set(x,.5,z);cyl(.12*s,.19*s,1.6*s,mat('#7b8062'),p,0,.8*s,0,6);for(let j=0;j<3;j++)mesh(new THREE.ConeGeometry((1.15-j*.23)*s,2.5*s,7),treeMat[Math.floor(rand()*3)],p,0,(2.1+j*.9)*s,0);}
for(let i=0;i<90;i++){const a=rand()*Math.PI*2,r=20+rand()*28,x=Math.cos(a)*r,z=Math.sin(a)*r*.73;if(Math.abs(x)<5&&z>0||x>13&&x<30&&z<0&&z>-18)continue;tree(x,z,.6+rand()*.8);}
for(let i=0;i<35;i++){const a=rand()*6.28,r=16+rand()*33;const stone=mesh(new THREE.DodecahedronGeometry(.4+rand()*.9,0),mat('#b6b8a0'),scene,Math.cos(a)*r,.7,Math.sin(a)*r*.75);stone.scale.set(1.5,.65,1);stone.rotation.y=rand()*6;}
// Cloud clusters are physical forms in the bright sky.
const cloudMat=mat('#f0f5e9');for(let i=0;i<15;i++){const cl=new THREE.Group();scene.add(cl);cl.position.set(-160+i*25,35+rand()*15,-90-rand()*70);for(let j=0;j<4;j++){const c=mesh(new THREE.SphereGeometry(3+rand()*3,12,8),cloudMat,cl,j*4,rand()*2,0);c.scale.y=.5;c.castShadow=false;}}
// Explorer: a compact ceramic fuselage, swept wings and twin engines.
const ship=new THREE.Group();scene.add(ship);ship.position.set(0,4.1,0);ship.scale.setScalar(1.1);
const hull=mesh(new THREE.SphereGeometry(1,40,28),cream,ship,0,0,0);hull.scale.set(1.05,.59,2.25);
const underside=mesh(new THREE.SphereGeometry(1,32,16),metal,ship,0,-.23,.25);underside.scale.set(.88,.34,1.65);
const canopy=mesh(new THREE.SphereGeometry(1,36,20),glass,ship,0,.44,-.52);canopy.scale.set(.68,.48,1.16);const canopyFrame=mesh(new THREE.TorusGeometry(.66,.035,8,40,Math.PI),cream,ship,0,.49,-.7);canopyFrame.rotation.y=Math.PI/2;
box(.17,.055,1.1,orange,ship,0,.55,1.05);
function wing(sign){const shape=new THREE.Shape();shape.moveTo(.65,-.6);shape.lineTo(3.65,1);shape.lineTo(3.45,1.65);shape.lineTo(.7,1.2);shape.closePath();const w=mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.06,bevelThickness:.04,bevelSegments:2}),cream,ship);w.rotation.x=Math.PI/2;w.scale.x=sign;w.position.y=-.05;const strip=box(.27,.08,1.05,orange,ship,sign*2.7,-.04,1.04);strip.rotation.y=sign*-.3;
const engine=cyl(.37,.43,1.6,cream,ship,sign*1.75,-.12,1.08,32);engine.rotation.x=Math.PI/2;const collar=cyl(.43,.43,.35,orange,ship,sign*1.75,-.12,1.8,32);collar.rotation.x=Math.PI/2;const outlet=cyl(.3,.34,.12,dark,ship,sign*1.75,-.12,2,32);outlet.rotation.x=Math.PI/2;const glow=cyl(.21,.26,.13,new THREE.MeshStandardMaterial({color:'#c5f1d3',emissive:'#7de4d5',emissiveIntensity:3}),ship,sign*1.75,-.12,2.08,24);glow.rotation.x=Math.PI/2;
const flame=mesh(new THREE.ConeGeometry(.22,1.15,20),new THREE.MeshBasicMaterial({color:'#a2eede',transparent:true,opacity:.65}),ship,sign*1.75,-.12,2.6);flame.rotation.x=Math.PI/2;flames.push(flame);
const fin=box(.12,.72,.75,orange,ship,sign*.75,.65,1.4);fin.rotation.z=sign*-.3;
for(const z of [-.7,1.1]){const leg=box(.1,.48,.13,metal,ship,sign*.64,-.63,z);leg.rotation.z=sign*-.3;box(.36,.09,.5,dark,ship,sign*.72,-.88,z);}}
const flames=[];wing(1);wing(-1);const noseLight=mesh(new THREE.SphereGeometry(.08,12,8),lightMat,ship,0,.02,-2.17);
ship.rotation.y=-.55;
let launched=false,startTime=0,completed=false,paused=false,pauseStarted=0,autoOrbit=false,freezeTarget=null;let flightTime=0;const clock=new THREE.Clock();const initialTarget=new THREE.Vector3();let lastTarget=new THREE.Vector3();
function mobile(){return innerWidth<=760;}
function defaultView(){const m=mobile();const target=launched?ship.position.clone():new THREE.Vector3(m?0:-8,m?3.4:1.5,0);camera.position.copy(target).add(new THREE.Vector3(m?32:31,m?23:21,m?39:38));controls.target.copy(target);lastTarget.copy(target);controls.update();}
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.fov=mobile()?44:38;camera.updateProjectionMatrix();}resize();defaultView();initialTarget.copy(controls.target);addEventListener('resize',()=>{resize();if(!launched)defaultView();});
let noticeTimer;function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),2600);}
$('orbit').onclick=()=>{autoOrbit=!autoOrbit;controls.autoRotate=autoOrbit;$('orbit').setAttribute('aria-pressed',String(autoOrbit));$('camera-mode').textContent=autoOrbit?'AUTO ORBIT':launched?'FOLLOW CAMERA':'FREE ORBIT';};
function zoom(factor){const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}
$('zoom-in').onclick=()=>zoom(.83);$('zoom-out').onclick=()=>zoom(1.2);
$('reset').onclick=()=>{autoOrbit=false;controls.autoRotate=false;$('orbit').setAttribute('aria-pressed','false');defaultView();$('camera-mode').textContent=launched?'FOLLOW CAMERA':'FREE ORBIT';notice('Camera reset');};
function updateFlightButton(){
  const label=completed?'Replay departure':paused?'Resume departure':'Pause departure';
  const icon=completed?'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>':paused?'<path d="M8 5l11 7-11 7z"/>':'<path d="M8 5v14M16 5v14"/>';
  $('launch').disabled=false;
  $('launch').innerHTML=`${label} <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
}
function startDeparture(){
  if(completed){
    launched=false;completed=false;ship.position.set(0,4.1,0);ship.rotation.set(0,-.55,0);defaultView();
  }
  launched=true;paused=false;pauseStarted=0;flightTime=0;freezeTarget=null;startTime=clock.getElapsedTime();
  initialTarget.copy(controls.target);updateFlightButton();
  $('mission-title').textContent='A last look around.';
  $('mission-description').textContent='One gentle lap. Taking the scenic route.';
  $('status').textContent='In flight';$('phase-text').textContent='01 / OUTPOST CIRCUIT';
  $('scene-state').textContent='TRACKING';$('tag-state').textContent='OUTPOST CIRCUIT';
  $('flight-time').textContent='42 SECONDS REMAINING';$('progress-fill').style.width='0%';
  $('camera-mode').textContent=autoOrbit?'AUTO ORBIT':'FOLLOW CAMERA';
  notice('Departure initiated. Enjoy the view.');
}
$('launch').onclick=()=>{
  if(!launched||completed){startDeparture();return;}
  const now=clock.getElapsedTime();
  if(paused){startTime+=now-pauseStarted;paused=false;}
  else{pauseStarted=now;paused=true;}
  updateFlightButton();notice(paused?'Flight paused. You can still explore the view.':'Departure resumed.');
};
const prevPosition=new THREE.Vector3();const direction=new THREE.Vector3();const desiredTarget=new THREE.Vector3();const projected=new THREE.Vector3();let frame=0;
function flightPosition(t){if(t<=24){const a=t/24*Math.PI*2;return new THREE.Vector3(8*Math.sin(a),4.1+2*(t/24)+.25*Math.sin(a),8*(1-Math.cos(a)));}const d=t-24;return new THREE.Vector3(2.094*d+.19*d*d,6.1+.32*d+.045*d*d,-.08*d*d);}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),now=clock.elapsedTime;
if(!launched){ship.position.y=4.1+Math.sin(now*1.5)*.16;ship.rotation.z=Math.sin(now*.85)*.025;}else{flightTime=(paused?pauseStarted:now)-startTime;const flightDt=paused?0:dt;prevPosition.copy(ship.position);ship.position.copy(flightPosition(flightTime));direction.copy(flightPosition(flightTime+.04)).sub(ship.position).normalize();const heading=Math.atan2(-direction.x,-direction.z);ship.rotation.y+=Math.atan2(Math.sin(heading-ship.rotation.y),Math.cos(heading-ship.rotation.y))*Math.min(flightDt*2,1);ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,flightTime<24?-.14:0,flightDt*2);ship.rotation.x=THREE.MathUtils.lerp(ship.rotation.x,flightTime<24?0:.12,flightDt);
if(flightTime<42){desiredTarget.copy(ship.position);const blend=THREE.MathUtils.smoothstep(flightTime,0,4);desiredTarget.lerp(initialTarget,1-blend);const delta=desiredTarget.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(desiredTarget);}else if(!completed){desiredTarget.copy(flightPosition(42));camera.position.add(desiredTarget.clone().sub(controls.target));controls.target.copy(desiredTarget);completed=true;freezeTarget=desiredTarget.clone();$('mission-title').textContent='On to the next horizon.';$('mission-description').textContent='A little explorer, with a whole sky ahead.';$('status').textContent='Departed';updateFlightButton();$('phase-text').textContent='MISSION COMPLETE';$('flight-time').textContent='SAFE TRAVELS';$('tag-state').textContent='ONWARD & UPWARD';$('scene-state').textContent='DEPARTED';$('camera-mode').textContent=autoOrbit?'AUTO ORBIT':'FREE ORBIT';notice('Explorer–01 has left the outpost. Safe travels.');}
if(!completed){$('status').textContent=paused?'Paused':flightTime<24?'In flight':'Departing';$('scene-state').textContent=paused?'PAUSED':'TRACKING';$('tag-state').textContent=paused?'FLIGHT PAUSED':flightTime<24?'OUTPOST CIRCUIT':'DEPARTING';}
if(flightTime>=24&&flightTime<42){$('mission-title').textContent='Somewhere new awaits.';$('mission-description').textContent='Leaving the familiar. Following the horizon.';$('phase-text').textContent='02 / INTO THE DISTANCE';}if(!completed)$('flight-time').textContent=`${Math.max(0,Math.ceil(42-flightTime))} SECONDS REMAINING`;$('progress-fill').style.width=`${Math.min(100,flightTime/42*100)}%`;
}
flames.forEach((f,i)=>{f.scale.y=(launched?1.4: .5)+Math.sin((launched?flightTime:now)*19+i)*.12;f.material.opacity=launched?.75:.4;});
// Keep sunlight and its shadow frustum with the explorer as it leaves.
if(launched){sun.position.set(ship.position.x-28,ship.position.y+50,ship.position.z+15);sun.target.position.copy(ship.position);}
controls.update();renderer.render(scene,camera);
if(frame++%2===0){projected.copy(ship.position).add(new THREE.Vector3(3,1,0)).project(camera);const x=(projected.x*.5+.5)*host.clientWidth,y=(-projected.y*.5+.5)*host.clientHeight;const tag=$('ship-tag');tag.style.left=`${Math.min(host.clientWidth-(mobile()?125:175),Math.max(mobile()?20:host.clientWidth*.4,x+12))}px`;tag.style.top=`${y-18}px`;tag.style.opacity=completed||projected.z>1||y<130||y>host.clientHeight-240?'0':'1';}
}
animate();setTimeout(()=>{$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),750);},350);
