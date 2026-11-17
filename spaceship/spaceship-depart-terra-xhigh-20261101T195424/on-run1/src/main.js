import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const container = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cce7e8');
scene.fog = new THREE.Fog('#d5e9e5', 38, 105);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 300);
camera.position.set(17, 9, 25);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-2, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 9;
controls.maxDistance = 48;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minPolarAngle = 0.18;
controls.update();
scene.add(new THREE.HemisphereLight('#f9f8df', '#7fae91', 2.3));
const sun = new THREE.DirectionalLight('#fff4d6', 3.2);
sun.position.set(-12, 25, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = { grass: mat('#a6c99a'), pad: mat('#d4dbca'), rim: mat('#7e9a89'), dark: mat('#345f59'), cream: mat('#f3e9d4'), orange: mat('#d98e62'), glass: mat('#6eabb0', 0.2, 0.15), white: mat('#fff7e6') };
function mesh(geometry, material, x=0, y=0, z=0) { const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; return m; }
function cylinder(radiusTop, radiusBottom, height, material, x, y, z, segments=48) { return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, x,y,z); }
const ground = mesh(new THREE.PlaneGeometry(240,240), materials.grass); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
// The landing field is made of layered, slightly raised concrete discs.
scene.add(cylinder(7.1,7.4,.32,materials.rim,0,.16,0,64));
scene.add(cylinder(6.85,6.85,.12,materials.pad,0,.37,0,64));
const padRing = new THREE.Mesh(new THREE.RingGeometry(5.65,5.74,64), mat('#f4f1de')); padRing.rotation.x=-Math.PI/2; padRing.position.y=.44; scene.add(padRing);
const innerRing = new THREE.Mesh(new THREE.RingGeometry(3.05,3.12,64), mat('#f3ead7')); innerRing.rotation.x=-Math.PI/2; innerRing.position.y=.445; scene.add(innerRing);
for(let i=0;i<8;i++){ const a=i*Math.PI/4; const stripe=mesh(new THREE.BoxGeometry(.24,.025,.85),materials.white,Math.sin(a)*6.25,.45,Math.cos(a)*6.25); stripe.rotation.y=a; scene.add(stripe); }
const h1=mesh(new THREE.BoxGeometry(.35,.03,2.1),materials.white,-.55,.46,0); const h2=h1.clone();h2.position.x=.55;const h3=mesh(new THREE.BoxGeometry(1.45,.03,.3),materials.white,0,.46,0);scene.add(h1,h2,h3);
// A few low-poly hills and pines give the moving craft a stable horizon.
const hillColors=['#88b39a','#9ac0a2','#b0cbb1','#79a88e'];
for(let i=0;i<15;i++){const x=-65+i*9; const z=-37-(i%3)*8; const h=9+(i*7%9); const hill=mesh(new THREE.ConeGeometry(11+(i%3)*2,h,5),mat(hillColors[i%4]),x,h/2-1,z);hill.rotation.y=i*.8;scene.add(hill);}
function tree(x,z,s=1){const tree=new THREE.Group();const trunk=cylinder(.16,.2,1.5,mat('#977d5f'),0,.75,0,7);tree.add(trunk);for(let j=0;j<3;j++){const foliage=mesh(new THREE.ConeGeometry(1.05-j*.14,2.1,7),mat(['#598c74','#6d9f80','#7aab89'][j]),0,1.7+j*.7,0);tree.add(foliage);}tree.position.set(x,0,z);tree.scale.setScalar(s);scene.add(tree);}
[[10,-12,1.2],[13,-16,.9],[18,-12,1.3],[22,-20,1],[-12,-12,1.1],[-17,-14,1.4],[-22,-20,1.1],[-27,-12,.9],[11,11,.75],[17,15,1],[-13,13,1],[-20,8,.8],[27,2,1.2]].forEach(v=>tree(...v));
function cloud(x,y,z,s){const g=new THREE.Group();for(let i=0;i<4;i++){const puff=mesh(new THREE.SphereGeometry(1,12,8),mat('#f8f8e9'),(i-1.5)*1.15,Math.sin(i*2)*.2,0);puff.scale.set(1.15,.55,.55);g.add(puff);}g.position.set(x,y,z);g.scale.setScalar(s);scene.add(g);}
cloud(-24,18,-32,2);cloud(9,22,-45,2.7);cloud(31,15,-28,1.4);
// A rounded, friendly little survey craft, facing forward along local +Z.
const ship = new THREE.Group(); scene.add(ship);
const body=mesh(new THREE.SphereGeometry(1,32,20),materials.cream);body.scale.set(1.15,.52,2.05);ship.add(body);
const belly=mesh(new THREE.SphereGeometry(1,32,16),materials.orange,0,-.17,.03);belly.scale.set(1.11,.42,1.92);ship.add(belly);
const nose=mesh(new THREE.SphereGeometry(1,24,16),materials.cream,0,.03,1.5);nose.scale.set(.74,.4,.7);ship.add(nose);
const cockpit=mesh(new THREE.SphereGeometry(1,24,16),materials.glass,0,.46,.05);cockpit.scale.set(.66,.43,.88);ship.add(cockpit);
const cockpitShine=mesh(new THREE.SphereGeometry(1,16,12),materials.white,-.22,.73,.36);cockpitShine.scale.set(.12,.045,.26);ship.add(cockpitShine);
function wing(side){const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*2.05,-.85);shape.lineTo(side*1.9,-1.35);shape.lineTo(side*.45,-1.18);const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.08,bevelThickness:.05,bevelSegments:2});const w=mesh(geo,materials.cream);w.rotation.x=Math.PI/2;w.position.set(0,-.08,.25);ship.add(w);const tip=mesh(new THREE.SphereGeometry(.19,12,8),materials.orange,side*1.83,-.08,-.65);tip.scale.set(1,.5,1.5);ship.add(tip);}
wing(1);wing(-1);
for(const side of [-1,1]){const engine=cylinder(.32,.35,.55,materials.dark,side*.7,-.12,-1.65,20);engine.rotation.x=Math.PI/2;ship.add(engine);const glow=cylinder(.23,.23,.03,mat('#f1b16f'),side*.7,-.12,-1.94,20);glow.rotation.x=Math.PI/2;ship.add(glow);}
const fin=mesh(new THREE.ConeGeometry(.4,.9,4),materials.orange,0,.53,-1.25);fin.rotation.y=Math.PI/4;ship.add(fin);
ship.position.set(0,2.5,0);ship.rotation.y=-.45;
const launch=document.querySelector('#launch');const launchLabel=document.querySelector('#launch-label');const launchNote=document.querySelector('#launch-note');const status=document.querySelector('#status');
let flightStart=null;let phase='idle';let lastTarget=new THREE.Vector3();
launch.addEventListener('click',()=>{if(phase!=='idle')return;phase='lap';flightStart=performance.now();launch.disabled=true;launchLabel.textContent='Departure underway';launchNote.textContent='ENJOY THE JOURNEY';status.textContent='EXPLORER IN FLIGHT';});
function zoom(factor){const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor);offset.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();}
document.querySelector('#zoom-in').addEventListener('click',()=>zoom(.8));document.querySelector('#zoom-out').addEventListener('click',()=>zoom(1.25));
document.querySelector('#reset').addEventListener('click',()=>{const target=phase==='idle'?new THREE.Vector3(-2,2,0):ship.position.clone();controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(19,7,25));controls.update();});
function animate(now){requestAnimationFrame(animate);const t=now*.001;
 if(phase==='idle'){ship.position.y=2.5+Math.sin(t*1.4)*.12;ship.rotation.z=Math.sin(t*.9)*.025;}
 else {const elapsed=(now-flightStart)/1000;const lapDuration=18;let next;
  if(elapsed<lapDuration){const a=elapsed/lapDuration*Math.PI*2;next=new THREE.Vector3(7*Math.sin(a),2.5+1.1*Math.sin(a/2),7*(1-Math.cos(a)));ship.rotation.y=a+Math.PI/2;ship.rotation.z=-.12*Math.sin(a);}
  else {if(phase==='lap'){phase='depart';launchLabel.textContent='Off into the blue';launchNote.textContent='GODSPeed, LITTLE EXPLORER'.toUpperCase();status.textContent='EXPLORER DEPARTING';}const d=elapsed-lapDuration;next=new THREE.Vector3(d*1.2+d*d*.06,2.5+d*.55,-d*d*.12);ship.rotation.y=Math.atan2(1.2+d*.12,-d*.24);ship.rotation.z=.08;}
  ship.position.copy(next);const desired=next.clone();const delta=desired.clone().sub(lastTarget);camera.position.add(delta);controls.target.add(delta);lastTarget.copy(desired);
 }
 controls.update();renderer.render(scene,camera);
}
lastTarget.copy(ship.position);requestAnimationFrame(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
