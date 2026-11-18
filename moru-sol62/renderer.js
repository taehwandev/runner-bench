const vertex = `#version 300 es
layout(location=0) in vec3 p;
layout(location=1) in vec3 n;
layout(location=2) in vec3 c;
layout(location=3) in vec3 material;
uniform vec3 eye;
uniform float offsetZ;
uniform vec2 lens;
uniform vec2 tilt;
uniform float roll;
out vec3 world;
out vec3 normal;
out vec3 ink;
out vec2 uv;
flat out int kind;
out float depth;
void main(){
  world=p+vec3(0,0,offsetZ);
  vec3 d=world-eye;
  float y=d.y*tilt.x-d.z*tilt.y;
  depth=-d.z*tilt.x-d.y*tilt.y;
  vec2 r=mat2(cos(roll),sin(roll),-sin(roll),cos(roll))*vec2(d.x,y);
  gl_Position=vec4(r*lens,depth*1.00073-.202,depth);
  normal=n; ink=c; uv=material.xy; kind=int(material.z);
}`;
const fragment = `#version 300 es
precision highp float;
in vec3 world;
in vec3 normal;
in vec3 ink;
in vec2 uv;
flat in int kind;
in float depth;
uniform vec3 fog;
uniform vec3 accent;
uniform float travel;
out vec4 frag;
float rand(vec2 p){
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float pool(float v,float w){return exp(-abs(v)*w);}
void main(){
  float haze=1.0-exp(-max(0.0,depth-7.0)*.0115);
  if(kind==4 || kind==5){
    vec2 p=uv*2.0-1.0;
    float a=max(0.0,1.0-dot(p,p));
    frag=vec4(ink,a*a*(kind==4 ? .42 : .23)*(1.0-haze));return;
  }
  vec3 c=ink*(.52+.53*max(0.0,dot(normal,vec3(-.38,.82,.42))))+ink*accent*.22;
  if(kind==1){
    vec2 p=vec2(world.x,world.z-travel);
    float d=abs(fract(p.y/22.0+.5)-.5)*22.0;
    float e=abs(fract((p.y+11.0)/22.0+.5)-.5)*22.0;
    float ripple=sin(p.y*8.0+p.x*22.0)*.14+sin(p.y*4.0+p.x*4.0)*.11;
    float glint=.55+.24*sin(p.y*6.0+p.x*4.0)+.25*rand(floor(p*42.0));
    c*=.72+rand(floor(p*52.0))*.4;
    c+=(accent*pool(p.x+3.6+ripple,1.7)*pool(d,.14)
      +vec3(1.0,.32,.095)*pool(p.x-3.3-ripple,1.55)*pool(e,.13))*.33*glint;
    c+=vec3(.028,.019,.039)*pool(p.x,.27);
  }
  if(kind==2 && normal.y<.6){
    vec2 id=floor(uv)+floor(ink.rg*809.0);
    vec2 f=fract(uv);
    float on=rand(id);
    float windowMask=step(.17,f.x)*step(f.x,.81)*step(.22,f.y)*step(f.y,.74);
    vec3 lamp=mix(vec3(.16,.42,.62),vec3(.91,.46,.18),step(.53,rand(id+11.0)));
    lamp=mix(lamp,accent,.25);
    c*=.73+.26*step(.11,f.y)+.19*step(.88,f.x);
    c+=windowMask*mix(vec3(.008,.012,.026),lamp*(.19+on*.61)*(.76+.24*step(.24,fract(f.y*9.0))),step(.55,on));
  }
  if(kind==3) c=ink*1.65;
  frag=vec4(mix(c,fog,haze*(.73+.22*haze)),1.0);
}`;

const screen = `#version 300 es
out vec2 uv;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); uv=p;
  gl_Position=vec4(p*2.0-1.0,0,1);
}`;
const sky = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 frag;
uniform vec3 fog;
uniform float aspect;
void main(){
  vec2 p=vec2((uv.x-.50)*aspect,uv.y-.61);
  vec3 c=mix(vec3(.012,.012,.034),fog,clamp(exp(-length(p*vec2(1.55,2.6))*3.2)*1.65,0.0,1.0));
  float m=length(vec2((uv.x-.67)*aspect,uv.y-.81));
  c+=vec3(.70,.37,.31)*(1.0-smoothstep(.027,.029,m));
  c+=vec3(.18,.054,.061)*exp(-m*17.0);
  float cloud=sin(uv.x*29.0+sin(uv.y*83.0)*.8)+sin(uv.x*16.0-uv.y*25.0);
  c*=.91+.12*smoothstep(-1.0,1.0,cloud+sin(uv.y*97.0));
  frag=vec4(c,1);
}`;
const finish = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 frag;
uniform sampler2D frame;
uniform vec2 texel;
uniform float impact;
uniform float velocity;
uniform float time;
vec3 bright(vec2 d){return max(texture(frame,uv+d*texel).rgb-.46,0.0);}
void main(){
  vec3 c=texture(frame,uv).rgb;
  c+=(bright(vec2(-4,1))+bright(vec2(4,-1))+bright(vec2(1,4))+bright(vec2(-1,-4)))*.16;
  c+=(bright(vec2(-9,5))+bright(vec2(9,-5))+bright(vec2(5,9))+bright(vec2(-5,-9)))*.085;
  vec2 p=uv-vec2(.5,.57);
  float r=length(p);
  float a=atan(p.y,p.x);
  float rays=pow(max(0.0,sin(floor(a*55.0)*57.1+floor(time*14.0)*17.2)),24.0);
  c+=vec3(.27,.55,.66)*rays*pow(max(0.0,sin(r*66.0-time*36.0+a*14.0)),7.0)*smoothstep(.24,.65,r)*velocity;
  c+=vec3(.76,.10,.041)*impact*smoothstep(.12,.62,r);
  c=pow(max(c/(c+vec3(.73)),0.0),vec3(.65));
  frag=vec4(c*(1.0-.39*dot(p,p)),1);
}`;

function program(gl, vs, fs) {
  const id=gl.createProgram();
  for (const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(id,shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(id);
  if (!gl.getProgramParameter(id,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(id));
  const u={};
  for (let i=0;i<gl.getProgramParameter(id,gl.ACTIVE_UNIFORMS);i++){
    const {name}=gl.getActiveUniform(id,i);
    u[name]=gl.getUniformLocation(id,name);
  }
  return {id,u};
}

const faces=[
  [[0,0,1],[1,0,1],[1,1,1],[0,1,1],[0,0,1]],
  [[1,0,0],[0,0,0],[0,1,0],[1,1,0],[0,0,-1]],
  [[0,0,0],[0,0,1],[0,1,1],[0,1,0],[-1,0,0]],
  [[1,0,1],[1,0,0],[1,1,0],[1,1,1],[1,0,0]],
  [[0,1,1],[1,1,1],[1,1,0],[0,1,0],[0,1,0]],
  [[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,-1,0]]
];
const corners=[[0,0],[1,0],[1,1],[0,1]];
const triangles=[0,1,2,0,2,3];

export class Geometry {
  constructor(capacity=32768){
    this.data=new Float32Array(capacity);
    this.length=0;
  }
  vertex(x,y,z,nx,ny,nz,color,u,v,kind) {
    if(this.length+12>this.data.length){
      const next=new Float32Array(this.data.length*2);
      next.set(this.data);
      this.data=next;
    }
    const a=this.data;
    let i=this.length;
    a[i++]=x; a[i++]=y; a[i++]=z;
    a[i++]=nx; a[i++]=ny; a[i++]=nz;
    a[i++]=color[0]; a[i++]=color[1]; a[i++]=color[2];
    a[i++]=u; a[i++]=v; a[i++]=kind;
    this.length=i;
  }
  box(x,y,z,w,h,l,ink,kind=0,yaw=0,pitch=0,bank=0,taper=1) {
    const a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(pitch),d=Math.sin(pitch);
    const e=Math.cos(bank),f=Math.sin(bank);
    for(let j=0;j<6;j++){
      const face=faces[j], [nx,ny,nz]=face[4];
      const qy=ny*c-nz*d,qz=ny*d+nz*c,qx=nx*e-qy*f;
      const ux=kind===2 ? Math.max(1,Math.round((j<2?w:l)/1.15)) : 1;
      const uy=kind===2 ? Math.max(1,Math.round(h/1.3)) : 1;
      for(const i of triangles){
        const [rx,ry,rz]=face[i], [u,v]=corners[i];
        const bx=(rx-.5)*w*(ry?taper:1),by=(ry-.5)*h,bz=(rz-.5)*l;
        const py=by*c-bz*d,pz=by*d+bz*c,px=bx*e-py*f;
        this.vertex(x+px*a+pz*b,y+bx*f+py*e,z+pz*a-px*b,
          qx*a+qz*b,nx*f+qy*e,qz*a-qx*b,ink,u*ux,v*uy,kind);
      }
    }
  }
  plane(x,y,z,w,h,ink,kind=0,vertical=false){
    for(const i of triangles){
      const [u,v]=corners[i];
      this.vertex(x+(u-.5)*w,vertical?y+(v-.5)*h:y,vertical?z:z+(.5-v)*h,
        0,vertical?0:1,vertical?1:0,ink,u,v,kind);
    }
  }
  diamond(x,y,z,r,h,ink,angle){
    for(let i=0;i<4;i++){
      const a=angle+i*Math.PI/2,b=a+Math.PI/2;
      const ax=x+Math.sin(a)*r,az=z+Math.cos(a)*r;
      const bx=x+Math.sin(b)*r,bz=z+Math.cos(b)*r;
      this.vertex(x,y+h,z,0,1,0,ink,0,0,3);
      this.vertex(ax,y,az,0,1,0,ink,0,0,3);
      this.vertex(bx,y,bz,0,1,0,ink,0,0,3);
      this.vertex(x,y-h,z,0,-1,0,ink,0,0,3);
      this.vertex(bx,y,bz,0,-1,0,ink,0,0,3);
      this.vertex(ax,y,az,0,-1,0,ink,0,0,3);
    }
  }
}

export function createRenderer(canvas){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl) throw Error('WebGL 2 unavailable');
  const meshProgram=program(gl,vertex,fragment), skyProgram=program(gl,screen,sky);
  const finishProgram=program(gl,screen,finish);
  const framebuffer=gl.createFramebuffer(), texture=gl.createTexture(), depth=gl.createRenderbuffer();
  const empty=gl.createVertexArray();
  const hdr=Boolean(gl.getExtension('EXT_color_buffer_float') && gl.getExtension('OES_texture_float_linear'));
  let width=0,height=0;
  function resize(scale){
    const dpr=Math.min(devicePixelRatio||1,1.5)*scale;
    const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    if(width===w && height===h) return;
    canvas.width=width=w; canvas.height=height=h;
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Framebuffer unavailable');
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function upload(mesh,geometry,dynamic=true){
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,geometry.data.subarray(0,geometry.length),dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
    mesh.count=geometry.length/12;
  }
  function buffer(geometry,dynamic=false){
    const mesh={vao:gl.createVertexArray(),vbo:gl.createBuffer(),count:0};
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vbo);
    for(let i=0;i<4;i++){
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,3,gl.FLOAT,false,48,i*12);
    }
    upload(mesh,geometry,dynamic);
    return mesh;
  }
  function drop(mesh){gl.deleteBuffer(mesh.vbo);gl.deleteVertexArray(mesh.vao);}
  function draw(mesh,z=0){
    if(!mesh.count) return;
    gl.uniform1f(meshProgram.u.offsetZ,z);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  function render(view,opaque,transparent){
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.viewport(0,0,width,height);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(skyProgram.id);
    gl.bindVertexArray(empty);
    gl.uniform3fv(skyProgram.u.fog,view.fog);
    gl.uniform1f(skyProgram.u.aspect,width/height);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(meshProgram.id);
    const u=meshProgram.u;
    gl.uniform2f(u.lens,view.zoom*height/width,view.zoom);
    gl.uniform2f(u.tilt,Math.cos(view.pitch),Math.sin(view.pitch));
    gl.uniform3fv(u.eye,view.eye);
    gl.uniform3fv(u.fog,view.fog);
    gl.uniform3fv(u.accent,view.accent);
    gl.uniform1f(u.roll,view.roll);
    gl.uniform1f(u.travel,view.travel);
    for(const [mesh,z] of opaque) draw(mesh,z);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    gl.depthMask(false);
    for(const [mesh,z] of transparent) draw(mesh,z);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.useProgram(finishProgram.id);
    gl.bindVertexArray(empty);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.uniform1i(finishProgram.u.frame,0);
    gl.uniform2f(finishProgram.u.texel,1/width,1/height);
    gl.uniform1f(finishProgram.u.time,view.time);
    gl.uniform1f(finishProgram.u.impact,view.impact);
    gl.uniform1f(finishProgram.u.velocity,view.velocity);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  return {resize,buffer,upload,drop,render};
}
