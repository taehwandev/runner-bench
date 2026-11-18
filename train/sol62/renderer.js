import { PORTAL, EXIT } from './timeline.js';

const TAU = Math.PI * 2;
const STRIDE = 20;
const mul = (v, k) => v.map(c => c*k);
const sub = (a, b) => a.map((v, i) => v-b[i]);
const dot = (a, b) => a.reduce((sum, x, i) => sum+x*b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => mul(v, 1/Math.hypot(...v));

export function rgb(hex) {
  const v = parseInt(hex,16);
  return [v>>16,v>>8&255,v&255].map(c => c/255);
}

export class Geometry {
  groups = { box: [], bevel: [], wheel: [] };

  instance(shape, center, axes, color, mode, seed) {
    this.groups[shape].push(...center,mode,...axes[0],seed,...axes[1],0,...axes[2],0,...color,0);
  }

  box(x,y,z,w,h,d,color,mode=0,seed=0,shape='box') {
    this.instance(shape,[x,y,z],[[w,0,0],[0,h,0],[0,0,d]],color,mode,seed);
  }

  beam(a,b,thick,wide,color,mode=0) {
    const along = sub(b,a);
    const side = unit(cross(along, Math.abs(along[0])+Math.abs(along[2]) > .001 ? [0,1,0] : [0,0,1]));
    const top = unit(cross(side,along));
    this.instance('box', a.map((n,i) => (n+b[i])/2), [along,mul(top,thick),mul(side,wide)],color,mode,0);
  }
}

function solid(shape) {
  const data = [];
  function face(vertices, outward) {
    let n = unit(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])));
    if (dot(n,outward)<0) { vertices.reverse(); n=mul(n,-1); }
    for (let i=1;i<vertices.length-1;i++) {
      for (const p of [vertices[0],vertices[i],vertices[i+1]]) data.push(...p,...n);
    }
  }
  const ring = z => Array.from({length:12},(_,i) => [.5*Math.cos(i*TAU/12),.5*Math.sin(i*TAU/12),z]);
  if (shape==='wheel') {
    const a=ring(.5), b=ring(-.5);
    face(a.slice(),[0,0,1]); face(b.slice(),[0,0,-1]);
    for (let i=0;i<12;i++) {
      const j=(i+1)%12;
      face([a[i],b[i],b[j],a[j]],[a[i][0],a[i][1],0]);
    }
    return data;
  }
  const perimeter = (edge,y,wx=1,wz=1) => {
    const o=.5-edge;
    return [[-.5,-o],[-o,-.5],[o,-.5],[.5,-o],[.5,o],[o,.5],[-o,.5],[-.5,o]].map(([x,z])=>[x*wx,y,z*wz]);
  };
  const layers = shape==='box'
    ? [-.5,.5].map(y=>[[-.5,y,-.5],[.5,y,-.5],[.5,y,.5],[-.5,y,.5]])
    : [perimeter(.14,-.5,.94,.94),perimeter(.10,-.30),perimeter(.10,.22),perimeter(.17,.5,.90,.80)];
  face(layers[0].slice(),[0,-1,0]); face(layers.at(-1).slice(),[0,1,0]);
  for (let l=1;l<layers.length;l++) {
    const a=layers[l-1], b=layers[l];
    for (let i=0;i<a.length;i++) {
      const j=(i+1)%a.length;
      face([a[i],a[j],b[j],b[i]],[a[i][0]+a[j][0],0,a[i][2]+a[j][2]]);
    }
  }
  return data;
}

function lens(eye,target,fov) {
  const forward=unit(sub(target,eye));
  const right=unit(cross(forward,[0,1,0]));
  const up=cross(right,forward);
  const tan=Math.tan(fov*Math.PI/360);
  const near=.16, far=2200;
  const rows=[mul(right,1/(tan*9/16)),mul(up,1/tan),mul(forward,(far+near)/(far-near)),forward];
  const vp=[];
  for (let i=0;i<3;i++) for (const row of rows) vp.push(row[i]);
  vp.push(-dot(rows[0],eye),-dot(rows[1],eye),-dot(rows[2],eye)-2*far*near/(far-near),-dot(rows[3],eye));
  return {eye,forward,right,up,tan,vp};
}

const fullVS = `#version 300 es
out vec2 screen;
void main(){
  screen=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;
  gl_Position=vec4(screen,.99999,1.);
}`;

const weather = `
float hash(vec2 p){
  p=fract(p*vec2(.1031,.11369));
  p+=dot(p,p.yx+19.19);
  return fract((p.x+p.y)*p.x);
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
const vec3 sun=vec3(-.734,.115,-.669);
` + 'const float portal=' + PORTAL.toFixed(1) + ', exitPortal=' + EXIT.toFixed(1) + ';' + `
vec3 horizon(vec3 d,float night){
  float warm=pow(max(0.,dot(d,sun)),5.);
  return mix(mix(vec3(.46,.56,.62),vec3(.81,.54,.41),warm),mix(vec3(.23,.33,.43),vec3(.49,.35,.36),warm),night);
}
vec3 aerial(vec3 d,float night){
  return horizon(d,night)*(1.-.24*smoothstep(.01,.48,d.y));
}
`;

const skyFS = `#version 300 es
precision highp float;
in vec2 screen;
uniform vec3 forward,right,up;
uniform float tanFov,night,time;
out vec4 pixel;
`+weather+`
void main(){
  vec3 d=normalize(forward+right*screen.x*tanFov*.5625+up*screen.y*tanFov);
  vec3 h=horizon(d,night);
  vec3 zenith=mix(vec3(.14,.28,.43),vec3(.042,.101,.187),night);
  vec3 col=mix(h,zenith,smoothstep(-.02,.55,d.y));
  col*=1.-.28*smoothstep(.05,.85,-d.y);
  float glow=max(0.,dot(d,sun));
  col+=vec3(1.,.37,.14)*(pow(glow,38.)*.27+smoothstep(.99987,.99995,glow)*.50)*(1.-night*.83);
  vec2 p=vec2(atan(d.x,-d.z)*3.5,d.y*12.)+vec2(time*.017,0);
  float cloud=smoothstep(.49,.75,noise(p)*.68+noise(p*2.55)*.25+noise(p*6.1)*.07);
  col=mix(col,col*vec3(.51,.66,.81),cloud*smoothstep(-.04,.14,d.y)*(1.-smoothstep(.50,.95,d.y))*.74);
  vec2 stars=d.xz*420./max(.2,d.y+.78);
  float star=step(.997,hash(floor(stars)))*(1.-smoothstep(.03,.25,length(fract(stars)-.5)));
  col+=star*smoothstep(.17,.65,d.y)*night*.6;
  pixel=vec4(col+(hash(gl_FragCoord.xy)-.5)*.01,1.);
}`;

const solidVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 vertex;
layout(location=1) in vec3 normal;
layout(location=2) in vec4 center;
layout(location=3) in vec4 axisX;
layout(location=4) in vec4 axisY;
layout(location=5) in vec4 axisZ;
layout(location=6) in vec4 color;
uniform mat4 vp;
uniform vec3 offset;
out vec3 world,local,norm;
flat out vec3 tint,size;
flat out float material,seed;
void main(){
  mat3 basis=mat3(axisX.xyz,axisY.xyz,axisZ.xyz);
  world=basis*vertex+center.xyz+offset;
  size=vec3(length(axisX.xyz),length(axisY.xyz),length(axisZ.xyz));
  local=vertex*size;
  norm=normalize(basis*(normal/size));
  tint=color.rgb; material=center.w; seed=axisX.w;
  gl_Position=vp*vec4(world,1.);
}`;

const solidFS = `#version 300 es
precision highp float;
in vec3 world,local,norm;
flat in vec3 tint,size;
flat in float material,seed;
uniform vec3 eye;
uniform float nose,night;
out vec4 pixel;
`+weather+`
vec3 facade(vec3 base,float dist){
  bool side=abs(norm.x)>.5;
  float span=side?local.z:local.x, across=side?size.z:size.x;
  vec2 grid=vec2((span+across*.5)/3.35,(local.y+size.y*.5)/3.85);
  vec2 fr=fract(grid);
  float floors=smoothstep(0.,.085,fr.y);
  float pilaster=smoothstep(.035,.13,fr.x)*(1.-smoothstep(.87,.97,fr.x));
  float tile=hash(floor(grid)+vec2(seed,seed*1.13));
  float panes=smoothstep(.19,.25,fr.x)*(1.-smoothstep(.74,.80,fr.x))*smoothstep(.22,.28,fr.y)*(1.-smoothstep(.74,.80,fr.y));
  float edge=smoothstep(.7,2.,across*.5-abs(span))*smoothstep(2.,6.,size.y*.5-abs(local.y));
  base*=(.82+tile*.19)*(.78+.22*floors)*(.70+.30*pilaster);
  vec3 lamp=mix(vec3(.29,.52,.63),vec3(1.,.66,.32),smoothstep(.85,.97,tile));
  float lit=step(.79-night*.12,tile)*(.46+night*.49);
  float mullion=1.-(1.-smoothstep(.015,.032,abs(fr.x-.49)))*.57;
  return mix(base,mix(base*.50,lamp,lit),panes*edge*mullion*(1.-smoothstep(360.,760.,dist)));
}
void main(){
  vec3 delta=world-eye;
  float dist=length(delta);
  vec3 view=delta/max(dist,.001);
  float top=max(0.,norm.y);
  float rim=max(0.,dot(norm,vec3(-.55,.47,-.69)));
  vec3 col=tint*(vec3(.60,.73,.91)+top*vec3(.31,.31,.27)+rim*vec3(.30,.20,.13))*(1.-night*.34);
  float grain=noise(world.xz*.38+world.y*.23);
  if(material==1.&&abs(norm.y)<.4){
    col=facade(col,dist);
  }else if(material==2.){
    col*=.77+.22*grain+.08*noise(world.xz*.048);
    col+=.038*smoothstep(.69,.82,noise(world.xz*.11));
  }else if(material==3.){
    col=tint*(.94+night*.20);
  }else if(material==4.){
    vec2 ice=vec2(world.x*.057+world.z*.023,world.z*.19);
    float cracks=1.-smoothstep(.004,.020,abs(noise(ice)*.78+noise(ice*2.3)*.22-.50));
    col*=.67+.45*grain;
    col+=cracks*vec3(.11,.19,.23);
    col=mix(col,aerial(reflect(view,norm),night),pow(1.-max(0.,dot(-view,norm)),3.)*.39);
  }else if(material==5.){
    col*=.73+grain*.31;
    col+=pow(max(0.,dot(reflect(-sun,norm),-view)),9.)*vec3(.19,.23,.26);
  }else if(material==6.){
    float e=abs(fract((world.x-portal)/12.)-.5);
    col=col*.48+vec3(.24,.37,.46)*exp(-7.*e)*(.23+.22*top);
  }else if(material==7.){
    col=vec3(1.,.87,.62);
  }else{
    col*=.90+grain*.17;
  }
  if(material!=3.&&material!=7.){
    float underTrain=step(nose-213.,world.x)*step(world.x,nose);
    float shade=(1.-smoothstep(1.1,3.6,abs(world.z)))*smoothstep(39.4,39.95,world.y)*(1.-smoothstep(40.32,41.48,world.y));
    col*=1.-underTrain*shade*.42;
    float underViaduct=(1.-smoothstep(3.,12.,abs(world.z+9.5)))*(1.-smoothstep(.15,14.,world.y));
    col*=1.-underViaduct*.21;
    float platform=step(466.,world.x)*step(world.x,642.)*smoothstep(3.9,6.8,world.z)*(1.-smoothstep(10.1,15.,world.z));
    float fixtures=.35+.65*pow(.5+.5*cos((world.x-470.)*.364),4.);
    col+=vec3(.22,.12,.046)*platform*fixtures*step(40.85,world.y)*step(world.y,47.7)*(.45+.55*top);
  }
  vec3 ray=world-vec3(nose-.19,44.1,0.);
  float cone=exp(-dot(ray.yz-vec2(-.098*ray.x,0.),ray.yz-vec2(-.098*ray.x,0.))/(1.6+.016*ray.x*ray.x));
  float lamp=step(0.,ray.x)*cone*exp(-max(0.,ray.x)*.023)*max(.17,dot(norm,vec3(-.83,.55,0.)));
  col+=vec3(1.,.65,.34)*lamp*.89;
  float bore=step(portal,world.x)*step(world.x,exitPortal)*step(abs(world.z),10.6)*step(39.,world.y)*step(world.y,54.);
  float fog=(1.-exp(-dist*(.00225+night*.00023)))*(1.-bore*.96);
  pixel=vec4(mix(col,aerial(view,night),fog)+(hash(gl_FragCoord.xy)-.5)*.006,1.);
}`;

const snowVS = `#version 300 es
precision highp float;
uniform mat4 vp;
uniform vec3 eye;
uniform float time,dpi;
out float opacity,slant;
`+weather+`
void main(){
  float id=float(gl_VertexID);
  float a=hash(vec2(id,11.)), b=hash(vec2(id,26.)), c=hash(vec2(id,59.)), d=hash(vec2(id,82.));
  float span=id<850.?42.:132.;
  vec3 p=vec3(a,b,c)*span;
  p+=vec3(time*(4.7+3.*d),-time*(3.6+4.7*c),time*(1.4+3.*a));
  p=eye+mod(p-eye+span*.5,span)-span*.5;
  p.x+=sin(time*1.6+a*25.)*.9;
  gl_Position=vp*vec4(p,1.);
  float dist=length(eye-p);
  gl_PointSize=clamp((18.+19.*b)/max(dist,1.),.9,6.)*dpi;
  float indoors=step(portal,p.x)*step(p.x,exitPortal)*step(abs(p.z),10.6)*step(39.,p.y)*step(p.y,54.);
  opacity=(.25+.57*d)*smoothstep(.65,3.8,dist)*(1.-smoothstep(span*.34,span*.49,dist))*(1.-indoors*.84);
  slant=d;
}`;
const snowFS = `#version 300 es
precision mediump float;
in float opacity,slant;
out vec4 pixel;
void main(){
  vec2 p=gl_PointCoord-.5;
  p.x=(p.x-p.y*(.4+slant*.36))*1.7;
  float a=1.-smoothstep(.09,.49,length(p));
  pixel=vec4(.88,.96,1.,a*opacity);
}`;

const puffVS = `#version 300 es
precision highp float;
layout(location=0) in vec4 position;
layout(location=1) in vec4 info;
uniform mat4 vp;
uniform vec3 right,up;
out vec2 uv;
flat out vec4 particle;
void main(){
  vec2 q=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1))*2.-1.;
  uv=q;
  particle=info;
  vec3 p=position.xyz+(right*q.x+up*q.y*info.w)*position.w;
  gl_Position=vp*vec4(p,1.);
}`;
const puffFS=`#version 300 es
precision highp float;
in vec2 uv;
flat in vec4 particle;
uniform float night;
out vec4 pixel;
`+weather+`
void main(){
  float r=length(uv);
  if(r>1.) discard;
  vec3 col;
  float a;
  if(particle.z<.5){
    vec2 q=uv*2.7+vec2(particle.y,particle.y*1.8);
    float n=noise(q)*.68+noise(q*2.5)*.32;
    a=(1.-smoothstep(.16,1.,r))*smoothstep(.21,.74,n)*particle.x;
    col=mix(vec3(.34,.42,.47),vec3(.84,.89,.89),smoothstep(-.8,.5,uv.y+n*.55));
    col*=1.-night*.27;
  }else{
    a=exp(-r*r*6.2)*(1.-smoothstep(.70,1.,r))*particle.x;
    col=particle.z<1.5?vec3(1.,.65,.27):vec3(1.,.18,.07);
  }
  pixel=vec4(col,a);
}`;

function program(gl,vertex,fragment,uniforms){
  const shaders=[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]].map(([type,source])=>{
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  });
  const handle=gl.createProgram();
  for(const shader of shaders) gl.attachShader(handle,shader);
  gl.linkProgram(handle);
  for(const shader of shaders) gl.deleteShader(shader);
  if(!gl.getProgramParameter(handle,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
  return {handle,u:Object.fromEntries(uniforms.split(' ').map(n=>[n,gl.getUniformLocation(handle,n)]))};
}

export class Renderer {
  constructor(canvas){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{alpha:false,depth:true,antialias:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL 2 unavailable');
    this.gl=gl;
    this.sky=program(gl,fullVS,skyFS,'forward right up tanFov night time');
    this.solids=program(gl,solidVS,solidFS,'vp offset eye nose night');
    this.puffs=program(gl,puffVS,puffFS,'vp right up night');
    this.snow=program(gl,snowVS,snowFS,'vp eye time dpi');
    this.meshes=Object.fromEntries(['box','bevel','wheel'].map(shape=>{
      const data=solid(shape), buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
      return [shape,{buffer,count:data.length/6}];
    }));
    this.puffBuffer=gl.createBuffer();
    this.puffArray=gl.createVertexArray();
    gl.bindVertexArray(this.puffArray);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.puffBuffer);
    for(let i=0;i<2;i++){
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,4,gl.FLOAT,false,32,i*16);
      gl.vertexAttribDivisor(i,1);
    }
    gl.bindVertexArray(null);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearDepth(1);
  }

  upload(geometry){
    const gl=this.gl;
    return Object.entries(geometry.groups).filter(([,data])=>data.length).map(([shape,data])=>{
      const mesh=this.meshes[shape], array=gl.createVertexArray(), buffer=gl.createBuffer();
      gl.bindVertexArray(array);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      for(let i=0;i<2;i++){
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
      for(let i=0;i<5;i++){
        gl.enableVertexAttribArray(i+2);
        gl.vertexAttribPointer(i+2,4,gl.FLOAT,false,STRIDE*4,i*16);
        gl.vertexAttribDivisor(i+2,1);
      }
      gl.bindVertexArray(null);
      return {array,verts:mesh.count,count:data.length/STRIDE};
    });
  }

  resize(){
    const canvas=this.canvas;
    const dpr=Math.min(1.65,window.devicePixelRatio||1);
    const pixelCap=window.matchMedia('(pointer: coarse)').matches?720:1080;
    const w=Math.min(pixelCap,Math.round(canvas.clientWidth*dpr));
    const h=Math.round(w*16/9);
    if(w && (canvas.width!==w||canvas.height!==h)){
      canvas.width=w; canvas.height=h;
      this.gl.viewport(0,0,w,h);
    }
  }

  render(t,night,nose,camera,world,train,particles){
    const gl=this.gl, l=lens(...camera);
    const vp=new Float32Array(l.vp);
    let u=this.sky.u;
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sky.handle);
    gl.uniform3fv(u.forward,l.forward); gl.uniform3fv(u.right,l.right); gl.uniform3fv(u.up,l.up);
    gl.uniform1f(u.tanFov,l.tan); gl.uniform1f(u.night,night); gl.uniform1f(u.time,t);
    gl.drawArrays(gl.TRIANGLES,0,3);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.solids.handle);
    u=this.solids.u;
    gl.uniformMatrix4fv(u.vp,false,vp); gl.uniform3fv(u.eye,l.eye);
    gl.uniform1f(u.nose,nose); gl.uniform1f(u.night,night);
    gl.uniform3f(u.offset,0,0,0);
    for(const sector of world){
      if(Math.abs(sector.x-l.eye[0])<sector.radius||sector.essential) this.drawSolids(sector.meshes);
    }
    gl.uniform3f(u.offset,nose,0,0);
    this.drawSolids(train);

    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.useProgram(this.puffs.handle);
    u=this.puffs.u;
    gl.uniformMatrix4fv(u.vp,false,vp); gl.uniform3fv(u.right,l.right);
    gl.uniform3fv(u.up,l.up); gl.uniform1f(u.night,night);
    gl.bindVertexArray(this.puffArray);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.puffBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,particles,gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,particles.length/8);

    gl.bindVertexArray(null);
    gl.useProgram(this.snow.handle);
    u=this.snow.u;
    gl.uniformMatrix4fv(u.vp,false,vp); gl.uniform3fv(u.eye,l.eye);
    gl.uniform1f(u.time,t); gl.uniform1f(u.dpi,this.canvas.height/780);
    gl.drawArrays(gl.POINTS,0,2380);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  drawSolids(meshes){
    const gl=this.gl;
    for(const mesh of meshes){
      gl.bindVertexArray(mesh.array);
      gl.drawArraysInstanced(gl.TRIANGLES,0,mesh.verts,mesh.count);
    }
  }
}

