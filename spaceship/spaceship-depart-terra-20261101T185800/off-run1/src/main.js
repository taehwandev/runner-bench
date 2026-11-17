import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c5e4e6');
scene.fog = new THREE.Fog('#c5e4e6', 38, 110);
const camera = new THREE.PerspectiveCamera(39, innerWidth/innerHeight, .1, 300);
camera.position.set(14, 11, 19);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .06; controls.minDistance = 8; controls.maxDistance = 42; controls.maxPolarAngle = Math.PI*.48;
controls.target.set(0,2,0); controls.update();
scene.add(new THREE.HemisphereLight(0xf8ffff,0x769880,2.15));
const sun = new THREE.DirectionalLight(0xfff4d8,3.1); sun.position.set(-12,24,12); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:70}); sun.shadow.bias=-.0004; scene.add(sun);
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const grass=mat('#9dbb9b'), darkGrass=mat('#739b82'), concrete=mat('#d3d8c8'), padmat=mat('#879d91'), cream=mat('#f3ead6'), orange=mat('#e68f5e'), dark=mat('#345d58',.42,.25), glass=mat('#7caaa5',.22,.35), metal=mat('#aabeb2',.4,.5);
function mesh(geo, material, x=0,y=0,z=0, parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(radiusTop,radiusBottom,height,material,x,y,z,parent=scene,segments=48){return mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,height,segments),material,x,y,z,parent)}
// Sea and a low, sculpted island.
mesh(new THREE.PlaneGeometry(240,240),mat('#94c8c6',.55),0,-1.7,0).rotation.x=-Math.PI/2;
cylinder(24,25,1.5,grass,0,-.75,0,scene,80);
cylinder(21.5,23,.35,darkGrass,0,.05,0,scene,80);
cylinder(20.8,21.5,.28,grass,0,.2,0,scene,80);
// Landing pad, rings and stenciled markings.
cylinder(6.8,7.1,.38,concrete,0,.39,0); cylinder(6.28,6.35,.12,padmat,0,.63,0);
function ring(inner,outer,y,material){const m=mesh(new THREE.RingGeometry(inner,outer,96),material,0,y,0);m.rotation.x=-Math.PI/2;return m}
ring(5.45,5.55,.705,cream); ring(3.6,3.67,.708,cream); ring(2.25,2.3,.709,cream);
for(let i=0;i<12;i++){const a=i*Math.PI/6; const tick=mesh(new THREE.BoxGeometry(.12,.025,.55),cream,Math.sin(a)*4.75,.72,Math.cos(a)*4.75);tick.rotation.y=a;}
for(let i=0;i<4;i++){const a=i*Math.PI/2+.2;const x=Math.sin(a)*7.45,z=Math.cos(a)*7.45;cylinder(.22,.28,.35,dark,x,.55,z);cylinder(.13,.13,.13,orange,x,.78,z)}
// A few small structures and trees give the landscape a sense of scale.
const building=mesh(new THREE.BoxGeometry(3.1,1.35,2.1),cream,-10,.98,-4); building.rotation.y=-.35;
const roof=mesh(new THREE.BoxGeometry(3.35,.18,2.35),dark,-10,1.72,-4);roof.rotation.y=-.35;
const windowMat=mat('#659591',.25,.2);const win=mesh(new THREE.BoxGeometry(1.6,.48,.04),windowMat,-10,1.12,-2.91);win.rotation.y=-.35;
for(let i=0;i<3;i++){const box=mesh(new THREE.BoxGeometry(.65,.5,.65),i===1?orange:cream,-8.7+i*.75,.54,-1.4);box.rotation.y=.2}
function tree(x,z,s){cylinder(.12*s,.18*s,1.4*s,mat('#8d8c70'),x,1*s,z,scene,8);const crown=mesh(new THREE.ConeGeometry(.8*s,2.4*s,7),darkGrass,x,2.4*s,z);crown.rotation.y=x;mesh(new THREE.ConeGeometry(.58*s,1.9*s,7),grass,x,3.1*s,z)}
[[-14,1,1],[-12,5,.85],[-15,-6,1.1],[-9,-10,.8],[-3,-14,1.1],[5,-14,.9],[11,-10,1.15],[14,-5,.9],[15,3,1.1],[12,9,.8],[-8,12,.85]].forEach(t=>tree(...t));
// Distant islands are deliberately soft, so the silhouette of the ship stays readable.
for(let i=0;i<9;i++){let a=i*2.4;let d=33+i%3*8;let hill=mesh(new THREE.SphereGeometry(1,24,12),mat(i%2?'#abc6b6':'#a4c2b3'),Math.cos(a)*d,-1,Math.sin(a)*d);hill.scale.set(8+i%3*2,2+i%2,5+i%4);}
// Ship: a compact, friendly exploration craft built around a forward-facing cabin.
const ship=new THREE.Group();scene.add(ship);
const body=mesh(new THREE.SphereGeometry(1,40,24),cream,0,0,0,ship);body.scale.set(1.08,.65,1.55);
const belly=mesh(new THREE.SphereGeometry(1,32,20),dark,0,-.23,.05,ship);belly.scale.set(.99,.4,1.37);
const stripe=mesh(new THREE.SphereGeometry(1,32,20),orange,0,.03,-.14,ship);stripe.scale.set(1.095,.2,1.25);
const cabin=mesh(new THREE.SphereGeometry(1,32,20),glass,0,.48,-.3,ship);cabin.scale.set(.64,.42,.77);
const cap=mesh(new THREE.SphereGeometry(1,32,16),cream,0,.67,.02,ship);cap.scale.set(.46,.14,.47);
for(const side of [-1,1]){const wing=mesh(new THREE.BoxGeometry(.95,.13,1.05),cream,side*1.12,-.04,.25,ship);wing.rotation.y=side*.25;const pod=cylinder(.3,.3,1.35,dark,side*1.55,-.02,.34,ship,24);pod.rotation.x=Math.PI/2;const nose=mesh(new THREE.SphereGeometry(.3,24,12),orange,side*1.55,-.02,-.34,ship);nose.scale.z=.65;const nozzle=cylinder(.22,.28,.15,metal,side*1.55,-.02,1.03,ship,24);nozzle.rotation.x=Math.PI/2;}
const tail=mesh(new THREE.BoxGeometry(.12,.62,.72),orange,0,.38,.93,ship);tail.rotation.x=-.4;
for(const side of [-1,1]){const leg=mesh(new THREE.CylinderGeometry(.055,.055,.62,12),metal,side*.72,-.53,.55,ship);leg.rotation.z=side*.28;const foot=mesh(new THREE.BoxGeometry(.38,.09,.2),dark,side*.8,-.83,.55,ship)}
const flameMat=new THREE.MeshBasicMaterial({color:'#b9f5e8',transparent:true,opacity:.8});
const flames=[];for(const side of [-1,1]){let f=mesh(new THREE.ConeGeometry(.18,.7,16),flameMat,side*1.55,-.02,1.4,ship);f.rotation.x=-Math.PI/2;flames.push(f)}
ship.position.set(0,2.1,0);ship.rotation.y=-.35;
// Decorative wisps in the sky.
const cloudMat=new THREE.MeshBasicMaterial({color:'#f5faf0',transparent:true,opacity:.65,depthWrite:false});
for(let i=0;i<7;i++){const cloud=new THREE.Group();for(let j=0;j<3;j++){const p=mesh(new THREE.SphereGeometry(1,16,10),cloudMat,j*1.5,Math.sin(j)*.2,0,cloud);p.scale.set(1.7,.3,.65)}cloud.position.set(-32+i*10,15+i%3*3,-35-i%2*8);scene.add(cloud)}
const launch=document.querySelector('#launch'), statusLabel=document.querySelector('#status-label'), statusDetail=document.querySelector('#status-detail'), statusTime=document.querySelector('#status-time'), progress=document.querySelector('#progress');
let start=null, finished=false;const clock=new THREE.Clock();let previousShip=ship.position.clone();
launch.addEventListener('click',()=>{if(start!==null)return;start=clock.getElapsedTime();launch.disabled=true;launch.querySelector('span:nth-child(2)').textContent='Departure in progress';statusLabel.textContent='DEPARTURE UNDERWAY';});
document.querySelector('#reset').addEventListener('click',()=>{const focus=ship.position.clone();controls.target.copy(focus);camera.position.copy(focus).add(new THREE.Vector3(14,9,19));controls.update()});
document.querySelector('#zoom-in').addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target)});
document.querySelector('#zoom-out').addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target)});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(start===null){controls.target.set(innerWidth<700?0:-2,2,0)}}window.addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);const elapsed=clock.getElapsedTime();let bob=Math.sin(elapsed*2)*.09;
if(start===null){ship.position.y=2.1+bob;ship.rotation.z=Math.sin(elapsed*.8)*.025}
else {const t=elapsed-start;const lap=18, duration=30;let p;if(t<lap){const angle=(t/lap)*Math.PI*2;p=new THREE.Vector3(Math.sin(angle)*5,2.4+Math.sin(angle*.5)*1.1+bob,Math.cos(angle)*5-5);ship.rotation.y=-angle-.35;ship.rotation.z=-.1*Math.sin(angle);statusDetail.textContent='A lap around the pad';}else{const u=Math.min((t-lap)/(duration-lap),1);const ease=u*u*(3-2*u);p=new THREE.Vector3(-ease*12,2.4+ease*10+bob,-ease*48);ship.rotation.y=.24;ship.rotation.z=.04;statusDetail.textContent=u<1?'Onward to the horizon':'Journey complete';}
ship.position.copy(p);const delta=ship.position.clone().sub(previousShip);if(t>lap){camera.position.add(delta);controls.target.add(delta)}previousShip.copy(ship.position);progress.style.width=`${Math.min(t/duration*100,100)}%`;statusTime.textContent=`T + ${String(Math.floor(Math.min(t,duration)/60)).padStart(2,'0')}:${String(Math.floor(Math.min(t,duration)%60)).padStart(2,'0')}`;if(t>=duration&&!finished){finished=true;statusLabel.textContent='DEPARTURE COMPLETE';launch.querySelector('span:nth-child(2)').textContent='Bon voyage, Solstice';}}
flames.forEach((f,i)=>{f.scale.y=.7+Math.sin(elapsed*12+i)*.18});controls.update();renderer.render(scene,camera)}animate();
