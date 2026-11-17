import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#b9dfe2'); scene.fog=new THREE.Fog('#c4e2df',70,180);
const camera=new THREE.PerspectiveCamera(38,1,.1,400); camera.position.set(22,15,29);
const controls=new OrbitControls(camera,canvas); controls.enableDamping=true; controls.dampingFactor=.06; controls.minDistance=8; controls.maxDistance=80; controls.maxPolarAngle=Math.PI/2.05; controls.target.set(0,2,0); controls.enablePan=false;
scene.add(new THREE.HemisphereLight(0xe9ffff,0x879b71,2.1)); const sun=new THREE.DirectionalLight(0xfff4d8,2.5); sun.position.set(-20,35,20); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:.1,far:100}); sun.shadow.bias=-.0003; scene.add(sun);
const mat=(c,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness,metalness});
const ground=mat('#a2bd88'), dark=mat('#315b53'), pale=mat('#e9e7d7'), white=mat('#f5f0dd'), orange=mat('#d9865d'), teal=mat('#315e61'), glass=mat('#7cb7b5',.18,.3), concrete=mat('#aebeb0');
function mesh(geo,material,parent=scene,x=0,y=0,z=0){let o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function cylinder(radiusTop,radiusBottom,height,material,parent=scene,x=0,y=0,z=0,segments=48){return mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,height,segments),material,parent,x,y,z)}
mesh(new THREE.PlaneGeometry(400,400),ground).rotation.x=-Math.PI/2;
// Distant soft-edged islands and trees give the launch site a sense of scale.
const hillColors=['#90b28e','#9cb99a','#85aa8e'];
for(let i=0;i<15;i++){let x=-100+i*15,z=-62-Math.random()*24;let h=10+Math.random()*12;let hill=mesh(new THREE.ConeGeometry(16+Math.random()*10,h,5),mat(hillColors[i%3]),scene,x,h/2-1,z);hill.rotation.y=Math.random()*3;hill.receiveShadow=true}
function tree(x,z,s=1){let g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cylinder(.13,.18,1.8,mat('#886f57'),g,0,.9,0,7);for(let i=0;i<3;i++)mesh(new THREE.ConeGeometry(1.05-i*.19,2.1,7),mat(['#658e72','#729b7d','#80a987'][i]),g,0,1.7+i*.65,0);}
for(let i=0;i<80;i++){let a=Math.random()*Math.PI*2,r=19+Math.random()*47;tree(Math.cos(a)*r,Math.sin(a)*r,.6+Math.random()*.9)}
// Circular raised pad, painted markings and perimeter lamps.
cylinder(9.2,9.5,.45,mat('#708b7e'),scene,0,.23,0,96);cylinder(8.9,8.9,.12,concrete,scene,0,.51,0,96);cylinder(7.4,7.4,.025,mat('#c7d1be'),scene,0,.59,0,96);cylinder(5.9,5.9,.03,mat('#79978b'),scene,0,.62,0,96);
function ring(inner,outer,color,y){let o=mesh(new THREE.RingGeometry(inner,outer,96),mat(color));o.rotation.x=-Math.PI/2;o.position.y=y;return o}ring(6.55,6.65,'#f4edcf',.64);ring(4.65,4.73,'#e3e5cf',.65);
for(let i=0;i<12;i++){let a=i*Math.PI/6;let stripe=mesh(new THREE.BoxGeometry(.18,.025,.8),white,scene,Math.sin(a)*7.8,.65,Math.cos(a)*7.8);stripe.rotation.y=a;let lamp=cylinder(.19,.23,.18,dark,scene,Math.sin(a)*8.65,.7,Math.cos(a)*8.65,12);cylinder(.11,.11,.08,mat('#ffe4a0'),lamp,0,.13,0,12)}
// A compact, friendly spacecraft, pointing along its local positive Z axis.
const ship=new THREE.Group();scene.add(ship);ship.position.y=2.4;
let body=mesh(new THREE.SphereGeometry(1,32,24),white,ship);body.scale.set(1.28,.52,1.85);
let belly=mesh(new THREE.SphereGeometry(1,32,20),teal,ship,0,-.25,-.05);belly.scale.set(1.12,.34,1.54);
let cockpit=mesh(new THREE.SphereGeometry(1,32,20),glass,ship,0,.38,.48);cockpit.scale.set(.68,.42,.9);
let cockpitBase=mesh(new THREE.SphereGeometry(1,32,20),pale,ship,0,.24,.42);cockpitBase.scale.set(.78,.25,1.03);cockpit.position.y=.43;
for(let side of [-1,1]){let wing=mesh(new THREE.BoxGeometry(1.65,.13,1.2),white,ship,side*1.45,-.03,-.4);wing.rotation.y=side*.23;let tip=mesh(new THREE.BoxGeometry(.45,.16,.8),orange,ship,side*2.15,.02,-.52);tip.rotation.y=side*.23;let engine=cylinder(.36,.45,1.05,teal,ship,side*.78,-.23,-1.45,24);engine.rotation.x=Math.PI/2;let glow=cylinder(.26,.26,.04,mat('#f3b56e'),ship,side*.78,-.23,-2,24);glow.rotation.x=Math.PI/2;}
let fin=mesh(new THREE.BoxGeometry(.13,.72,.8),orange,ship,0,.53,-1.15);fin.rotation.x=-.25;
for(let side of [-1,1]){let leg=mesh(new THREE.BoxGeometry(.1,.7,.1),teal,ship,side*.75,-.67,0);leg.rotation.z=side*.25;mesh(new THREE.BoxGeometry(.5,.1,.32),teal,ship,side*.86,-1,0)}
const shadow=cylinder(2.15,2.15,.01,new THREE.MeshBasicMaterial({color:'#375d51',transparent:true,opacity:.13,depthWrite:false}),scene,0,.67,0,48);shadow.scale.z=.7;
// Low clouds are deliberately simple and light, leaving a clear silhouette.
function cloud(x,y,z,s){let g=new THREE.Group();scene.add(g);g.position.set(x,y,z);g.scale.setScalar(s);for(let i=0;i<4;i++){let p=mesh(new THREE.SphereGeometry(1,12,8),mat('#edf5e8'),g,(i-1.5)*1.15,Math.sin(i*2)*.22,0);p.scale.set(1.2,.45,.55);p.castShadow=false}}
cloud(-25,20,-48,3);cloud(18,25,-65,4);cloud(60,17,-55,2.5);
const launch=document.querySelector('#launch'),status=document.querySelector('#status'),label=document.querySelector('#launch-label');let phase='ready',start=0;let previous=new THREE.Vector3();const initialTarget=new THREE.Vector3(0,2,0);const initialCamera=new THREE.Vector3(22,15,29);
launch.addEventListener('click',()=>{if(phase!=='ready')return;phase='lap';start=performance.now();launch.disabled=true;label.textContent='Departure in progress';status.textContent='Taking a scenic lap';document.querySelector('.eyebrow').lastChild.textContent=' THE ADVENTURE BEGINS';});
document.querySelector('#reset').addEventListener('click',()=>{let target=phase==='ready'?initialTarget:ship.position;controls.target.copy(target);camera.position.copy(target).add(initialCamera.clone().sub(initialTarget));controls.update()});
const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);let t=clock.getElapsedTime();previous.copy(ship.position);if(phase==='ready'){ship.position.y=2.35+Math.sin(t*1.4)*.12;ship.rotation.z=Math.sin(t*.9)*.025;}else {let elapsed=(performance.now()-start)/1000;if(elapsed<19){let u=elapsed/19;let a=u*Math.PI*2;let ease=Math.sin(Math.PI*Math.min(u/.12,1)/2);let radius=9*ease;ship.position.set(Math.sin(a)*radius,2.4+Math.sin(u*Math.PI)*2.2,Math.cos(a)*radius-radius);ship.rotation.y=Math.atan2(Math.cos(a),-Math.sin(a));ship.rotation.z=-.08*Math.sin(Math.PI*u); }else{if(phase!=='away'){phase='away';status.textContent='On its way to the stars';label.textContent='Bon voyage!'}let u=elapsed-19;ship.position.set(0,2.4+u*.48,-Math.min(u*2.5,180));ship.rotation.y=Math.PI;ship.rotation.z=0;}let delta=ship.position.clone().sub(previous);controls.target.add(delta);camera.position.add(delta);shadow.position.x=ship.position.x;shadow.position.z=ship.position.z;shadow.material.opacity=Math.max(0,.13-(ship.position.y-2.4)*.015);}
controls.update();renderer.render(scene,camera)}
function resize(){let w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(w<700&&phase==='ready'){camera.position.set(25,18,34);controls.target.set(0,1,0)}}window.addEventListener('resize',resize);resize();animate();
