import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c9e4e4');
scene.fog = new THREE.Fog('#c9e4e4', 40, 105);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 300);
camera.position.set(20, 14, 24);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .055;
controls.target.set(0, 1.6, 0); controls.minDistance = 8; controls.maxDistance = 52;
controls.maxPolarAngle = Math.PI / 2.05; controls.enablePan = false;
scene.add(new THREE.HemisphereLight('#efffff','#779e83',2.3));
const sun = new THREE.DirectionalLight('#fff7dd',3.1); sun.position.set(-12,25,12); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:80}); sun.shadow.bias=-.0003; scene.add(sun);
const mat=(color, extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});
const sand=mat('#d5d4ad'), grass=mat('#91b19a'), dark=mat('#385e57'), white=mat('#f4f1dc'), orange=mat('#e78b59'), metal=mat('#aec7bf',{metalness:.35,roughness:.45});
function mesh(geo, material, parent=scene, x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(r1,r2,h,material,parent,x,y,z,segments=48){return mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material,parent,x,y,z)}
// Broad, layered island and water establish a readable horizon.
cylinder(90,90,.3,mat('#a9cfcc'),scene,0,-1.4,0,96);
cylinder(29,31,1.3,sand,scene,0,-.9,0,96);
cylinder(23,25,.35,grass,scene,0,-.12,0,96);
// Landing platform.
cylinder(7.2,7.5,.7,dark,scene,0,.25,0,64);
cylinder(6.9,6.9,.17,mat('#d5ddd0'),scene,0,.68,0,64);
cylinder(6.15,6.15,.04,mat('#78978a'),scene,0,.79,0,64);
cylinder(5.8,5.8,.045,mat('#b6c9ba'),scene,0,.82,0,64);
const ring = mesh(new THREE.RingGeometry(4.65,4.72,64),white,scene,0,.85,0); ring.rotation.x=-Math.PI/2;
const ring2 = mesh(new THREE.RingGeometry(3.05,3.1,64),white,scene,0,.86,0); ring2.rotation.x=-Math.PI/2;
for(let i=0;i<12;i++){let a=i*Math.PI/6;const mark=mesh(new THREE.BoxGeometry(.15,.025,.65),white,scene,Math.sin(a)*5.35,.87,Math.cos(a)*5.35);mark.rotation.y=a;}
for(let i=0;i<8;i++){let a=i*Math.PI/4;cylinder(.13,.13,.12,orange,scene,Math.sin(a)*6.55,.82,Math.cos(a)*6.55,12)}
// Small stylized ship, built as a real three-dimensional object.
const ship = new THREE.Group(); scene.add(ship);
const hull = mesh(new THREE.SphereGeometry(1.7,48,24),white,ship,0,0,0); hull.scale.set(1,.35,.77);
const belly=mesh(new THREE.SphereGeometry(1.25,40,20),metal,ship,0,-.25,0);belly.scale.set(1,.25,.8);
const cabin=mesh(new THREE.SphereGeometry(.83,40,24),mat('#507f7b',{metalness:.25,roughness:.23}),ship,0,.32,0); cabin.scale.set(1,.62,.85);
const cabinTop=mesh(new THREE.SphereGeometry(.59,32,20),mat('#b5d9d0',{metalness:.2,roughness:.25}),ship,-.08,.48,.12);cabinTop.scale.set(1,.42,.8);
for(let i=0;i<8;i++){const a=i*Math.PI/4;const light=mesh(new THREE.SphereGeometry(.085,12,8),orange,ship,Math.sin(a)*1.48,-.05,Math.cos(a)*1.13);}
for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const leg=mesh(new THREE.CylinderGeometry(.055,.07,.65,10),metal,ship,Math.sin(a)*.85,-.52,Math.cos(a)*.65);leg.rotation.z=Math.sin(a)*-.3;leg.rotation.x=Math.cos(a)*.3;mesh(new THREE.SphereGeometry(.13,12,8),dark,ship,Math.sin(a)*1,-.84,Math.cos(a)*.78)}
const glow=mesh(new THREE.ConeGeometry(.62,2.3,32,1,true),new THREE.MeshBasicMaterial({color:'#b8f4e4',transparent:true,opacity:.23,side:THREE.DoubleSide,depthWrite:false}),ship,0,-1.5,0);glow.rotation.x=Math.PI;
// Low-poly landscape details.
function tree(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cylinder(.13,.2,1.5,mat('#927f62'),g,0,.75,0,8);for(let j=0;j<3;j++)cylinder(0,1.05-j*.17,1.65,mat(['#719d81','#80aa88','#91b792'][j]),g,0,1.35+j*.65,0,7)}
[[10,5,1.1],[12,9,.8],[15,5,1.25],[-11,7,1],[-14,4,1.2],[-12,-7,.9],[11,-10,1.1],[16,-6,.8],[-17,-8,1.1],[6,-16,1]].forEach(t=>tree(...t));
for(let i=0;i<26;i++){let a=i*2.4,r=11+(i%5)*2.4;let rock=mesh(new THREE.DodecahedronGeometry(.25+(i%3)*.13,0),mat(i%2?'#c8c9aa':'#a6b79e'),scene,Math.sin(a)*r,.1,Math.cos(a)*r);rock.scale.y=.55;}
// Distant soft mountains.
for(let i=0;i<10;i++){let a=i*Math.PI*2/10;let mountain=mesh(new THREE.ConeGeometry(6+i%3,5+i%4,5),mat(i%2?'#a8c7bc':'#b2cfc4'),scene,Math.sin(a)*38,1,Math.cos(a)*38);mountain.rotation.y=a;}
const launch=document.querySelector('#launch'), note=document.querySelector('#flight-note');
let phase='hover', started=0, last=performance.now();
launch.addEventListener('click',()=>{if(phase!=='hover')return;phase='lap';started=performance.now();launch.disabled=true;document.querySelector('#launch-text').textContent='Departure underway';note.textContent='FLIGHT PATH IN PROGRESS';});
const initialOffset=new THREE.Vector3(20,12.4,24); const followTarget=new THREE.Vector3();
document.querySelector('#reset').addEventListener('click',()=>{camera.position.copy(controls.target).add(initialOffset);controls.update()});
document.querySelector('#zoom-in').addEventListener('click',()=>{camera.position.lerp(controls.target,.2);controls.update()});
document.querySelector('#zoom-out').addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update()});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();controls.target.x=w<700?0:-2.8;}
window.addEventListener('resize',resize);resize();
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;const t=now/1000;
 if(phase==='hover'){ship.position.set(0,2.6+Math.sin(t*1.5)*.12,0);ship.rotation.y=Math.sin(t*.35)*.08;}
 if(phase==='lap'){const p=Math.min((now-started)/19000,1), a=p*Math.PI*2;ship.position.set(Math.sin(a)*6,2.7+Math.sin(p*Math.PI)*1.2+Math.sin(t*2)*.08,6*(1-Math.cos(a)));ship.rotation.y=-a; if(p>=1){phase='away';started=now;note.textContent='FOLLOWING THE SHIP';}}
 if(phase==='away'){const p=Math.min((now-started)/18000,1);ship.position.set(-p*28,2.7+p*17,-p*55);ship.rotation.y=-.45; if(p>=1){phase='gone';document.querySelector('#launch-text').textContent='Journey complete';note.textContent='UNTIL THE NEXT ADVENTURE';}}
 if(phase==='lap'||phase==='away'||phase==='gone'){followTarget.copy(ship.position);const delta=followTarget.clone().sub(controls.target).multiplyScalar(1-Math.exp(-dt*1.8));controls.target.add(delta);camera.position.add(delta);}
 glow.material.opacity=.16+Math.sin(t*5)*.04;controls.update();renderer.render(scene,camera);
}requestAnimationFrame(animate);
