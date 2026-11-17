import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const host = document.querySelector('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false }); } catch (error) { document.querySelector('#fallback').hidden = false; throw error; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b8dedc');
scene.fog = new THREE.Fog('#c5e3df', 65, 160);
const camera = new THREE.PerspectiveCamera(39, innerWidth/innerHeight, .1, 500);
const mobile = () => innerWidth < 700;
const initialOffset = () => mobile() ? new THREE.Vector3(18,11,25) : new THREE.Vector3(17,9,23);
camera.position.copy(initialOffset());
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,1.5,0); controls.enableDamping = true; controls.dampingFactor = .08;
controls.enablePan = false; controls.minDistance = 9; controls.maxDistance = 55; controls.maxPolarAngle = Math.PI*.49; controls.minPolarAngle = .25;
scene.add(new THREE.HemisphereLight(0xf1fff1,0x739989,2.25));
const sunlight = new THREE.DirectionalLight(0xfff8d7,2.5); sunlight.position.set(-20,35,15); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048,2048); Object.assign(sunlight.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:.1,far:100}); sunlight.shadow.bias=-.0003; scene.add(sunlight);
const mat = (color, extra={}) => new THREE.MeshStandardMaterial({color, roughness:.8, ...extra});
const grass=mat('#99b980'), darkGrass=mat('#729c71'), cream=mat('#f5f0d8'), orange=mat('#e99756'), charcoal=mat('#344d47'), white=mat('#e8eee2'), teal=mat('#769f91');
function mesh(geo, material, parent=scene, x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(rt,rb,h,material,parent,x,y,z,segments=48){return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material,parent,x,y,z);}
function box(w,h,d,material,parent,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);}
// A soft, layered landscape gives the flight a sense of place.
const ground=cylinder(75,78,2,grass,scene,0,-1.4,0,96); ground.receiveShadow=true;
for (let i=0;i<15;i++) { const a=i/15*Math.PI*2, r=47+(i%3)*8; const hill=mesh(new THREE.SphereGeometry(1,20,12),mat(i%2?'#a2c394':'#91b889'),scene,Math.cos(a)*r,-1,Math.sin(a)*r); hill.scale.set(14+(i%3)*4,5+(i%4),11+(i%2)*4); hill.castShadow=false; }
function tree(x,z,s=1){const t=new THREE.Group();t.position.set(x,0,z);t.scale.setScalar(s);scene.add(t);cylinder(.13,.2,2.1,mat('#8d8062'),t,0,.8,0,8); for(let j=0;j<3;j++){const crown=mesh(new THREE.ConeGeometry(1.25-j*.18,2.1,7),mat(j===1?'#6d9b76':'#7da982'),t,0,1.7+j*.85,0);crown.rotation.y=.2*j;} }
[[ -13,-9,1.2],[-16,-5,.9],[-18,-14,1.3],[-11,-17,.8],[13,-13,1.1],[18,-10,1.3],[22,-15,.9],[20,3,1.15],[-19,9,1.2],[-15,16,.9],[14,17,.8],[24,12,1.1],[-27,-2,1.3],[29,-3,1.2],[-25,20,1]].forEach(v=>tree(...v));
for(let i=0;i<45;i++){const a=i*2.4,r=10+(i*7%34);if(Math.abs(Math.cos(a)*r)<7&&Math.abs(Math.sin(a)*r)<7)continue;const stone=mesh(new THREE.DodecahedronGeometry(.25+(i%3)*.12,0),mat(i%2?'#b5c9a4':'#d3d8bd'),scene,Math.cos(a)*r,.12,Math.sin(a)*r);stone.scale.y=.55;}
// Landing pad, concentric markings, and small perimeter lights.
cylinder(6.1,6.4,.55,mat('#748d7a'),scene,0,.12,0,64);
cylinder(5.75,5.75,.15,mat('#d2d5bf'),scene,0,.47,0,64);
cylinder(5.15,5.15,.04,mat('#879b88'),scene,0,.57,0,64);
const ring=mesh(new THREE.RingGeometry(4.52,4.62,64),cream,scene,0,.6,0);ring.rotation.x=-Math.PI/2;
const ring2=mesh(new THREE.RingGeometry(3.15,3.19,64),mat('#becbb5'),scene,0,.61,0);ring2.rotation.x=-Math.PI/2;
for(let i=0;i<8;i++){let a=i*Math.PI/4; const bar=box(.17,.025,.65,cream,scene,Math.sin(a)*4.02,.62,Math.cos(a)*4.02);bar.rotation.y=a;const light=cylinder(.16,.2,.12,mat('#e9ba69',{emissive:'#b87932',emissiveIntensity:.3}),scene,Math.sin(a)*5.5,.66,Math.cos(a)*5.5,12);}
box(.35,.03,2.3,cream,scene,-.62,.63,0);box(.35,.03,2.3,cream,scene,.62,.63,0);box(1.25,.03,.32,cream,scene,0,.64,0);
// Low-poly explorer, with a warm hull, cockpit, wings, and twin thrusters.
const ship=new THREE.Group();scene.add(ship);ship.position.y=3.1;
const hull=mesh(new THREE.SphereGeometry(1,32,20),cream,ship,0,0,0);hull.scale.set(1.18,.63,2.2);
const belly=mesh(new THREE.SphereGeometry(1,24,16),orange,ship,0,-.18,.16);belly.scale.set(1.12,.48,1.98);
const nose=mesh(new THREE.SphereGeometry(1,24,16),white,ship,0,.04,-1.37);nose.scale.set(.91,.48,.9);
const cockpit=mesh(new THREE.SphereGeometry(1,24,16),mat('#315f60',{metalness:.2,roughness:.25}),ship,0,.48,-.45);cockpit.scale.set(.72,.38,1.02);
const glint=mesh(new THREE.SphereGeometry(1,16,10),mat('#a7d6cb',{emissive:'#598f87',emissiveIntensity:.2}),ship,-.25,.78,-.72);glint.scale.set(.18,.045,.42);glint.rotation.z=-.2;
for(const side of [-1,1]){
 const wing=box(1.75,.16,1.15,cream,ship,side*1.4,-.1,.38);wing.rotation.y=side*-.18;wing.rotation.z=side*.08;
 const tip=box(.28,.2,.95,orange,ship,side*2.18,-.02,.35);tip.rotation.y=side*-.18;
 const engine=cylinder(.35,.42,1.3,charcoal,ship,side*.76,-.16,1.52,20);engine.rotation.x=Math.PI/2;
 const rim=cylinder(.32,.32,.08,orange,ship,side*.76,-.16,2.19,20);rim.rotation.x=Math.PI/2;
 const glow=cylinder(.24,.24,.09,mat('#aeead6',{emissive:'#67e0bd',emissiveIntensity:1.6}),ship,side*.76,-.16,2.25,20);glow.rotation.x=Math.PI/2;
 const fin=box(.12,.65,.7,orange,ship,side*.9,.38,1.15);fin.rotation.z=-side*.22;
}
const shipShadow=mesh(new THREE.CircleGeometry(1.8,32),new THREE.MeshBasicMaterial({color:'#3a5e4d',transparent:true,opacity:.17,depthWrite:false}),scene,0,.67,0);shipShadow.rotation.x=-Math.PI/2;
// Clouds are deliberately sparse and above the flight path.
function cloud(x,y,z,s){const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(s);scene.add(group);for(const [cx,cy,cz,r] of [[0,0,0,1],[1.1,.1,0,.8],[-1,.05,0,.7],[.25,.45,0,.75]]){let c=mesh(new THREE.SphereGeometry(r,16,10),mat('#edf5e9'),group,cx,cy,cz);c.scale.y=.55;c.castShadow=false;}}
cloud(-24,22,-35,3.1);cloud(23,25,-43,3.8);cloud(40,19,5,2.4);cloud(-40,19,10,2.4);
const launch=document.querySelector('#launch'), status=document.querySelector('#flight-status'), copy=document.querySelector('#flight-copy');
let phase='ready', started=0, last=performance.now(), previousTarget=new THREE.Vector3(0,1.5,0), lastYaw=0;
launch.addEventListener('click',()=>{if(phase!=='ready')return; phase='flight';started=performance.now();launch.disabled=true;launch.innerHTML='<span>Departure underway</span><span class="arrow">↗</span>';status.textContent='SCENIC LAP IN PROGRESS';copy.textContent='One slow lap, then onward into the blue.';document.querySelector('.scene-label small').textContent='DEPARTURE UNDERWAY';});
document.querySelector('#zoom-in').addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);controls.update();});
document.querySelector('#zoom-out').addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();});
document.querySelector('#reset').addEventListener('click',()=>{camera.position.copy(controls.target).add(initialOffset());controls.update();});
function smooth(t){return t*t*(3-2*t)}
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
 if(phase==='ready'){ship.position.y=3.1+Math.sin(now*.0015)*.12;ship.rotation.z=Math.sin(now*.001)*.025;}
 else {
  const t=(now-started)/1000;
  // Ease out from the pad, fly exactly one circuit, then head away indefinitely.
  if(t<4){const k=smooth(t/4);ship.position.set(6*k,3.1+1.1*k,0);ship.rotation.y=-Math.PI/2*k-Math.PI/2*smooth(Math.max(0,(t-3)));}
  else if(t<28){const a=(t-4)/24*Math.PI*2;ship.position.set(6*Math.cos(a),4.2+Math.sin(a)*.5,6*Math.sin(a));ship.rotation.y=-Math.PI-a;ship.rotation.z=-.1;}
  else {const d=t-28;ship.position.set(6,4.2+Math.min(d*.28,10),-d*3.2);ship.rotation.y=THREE.MathUtils.lerp(ship.rotation.y,-Math.PI*2,Math.min(1,dt*1.8));ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,0,Math.min(1,dt*2));if(d>3&&status.textContent!=='ONWARD INTO THE BLUE'){status.textContent='ONWARD INTO THE BLUE';copy.textContent='The Explorer is on its way. Thanks for seeing it off.';launch.innerHTML='<span>Journey in progress</span><span class="arrow">✦</span>';document.querySelector('.scene-label small').textContent='ONWARD INTO THE BLUE';}}
  const desired=new THREE.Vector3(ship.position.x,ship.position.y-.8,ship.position.z);const delta=desired.clone().sub(previousTarget);camera.position.add(delta);controls.target.add(delta);previousTarget.copy(desired);
 }
 shipShadow.position.x=ship.position.x;shipShadow.position.z=ship.position.z;shipShadow.material.opacity=phase==='ready'?.17:Math.max(0,.13-(ship.position.y-4)*.025);
 controls.update();renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));});
requestAnimationFrame(animate);
