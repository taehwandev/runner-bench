import * as T from './lib/three-0.160.0.module.min.js';
import {Batch,surface,seeded,atmosphere} from './geometry.js';
import {CARS,PITCH,LENGTH} from './route.js';
import {sign} from './world.js';
const wine=0x883d46, darkWine=0x582e39, enamel=0x263c48, steel=0x586b74;
const brass=0xd8aa6e, highlight=0xf6d397, black=0x263039, snow=0xc6d2d8;
const rng=seeded(761);
function shell(b,z0,z1,w,bottom,shoulder,top,color){
 const profile=z=>[[-w+.24,bottom,z],[w-.24,bottom,z],[w,bottom+.24,z],[w,shoulder,z],[w-.42,top,z],[-w+.42,top,z],[-w,shoulder,z],[-w,bottom+.24,z]];
 b.loft([profile(z0),profile(z1)],color);
}
function trucks(b,z,length,engine){
 b.box(0,.99,z,2.05,.82,length-.55,black);
 for(const a of [-1,1]){
   const center=z+a*(length*.31);
   b.box(0,.88,center,2.67,.48,2.34,enamel);
   for(const off of [-.73,.73]){
     const axle=center+off;
     b.cylinder([-1.37,.84,axle],[1.37,.84,axle],.45,black);
     for(const s of [-1,1]){
       b.cylinder([s*1.36,.84,axle],[s*1.43,.84,axle],.36,steel);
       b.cylinder([s*1.43,.84,axle],[s*1.47,.84,axle],.13,brass,8);
     }
   }
   for(const s of [-1,1])b.box(s*1.49,.97,center,.09,.17,2.1,engine?brass:steel);
 }
}
function lamp(b,x,y,z,r){
 b.cylinder([x,y,z-.16],[x,y,z],r*1.18,brass,24);
 b.cylinder([x,y,z],[x,y,z+.072],r,0x25363c,24);
 b.cylinder([x,y,z+.073],[x,y,z+.09],r*.82,0xffdfa0,24,3);
}
function noseDetails(b,group){
 // Cast brass wings follow the center plate, then wrap around the tapered sides.
 for(const s of [-1,1]){
   for(let i=0;i<3;i++){
     const y=2.49-i*.13, reach=1.02-i*.14;
     const q=[[s*.08,y-.09,-.115],[s*reach,y+.12,-.115],[s*reach,y+.20,-.115],[s*.08,y+.025,-.115]];
     b.face(s>0?q:q.reverse(),brass);
   }
   for(let i=0;i<5;i++)b.beam([s*(.21+i*.17),.72,.024],[s*(.30+i*.17),1.35,.024],.071,.065,steel);
   for(let j=0;j<3;j++) {
     const y=1.94+j*.19;
     b.beam([s*1.735,y,-2.22],[s*1.47,y+.24,-.64],.079,.09,brass);
     b.beam([s*1.47,y+.24,-.64],[s*1.035,y+.41,-.14],.079,.09,brass);
   }
   b.beam([s*1.73,2.34,-2.30],[s*1.73,3.71,-2.30],.052,.055,steel);
   b.box(s*1.75,2.69,-4.71,.055,.08,4.08,brass);
   for(const z of [-9.98,-7.67]){
     b.beam([s*1.72,1.44,z],[s*1.82,3.37,z],.055,.055,brass);
     for(let j=0;j<3;j++)b.box(s*1.86,1.38+j*.28,z,.23,.061,.46,steel);
   }
 }
 b.cylinder([0,2.34,-.10],[0,2.34,.014],.28,enamel,4);
 b.cylinder([0,2.34,.015],[0,2.34,.035],.226,brass,4);
 const id=sign(group,'07',0,1.83,-.112,.77,.31,0,'dark');
 id.rotation.y=0;
 b.box(0,1.01,.11,.48,.33,.30,black);
 b.box(0,1.12,.27,.53,.105,.09,steel);
}
function loco(b,group){
 trucks(b,-5.45,10.4,true);
 // A long, raked prow, with a heavy lower pilot and a rolled roof.
 const ring=(z,w,bottom,top)=>[[-w*.76,bottom,z],[w*.76,bottom,z],[w,bottom+.46,z],[w,top-.62,z],[w*.68,top-.13,z],[w*.33,top,z],[-w*.33,top,z],[-w*.68,top-.13,z],[-w,top-.62,z],[-w,bottom+.46,z]];
 b.loft([ring(-10.9,1.62,1.22,4.27),ring(-7.7,1.75,1.16,4.45),ring(-2.25,1.72,1.12,4.39),ring(-.66,1.46,1.17,4.07),ring(-.15,1.03,1.29,3.73)],wine);
 b.loft([ring(-2.3,1.72,.66,1.85),ring(-.78,1.67,.57,1.79),ring(0,1.12,.57,1.49)],enamel);
 for(const s of [-1,1]){
   for(let j=0;j<3;j++){
     const y=1.94+j*.19;
     b.box(s*1.754,y,-5.85,.086,.067,6.95,brass);
     b.beam([s*1.75,y,-2.37],[s*1.40,y+.34,-.54],.077,.077,brass);
     b.beam([s*1.40,y+.34,-.54],[s*.29,y+.6,-.125],.082,.08,brass);
   }
   // Side engine access plates, fasteners and louvres.
   for(let i=0;i<14;i++){
     const z=-2.75-i*.29;
     b.box(s*1.747,3.17,z,.075,.89,.13,enamel);
     b.box(s*1.797,3.16,z-.04,.028,.8,.038,steel);
   }
   for(let i=0;i<22;i++)b.box(s*1.76,1.52,-2.4-i*.36,.048,.081,.082,brass);
   b.box(s*1.74,3.58,-8.97,.11,1.02,2.18,brass);
   b.box(s*1.81,3.58,-8.97,.055,.84,2,0xdeb479,3);
   b.box(s*1.85,3.58,-8.9,.055,.91,.125,enamel);
   b.box(s*1.83,3.85,-8.97,.045,.09,2,steel);
   b.box(s*1.14,1.15,-.11,.46,.36,.28,black);
   lamp(b,s*.97,1.69,-.16,.115);
 }
 shell(b,-10.8,-7.35,1.65,4,4.43,4.74,enamel);
 shell(b,-10.72,-7.36,1.48,4.47,4.54,4.78,snow);
 for(const z of [-6.65,-5.55]){
   b.cylinder([0,4.21,z],[0,4.59,z],.40,enamel,16);
   b.cylinder([0,4.58,z],[0,4.74,z],.45,steel,16);b.cylinder([0,4.74,z],[0,4.76,z],.34,black,16);
 }
 for(let i=0;i<7;i++)b.box(0,4.43,-2.9-i*.27,1.24,.1,.11,steel);
 b.beam([0,4.41,-2.35],[0,4.086,-.65],.09,.065,brass);
 b.beam([0,4.086,-.65],[0,3.755,-.14],.09,.065,brass);
 b.cylinder([0,3.12,-.36],[0,3.12,-.075],.64,enamel,32);
 lamp(b,0,3.12,-.06,.47);
 for(let i=0;i<12;i++){
   let a=i*Math.PI/6; b.box(Math.cos(a)*.577,3.12+Math.sin(a)*.577,-.046,.047,.048,.032,brass);
 }
 for(const s of [-1,1]){
   for(let j=0;j<3;j++) b.beam([s*.32,2.89+j*.10,-.12],[s*(1.20-j*.13),3.03+j*.13,-.37],.078,.065,highlight);
   b.beam([s*1.46,.73,-.46],[s*.28,.76,.03],.12,.08,steel);
   sign(group,'N° 07',s*1.80,2.73,-8.93,1.63,.48,s,'wine');
 }
 noseDetails(b,group);
}
function carriage(b,z,i,group){
 const w=1.65;trucks(b,z,9.68,false);
 shell(b,z-4.78,z+4.78,w,1.25,3.95,4.35,i%3===0?darkWine:wine);
 shell(b,z-4.86,z+4.86,w+.025,3.91,4.01,4.44,enamel);
 shell(b,z-4.7,z+4.7,1.47,4.14,4.19,4.48,snow);
 b.box(0,4.47,z,1.17,.19,5.9,steel);b.box(0,4.59,z,1.22,.08,5.97,snow,2);
 b.box(0,2.35,z-4.98,2.42,2.06,.5,black);
 for(const s of [-1,1]){
   b.box(s*(w+.02),2.99,z,.055,1.35,9.5,enamel);
   for(const y of [2.26,2.37,3.71])b.box(s*(w+.06),y,z,.074,.055,9.6,brass);
   for(let j=0;j<7;j++){
     const wz=z-3.83+j*1.275;
     b.box(s*1.69,3.065,wz,.06,.96,.93,brass);
     b.box(s*1.73,3.065,wz,.046,.81,.80,rng()>.22?0xf6ca8c:0xe6aa71,4);
     b.box(s*1.76,3.28,wz,.035,.044,.80,steel);
     b.box(s*1.76,3.07,wz+.32,.04,.78,.13,0x986f53);
   }
   for(let j=0;j<11;j++)b.box(s*1.67,1.5,z-4.45+j*.86,.05,.12,.055,steel);
   if(i===0||i===3||i===7)sign(group,'M E R I D I A N',s*1.683,1.92,z,3.75,.47,s,'wine');
 }
}
function glowTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const gr=g.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,244,190,1)');gr.addColorStop(.08,'rgba(255,209,135,.85)');gr.addColorStop(.23,'rgba(255,171,92,.25)');gr.addColorStop(.55,'rgba(255,155,80,.075)');gr.addColorStop(1,'rgba(255,160,80,0)');
 g.fillStyle=gr;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}
export function buildTrain(scene){
 const group=new T.Group(),b=new Batch();loco(b,group);
 for(let i=0;i<CARS;i++)carriage(b,-16-i*PITCH,i,group);
 const finish=surface.clone();finish.uniforms={...atmosphere,rolling:{value:1}};
 b.box(0,2.6,-LENGTH,.88,.22,.04,0xee7056,3);b.finish(group,finish);
 const glow=glowTexture(), halo=new T.Sprite(new T.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
 halo.position.set(0,3.12,.15);halo.scale.set(3.7,3.7,1);group.add(halo);
 const pool=new T.Mesh(new T.PlaneGeometry(5.4,22),new T.MeshBasicMaterial({map:glow,transparent:true,opacity:.79,depthWrite:false,blending:T.AdditiveBlending}));
 pool.rotation.x=-Math.PI/2;pool.position.set(0,.445,8.8);group.add(pool);
 scene.add(group);return group;
}

