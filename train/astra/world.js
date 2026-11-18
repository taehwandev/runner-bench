import * as T from './lib/three-0.160.0.module.min.js';
import {Batch,seeded,surface} from './geometry.js';
import {ENTRY,EXIT} from './route.js';
const ice=0xc9d5de, granite=0x586978, iron=0x384d5b, gold=0xecab60, lamp=0xffdc9e;
const random=seeded(879137);
function cap(b,x,y,z,w,d,thick=.29){
 b.box(x,y,z,w,thick,d,ice,2);
}
function tower(b,x,base,z,w,d,h){
 const palette=[0x65788c,0x798796,0x4e6575,0x526c7d,0x7c8293,0x827e8b,0x697485];
 const wall=palette[Math.floor(random()*palette.length)], tiers=2+Math.floor(random()*3),sp= random();
 let y=base;
 for(let i=0;i<tiers;i++){
   const height=h*(i===0?.62:.38/(tiers-1));
   b.box(x,y+height/2,z,w,height,d,wall,1);
   for(let floor=9;floor<height-2;floor+=12){
     b.box(x,y+floor,z,w+.5,.38,d+.5,granite);
     cap(b,x,y+floor+.24,z,w+.62,d+.62,.13);
   }
   for(let j=-1;j<=1;j+=2){
     b.box(x+j*(w/2-.65),y+height/2,z,.72,height+.5,d+.7,wall);
     b.box(x,y+height/2,z+j*(d/2-.55),w+.55,height,.6,wall);
   }
   if(i===0 && w>15){
     for(let j=-1;j<=1;j+=2) b.box(x+j*w*.27,y+height/2,z,.55,height,d+.42,wall);
   }
   y+=height;b.box(x,y-.44,z,w+.7,.68,d+.7,granite);cap(b,x,y,z,w+1,d+1);
   w*=.71;d*=.74;
 }
 if(sp>.35) {
   b.box(x,y+1.3,z,w*.72,2.6,d*.7,granite);
   b.cylinder([x,y+2.6,z],[x,y+5.4+w*.4,z],w*.37,0x6b7987,6,0,.22);
   const top=y+6+w*.4;b.box(x,top+2.6,z,.19,6,.19,iron);b.box(x,top+5.8,z,.26,.32,.26,0xfe907d,3);
 }else{
   b.box(x,y+1,z,w*.8,1.7,d*.5,granite);cap(b,x,y+1.9,z,w*.9,d*.6);
 }
}
function city(parent){
 for(let block=-5;block<17;block++){
   let b=new Batch(),origin=block*104;
   for(const side of [-1,1]){
     for(let layer=0;layer<3;layer++){
       for(let j=0;j<(layer===0?3:4);j++){
         const z=origin+(j+random()*.65)*104/(layer===0?3:4);
         const open=z>EXIT&&z<1590;
         const x=side*((open?106:28)+layer*57+random()*26);
         let h=(layer===0?36:67)+random()*(layer===0?56:95);
         if(layer===0 && z<150 && z>-200)h*=.79;
         tower(b,x,-42,z,9+random()*15,11+random()*16,h);
       }
     }
   }b.finish(parent,surface);
 }
}
function arch(b,z){
 // An open masonry arch, built as voussoirs with individual keystones.
 const span=22, r=8.75, center=z+11, spring=-13;
 for(const side of [-1,1]){
   const x=side*2.65;
   for(let i=0;i<14;i++){
     const angle=j=>j*Math.PI/14;
     const point=(j,rad,dx)=>[x+dx,spring+Math.sin(angle(j))*rad,center+Math.cos(angle(j))*rad];
     const q=[point(i,r,-.45),point(i+1,r,-.45),point(i+1,r+1.05,-.45),point(i,r+1.05,-.45)];
     b.face(side<0?q:[...q].reverse(),0x8594a2);
     const zi=center+r*Math.cos(angle(i)),zj=center+r*Math.cos(angle(i+1));
     const yi=spring+r*Math.sin(angle(i)),yj=spring+r*Math.sin(angle(i+1));
     const face=[[x,yi,zi],[x,yj,zj],[x,-1.3,zj],[x,-1.3,zi]];
     b.face(side<0?face:[...face].reverse(),granite);
   }
 }
 b.box(0,-18,z,5.8,34,span-2*r,granite);b.box(0,-11.7,z,6.35,.7,5.35,0x798998);
}
function rails(parent){
 for(let z0=-352;z0<1570;z0+=88){
   const b=new Batch();b.box(0,-.65,z0+44,5.75,1.3,88,0x404e5d);
   cap(b,0,.025,z0+44,5.88,88,.22);
   for(const x of [-1,1]) {
     b.box(x,.22,z0+44,.16,.28,88,0x516473);
     b.box(x,.39,z0+44,.2,.08,88,0xbac4c6);
     b.box(x*2.87,-.84,z0+44,.21,.22,88,0x8b9ba9);
   }
   for(let z=z0;z<z0+88;z+=1.6)b.box(0,.16,z,2.9,.18,.36,0x727d88);
   for(let z=z0;z<z0+88;z+=22){
     if(z<EXIT-12)arch(b,z);
     else{
       b.box(0,-20,z,3.8,38,3.8,granite);
       for(const s of [-1,1]){
         const x=s*2.75;b.box(x,-5.3,z+11,.49,.64,22,iron);
         for(let j=0;j<4;j++){
           const a=z+j*5.5;
           b.beam([x,-1.18,a],[x,-5.25,a+2.75],.28,.36,iron);
           b.beam([x,-5.25,a+2.75],[x,-1.18,a+5.5],.28,.36,iron);
         }
       }
     }
   }
   b.finish(parent,surface);
 }
}
export function sign(parent,text,x,y,z,width,height,side=-1,style='dark'){
 const cv=document.createElement('canvas');cv.width=1024;cv.height=192;
 const g=cv.getContext('2d');g.fillStyle=style==='dark'?'#21343c':'#632e32';g.fillRect(0,0,1024,192);
 g.strokeStyle='#c2a06d';g.lineWidth=6;g.strokeRect(11,11,1002,170);
 g.fillStyle='#fce2b2';g.font='bold 101px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillText(text,512,101,955);
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
 const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:false,fog:false}));
 m.rotation.y=side*Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;
}
function station(parent){
 const b=new Batch(),start=541,end=666,mid=(start+end)/2;
 b.box(7,.3,mid,9,2,end-start,granite);cap(b,7,1.4,mid,9.3,end-start,.24);
 b.box(2.42,1.55,mid,.15,.085,end-start,0xf1c080);
 for(let z=start+3;z<end;z+=9){
   b.box(6,4.2,z,.25,5.6,.3,iron);
   b.beam([6,5.2,z],[2.8,7.3,z],.16,.17,iron);
   b.beam([6,5.2,z],[9.7,7.4,z],.16,.17,iron);
   b.box(5.3,6.76,z,1.6,.16,.53,lamp,3);
   b.box(8.5,2.14,z,1,.22,3.4,0x735149);
   b.box(9.5,3.3,z,.18,3.6,8.4,0x8296a4);
 }
 b.box(6.6,7.48,mid,8,.4,end-start-2,iron);
 cap(b,6.6,7.77,mid,8.35,end-start-1,.32);
 b.box(2.61,7.37,mid,.16,.35,end-start-2,0xc59b69);
 for(const z of [568,604,638,656]){b.box(3.5,5.45,z,.12,1.2,6,iron);sign(parent,'VESPER',3.423,5.47,z,5.85,1.09);}
 for(const z of [579,645]){
   b.box(3.4,6.76,z,.085,.97,.10,iron);
   b.cylinder([3.48,6.06,z],[3.23,6.06,z],.58,gold,32);
   b.cylinder([3.23,6.06,z],[3.19,6.06,z],.49,0xf3dba8,32,3);
   for(let j=0;j<12;j++){
     const a=j*Math.PI/6;b.box(3.18,6.06+.405*Math.cos(a),z+.405*Math.sin(a),.028,.049,.044,iron);
   }
   b.beam([3.16,6.06,z],[3.16,6.33,z+.17],.05,.034,iron);
   b.beam([3.16,6.06,z],[3.16,5.92,z-.16],.061,.04,iron);
 }
 b.finish(parent,surface);
}
function bore(parent){
 const b=new Batch(),len=EXIT-ENTRY,mid=(ENTRY+EXIT)/2;
 for(const s of [-1,1]){
   b.box(s*18.4,19,mid,18,90,len,0x606e80,1);
   b.box(s*9.22,3.2,mid,.38,13.8,len,0x394956);
   for(const y of [1.8,2.02,2.25,6.4])b.box(s*8.92,y,mid,.13,.12,len,0x74818a);
   cap(b,s*18.4,64.2,mid,18.7,len+.7);
   b.box(s*4.8,54,mid,9.6,85,len,0x677686,1);
 }
 b.box(0,10.6,mid,19,2,len,iron);
 b.box(0,-1.94,mid,18.7,.5,len,0x3d4551);
 for(let z=ENTRY;z<=EXIT;z+=4.8){
   for(const s of [-1,1]){
     b.box(s*8.7,4.1,z,.53,10,.58,iron);
     b.beam([s*8.7,7,z],[s*5.8,9.6,z],.55,.42,0x485b65);
     b.box(s*8.37,4.8,z,.19,.44,1.36,lamp,3);
     b.box(s*8.65,1.4,z,.24,.18,4.8,0xb18a68);
   }b.box(0,9.68,z,17.6,.54,.68,0x404e5b);
 }
 for(const z of [ENTRY,EXIT]) {
   for(const s of [-1,1]){ b.box(s*10.25,6.9,z,2.6,16,2.4,granite);cap(b,s*10.25,15,z,2.9,2.8); }
   b.box(0,11.1,z,21,2.1,2.3,granite);cap(b,0,12.3,z,21.55,2.7);
 }
 b.finish(parent,surface);
}
function bridge(parent){
 const b=new Batch();
 for(let z=EXIT+25;z<1540;z+=94){
   for(const s of [-1,1]){
     const x=s*4.4;
     b.box(x,-10.6,z,1.33,49,1.68,iron);
     b.box(x,13.45,z,1.69,.48,2,ice,2);
     for(let j=0;j<4;j++){
       const a=z+j*23.5, y=v=>13.5-10.2*Math.sin(Math.PI*v/4);
       b.beam([x,y(j),a],[x,y(j+1),a+23.5],.24,.26,0x63717f);
       for(let i=0;i<4;i++){
         const u=i/4, yy=y(j)*(1-u)+y(j+1)*u;
         b.box(x,(yy-.7)/2,a+23.5*u,.105,yy+.7,.105,iron);
       }
     }
     b.box(x,13.9,z,.38,.44,.38,0xff9a78,3);
   }
   b.box(0,11.5,z,9.4,.82,.82,iron);
   b.beam([-4.4,8.5,z],[-1.3,11.5,z],.29,.36,iron);
   b.beam([4.4,8.5,z],[1.3,11.5,z],.29,.36,iron);
 }
 b.finish(parent,surface);
}
export function buildWorld(scene){
 city(scene);rails(scene);station(scene);bore(scene);bridge(scene);
 const b=new Batch();b.box(0,-43.6,620,1400,2,2700,0x9aaebc,2);b.finish(scene,surface);
}

