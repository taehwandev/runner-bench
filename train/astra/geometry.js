import * as T from './lib/three-0.160.0.module.min.js';
import {ENTRY,EXIT,LENGTH} from './route.js';

export const V=(x,y,z)=>new T.Vector3(x,y,z);
export function seeded(seed) {
  return () => { seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296; };
}
const colors=new Map();
function rgb(hex) {
  if(!colors.has(hex)) colors.set(hex,[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255]);
  return colors.get(hex);
}
// Flat faces retain crisp silhouettes. Each spatial batch is independently culled.
export class Batch {
  pos=[]; norm=[]; col=[]; kinds=[]; indices=[];
  face(points,color,kind=0) {
    const n=V(...points[1]).sub(V(...points[0])).cross(V(...points[2]).sub(V(...points[0]))).normalize();
    const start=this.kinds.length, c=rgb(color);
    for(const p of points) { this.pos.push(...p); this.norm.push(n.x,n.y,n.z); this.col.push(...c); this.kinds.push(kind); }
    for(let i=2;i<points.length;i++) this.indices.push(start,start+i-1,start+i);
  }
  // All profiles are counterclockwise when viewed from the front (+z).
  loft(sections,color,kind=0) {
    const end=sections.length-1;
    this.face([...sections[0]].reverse(),color,kind); this.face(sections[end],color,kind);
    for(let j=0;j<end;j++) for(let i=0;i<sections[j].length;i++) {
      const k=(i+1)%sections[j].length;
      this.face([sections[j][i],sections[j][k],sections[j+1][k],sections[j+1][i]],color,kind);
    }
  }
  box(x,y,z,w,h,d,c,k=0) {
    const section=a=>[[x-w/2,y-h/2,a],[x+w/2,y-h/2,a],[x+w/2,y+h/2,a],[x-w/2,y+h/2,a]];
    this.loft([section(z-d/2),section(z+d/2)],c,k);
  }
  beam(a,b,width,depth,c,k=0) {
    const start=V(...a),end=V(...b),dir=end.clone().sub(start).normalize();
    const side=dir.clone().cross(Math.abs(dir.y)>.95?V(1,0,0):V(0,1,0)).normalize().multiplyScalar(width/2);
    const up=dir.clone().cross(side).normalize().multiplyScalar(depth/2);
    const ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>p.clone().addScaledVector(side,i).addScaledVector(up,j).toArray());
    this.loft([ring(start),ring(end)],c,k);
  }
  cylinder(a,b,r,c,sides=12,kind=0,r2=r) {
    const start=V(...a),end=V(...b),dir=end.clone().sub(start).normalize();
    const side=dir.clone().cross(Math.abs(dir.y)>.9?V(1,0,0):V(0,1,0)).normalize(),up=dir.clone().cross(side);
    const ring=(p,radius)=>Array.from({length:sides},(_,i)=>p.clone().addScaledVector(side,radius*Math.cos(i*2*Math.PI/sides)).addScaledVector(up,radius*Math.sin(i*2*Math.PI/sides)).toArray());
    this.loft([ring(start,r),ring(end,r2)],c,kind);
  }
  finish(parent,mat) {
    if(!this.indices.length)return;
    const g=new T.BufferGeometry();
    for(const [name,data,size] of [['position',this.pos,3],['normal',this.norm,3],['color',this.col,3],['kind',this.kinds,1]]) g.setAttribute(name,new T.Float32BufferAttribute(data,size));
    g.setIndex(this.indices);g.computeBoundingSphere();
    const mesh=new T.Mesh(g,mat);parent.add(mesh);return mesh;
  }
}
export const atmosphere={night:{value:0},bore:{value:0},nose:{value:0},rolling:{value:0}};
export const noiseGLSL=`
float hash(vec2 p){return fract(sin(mod(dot(p,vec2(127.1,311.7)),628.32))*4375.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
`;
export const surface=new T.ShaderMaterial({uniforms:atmosphere,vertexShader:`
attribute vec3 color;attribute float kind;
varying vec3 col,p,n,local;varying float part,dist;
void main(){col=color;n=mat3(modelMatrix)*normal;local=position;p=(modelMatrix*vec4(position,1.)).xyz;part=kind;
vec4 mv=viewMatrix*vec4(p,1.);dist=-mv.z;gl_Position=projectionMatrix*mv;}`,
fragmentShader:`
precision highp float;
varying vec3 col,p,n,local;varying float part,dist;
uniform float night,bore,nose,rolling;
${noiseGLSL}
void main(){
 vec3 N=normalize(n);float side=abs(N.x)>.65?local.z:local.x;
 vec2 uv=vec2(side,local.y);
 vec3 mat=col; float emit=0.;
 if(part>.5 && part<1.5 && abs(N.y)<.1){
   vec2 grid=uv/vec2(2.55,3.35);vec2 f=fract(grid),id=floor(grid);
   float variant=hash(id+floor(p.xz*.004));
   float bay=step(.24,f.x)*step(f.x,.78)*step(.23,f.y)*step(f.y,.81);
   float lamp=smoothstep(.70,.75,variant)*bay;
   mat*=.74+.26*step(.12,f.x)+.13*step(.94,f.y);
   mat=mix(mat,vec3(.125,.225,.31)+.12*variant,bay*.83);
   mat=mix(mat,mix(vec3(.72,.45,.23),vec3(1.,.82,.53),variant),lamp*.92);emit=lamp*.7;
   mat*=1.-.28*bay*step(.70,f.y);
   mat*=1.-.30*bay*step(.47,f.x)*step(f.x,.51);
   mat+=vec3(.07,.08,.087)*step(.19,f.x)*step(f.x,.83)*step(.18,f.y)*step(f.y,.23);
 }
 float grain=noise(uv*vec2(2.1,.24))-.5;
 float top=max(N.y,0.),key=max(dot(N,normalize(vec3(-.55,.63,-.48))),0.);
 vec3 lighting=vec3(.55,.65,.79)+key*vec3(.55,.40,.30)+top*vec3(.07,.08,.10);
 float inside=step(${ENTRY}.0,p.z)*step(p.z,${EXIT}.0)*step(abs(p.x),10.)*step(p.y,11.);
 lighting=mix(lighting,vec3(.38,.47,.60)+vec3(.50,.27,.10)*pow(.5+.5*cos(p.z*.65),3.),inside*.95);
 lighting*=mix(vec3(1),vec3(.65,.73,.92),night);
 vec3 result=mat*mix(lighting,vec3(1.03),max(emit,step(2.5,part)));
 if(part>3.5){
   float car=floor((-local.z-11.)/10.);
   vec2 pane=vec2(fract((local.z+19.83+car*10.)/1.275+.5),clamp((local.y-2.66)/.81,0.,1.));
   float cell=floor((local.z+19.83+car*10.)/1.275+.5);
   float r=hash(vec2(cell,car));
   float blind=step(.85-.20*r,pane.y);
   result*=.90+.16*pane.y-.29*blind;
   vec2 head=(pane-vec2(.45+r*.16,.22+r*.055))*vec2(1.,.72);
   float person=(1.-smoothstep(.06,.076,length(head)))+.8*(1.-smoothstep(.06,.095,length((pane-vec2(.48+r*.16,.04))*vec2(.67,1.))));
   result=mix(result,vec3(.26,.21,.21),clamp(person,0.,1.)*step(.46,r)*.83);
   result+=vec3(.035,.065,.095)*smoothstep(.6,.82,fract(pane.x+pane.y*.29+r));
 }
 result+=grain*mix(.046,.009,step(2.5,part));
 if(rolling>.5 && part<2.5){
   float varnish=smoothstep(.10,.24,col.r-col.b);
   vec3 eye=normalize(cameraPosition-p);
   float grazing=pow(1.-abs(dot(eye,N)),3.);
   result+=varnish*(vec3(.054,.09,.12)*grazing+vec3(.11,.074,.06)*pow(max(0.,reflect(-eye,N).y),4.));
   float weather=noise(local.xz*vec2(2.9,1.3))*.48+noise(local.xz*9.2)*.16;
   float frost=smoothstep(.99,1.14,N.y*.72+weather);
   result=mix(result,vec3(.78,.79,.82)*lighting,frost*.84);
   if(varnish>.0 && abs(N.x)>.7){
     vec2 tile=fract(vec2(local.z/1.47,(local.y-.11)/1.13));
     float seam=(1.-smoothstep(.006,.02,min(tile.x,tile.y)))*.31;
     result*=1.-seam;
   }
 }else if(p.y<.55 && abs(p.x)<3.){
   float dz=p.z-nose;
   float shadow=smoothstep(-${LENGTH+2}.,-${LENGTH-1}.,dz)*(1.-smoothstep(-1.,.8,dz))*(1.-smoothstep(1.1,2.8,abs(p.x)));
   result*=1.-.54*shadow;
   float beam=smoothstep(.1,3.4,dz)*exp(-max(0.,dz-4.)*.135)*exp(-p.x*p.x/(.7+max(dz,0.)*.16));
   result=mix(result,vec3(1.,.80,.48),beam*(.45+.46*inside));
 }
 if(part>1.5 && part<2.5) result+=.032*noise(local.xz*1.9);
 float fog=1.-exp(-max(0.,dist-10.)*mix(.0064,.005,night));
 vec3 mist=mix(vec3(.665,.627,.681),vec3(.19,.265,.398),night);
 mist=mix(mist,vec3(.15,.20,.26),bore*.88);
 result=mix(result,mist,min(.968,fog));
 result+=(hash(gl_FragCoord.xy)-.5)*.014;
 gl_FragColor=vec4(result,1.);
}`});

