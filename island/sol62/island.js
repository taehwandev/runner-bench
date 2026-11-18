import { world } from './atmosphere.js';

const mix = (a,b,t) => a+(b-a)*t;
const clamp = x => Math.max(0,Math.min(1,x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const TAU = Math.PI*2;

export function random(seed) {
  return () => {
    seed = (Math.imul(1664525,seed)+1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shore(x,z) {
  const a = Math.atan2(z/17,x/28);
  return (Math.hypot(x/28,z/17)-1-.12*Math.sin(3*a+.6)-.075*Math.cos(5*a-.5)
          -.028*Math.sin(11*a+1))*20;
}
function hill(x,z,cx,cz,rx,rz,angle) {
  const u=x-cx, v=z-cz;
  const a=u*Math.cos(angle)+v*Math.sin(angle);
  const b=v*Math.cos(angle)-u*Math.sin(angle);
  return Math.hypot(a/rx,b/rz);
}
function elevation(x,z) {
  const d = shore(x,z);
  const ridge = hill(x,z,-9,-4,16.8,12,-.27);
  const point = hill(x,z,12,-5,12.5,9.4,.28);
  const folded = .037*Math.sin(x*.92+z*.51)+.028*Math.sin(z*1.25-x*.41)
                +.027*Math.sin(x*2.01+z*1.35);
  const cliffA = (1-smooth(.76,1.01,ridge+folded))*(7.1+3.7*(1-Math.min(ridge,1)));
  const cliffB = (1-smooth(.72,1.02,point+folded))*(5.6+2.4*(1-Math.min(point,1)));
  const rim = 1-smooth(-4,-.1,d);
  return Math.max(-1.7,-d*.29)+rim*Math.max(cliffA,cliffB)
    + rim*(Math.sin(x*.49 + z*.45)*.30+Math.cos(z*.80)*.25);
}

const surfaceVertex = `
uniform float uTime;
attribute vec3 color;
attribute float flex;
attribute float occlusion;
varying vec3 vWorld, vColor, vNormal;
varying float vOcclusion;
void main() {
  vec3 p=position;
  float gust = sin(uTime*1.6+p.x*.13+p.z*.17)+.39*sin(uTime*3.3+p.z*.55);
  p.x+=gust*flex*.23;
  p.z+=cos(uTime*1.37+p.x*.22)*flex*.16;
  vWorld=(modelMatrix*vec4(p,1.)).xyz;
  vNormal=normalize(mat3(modelMatrix)*normal);
  vColor=color;
  vOcclusion=occlusion;
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
}`;
const surfaceFragment = `
varying vec3 vWorld, vColor, vNormal;
varying float vOcclusion;
${world}
void main() {
  vec3 n = normalize(vNormal);
  #ifdef TERRAIN
    vec2 p=vWorld.xz;
    float grain=fbm(p*1.72);
    float beds=sin(vWorld.y*3.6+p.x*.17+fbm(p*.38)*3.);
    float fissure=fbm(vec2(p.x+p.y*.74+vWorld.y*.16,vWorld.y*.28)*1.63);
    float strata=fbm(vec2(p.x*.46+p.y*.3,vWorld.y*.99));
    float flake=noise(p*10.+vWorld.y*4.);
    vec3 stone=mix(vec3(.194,.229,.223),vec3(.49,.447,.372),
                   .51*strata+.32*fissure+.067*beds+.10*flake);
    vec3 grass=mix(vec3(.095,.204,.116),vec3(.32,.43,.196),fbm(p*.55)*.7+grain*.3);
    vec3 sand=mix(vec3(.68,.523,.336),vec3(.93,.794,.58),.54+.15*grain+.14*flake);
    float wet=smoothstep(.03,.73,vWorld.y);
    sand*=.70+.30*wet;
    float cover=smoothstep(.54,.88,n.y+grain*.26);
    vec3 land=mix(stone,grass,cover);
    vec3 base=mix(sand,land,smoothstep(1.9,4.2,vWorld.y)*(1.-smoothstep(.85,1.30,cover)*(1.-smoothstep(2.,3.6,vWorld.y))));
    base*=.92+.15*grain;
  #else
    vec3 base=vColor;
    n *= gl_FrontFacing ? 1. : -1.;
  #endif
  vec3 sun=normalize(vec3(uSun.x,max(uSun.y,.19),uSun.z));
  float lit=max(dot(n,sun),0.);
  vec3 daytime=base*(.66+.42*lit+.13*max(n.y,0.));
  daytime+=base*uWarm*lit*(.24+.25*uDusk);
  daytime*=mix(vec3(1.),vec3(.97,.72,.59),uDusk*.71);
  #ifdef TERRAIN
    daytime*=1.-vOcclusion*(.19+.13*uDusk);
  #endif
  vec3 moon=base*vec3(.30,.43,.64)*(.68+.40*max(n.y,0.)+.41*max(dot(n,normalize(vec3(-.2,.65,.55))),0.));
  vec3 c=mix(daytime,moon,uNight);
  vec3 fromLamp=vWorld-uLamp;
  float direction=dot(normalize(fromLamp),uBeam);
  c+=vec3(.29,.17,.07)*uBeacon*smoothstep(.978,.998,direction)*
     exp(-.070*length(fromLamp));
  float dist=length(cameraPosition-vWorld);
  c=mix(c,uHorizon,fogFactor(dist)*(.66-.23*uNight));
  gl_FragColor=vec4(c,1.);
}`;

function surface(T, uniforms, terrain) {
  return new T.ShaderMaterial({
    uniforms, defines: terrain ? {TERRAIN:1} : {}, side: terrain ? T.FrontSide : T.DoubleSide,
    vertexShader: surfaceVertex, fragmentShader: surfaceFragment
  });
}

function terrainMesh(T, uniforms) {
  const g=new T.PlaneGeometry(78,54,168,124);
  g.rotateX(-Math.PI/2);
  const p=g.attributes.position;
  const shade=new Float32Array(p.count);
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i), z=p.getZ(i), y=elevation(x,z);
    p.setY(i,y);
    if (y<0) continue;
    let angle=0;
    for (const dist of [1,2.4,4,6,9,13,18,24]) {
      const test=elevation(x-dist*.27,z-dist*.96);
      angle=Math.max(angle,(test-y-.035)/dist);
    }
    shade[i]=smooth(.09,.64,angle);
  }
  g.setAttribute('occlusion',new T.BufferAttribute(shade,1));
  g.computeVertexNormals();
  return new T.Mesh(g,surface(T,uniforms,true));
}

class Geometry {
  constructor(T) {
    this.T=T;
    this.positions=[];
    this.colors=[];
    this.flex=[];
  }
  tri(a,b,c,color,bend=[0,0,0]) {
    this.positions.push(...a,...b,...c);
    this.colors.push(...color,...color,...color);
    this.flex.push(...bend);
  }
  mesh(material) {
    const g=new this.T.BufferGeometry();
    for (const [name,values,size] of [
      ['position',this.positions,3],['color',this.colors,3],['flex',this.flex,1]
    ]) g.setAttribute(name,new this.T.Float32BufferAttribute(values,size));
    g.computeVertexNormals();
    return new this.T.Mesh(g,material);
  }
}

const tinted = (color,shade) => color.map(v=>v*shade);
const polar = (x,y,z,r,a) => [x+r*Math.cos(a),y,z+r*Math.sin(a)];

function palm(batch, rand, x,y,z,h) {
  const tilt=rand()*TAU, bend=(rand()*.19+.04)*h;
  const stem=Array.from({length:7},(_,j)=>{
    const t=j/6;
    return [x+Math.cos(tilt)*bend*t*t,y+h*t,z+Math.sin(tilt)*bend*t*t];
  });
  for (let j=0;j<6;j++) {
    const [a,b]=[stem[j],stem[j+1]];
    const r=h*(.039-.0036*j);
    for (let k=0;k<6;k++) {
      const t=k*TAU/6, u=(k+1)*TAU/6;
      const a0=polar(...a,r,t), a1=polar(...a,r,u);
      const b0=polar(...b,r*.90,t), b1=polar(...b,r*.90,u);
      const shade=.79+rand()*.33;
      const bark=tinted([.45,.335,.204],shade);
      batch.tri(a0,b0,a1,bark);
      batch.tri(a1,b0,b1,bark);
    }
  }
  const tip=stem[6];
  const count=9+Math.floor(rand()*3);
  for (let k=0;k<count;k++) {
    const a=tilt+k*TAU/count+(rand()-.5)*.50;
    const dx=Math.cos(a), dz=Math.sin(a);
    const l=h*(.48+rand()*.29), arch=h*(.12+rand()*.18), drop=h*(.10+rand()*.16);
    const spine=t=>[tip[0]+dx*l*t,tip[1]+arch*Math.sin(t*Math.PI)-drop*t*t,
                    tip[2]+dz*l*t];
    const hue=mix(.76,1.30,rand());
    const green=tinted([.232,.43,.137],hue);
    for (let j=0;j<8;j++) {
      const t=j/8, u=(j+1)/8;
      const p=spine(t), q=spine(u);
      const span=(.065+.24*Math.sin((t+.07)*Math.PI))*l*(1-t*.57);
      for (const side of [-1,1]) {
        const leaf=[p[0]+dx*l*.16-dz*side*span,p[1]-.30*span,p[2]+dz*l*.16+dx*side*span];
        const spineTip=spine(t+.102);
        const color=tinted(green,.80+rand()*.35);
        batch.tri(p,spineTip,leaf,color,[t,u,u+.25]);
        batch.tri(p,q,[q[0]-dz*side*.024*l,q[1]-.01,q[2]+dx*side*.024*l],green,[t,u,u]);
      }
    }
  }
}

function rubble(batch,poly,rand,x,y,z,s,plant) {
  const a=rand()*TAU;
  const scale=[s*(.65+rand()*.48),s*(plant?.62:.73),s*(.60+rand()*.61)];
  const base=plant ? [.15,.258,.103] : [.36,.343,.29];
  const point=i=>[x+poly.getX(i)*scale[0]*Math.cos(a)+poly.getZ(i)*scale[2]*Math.sin(a),
                  y+poly.getY(i)*scale[1],
                  z+poly.getZ(i)*scale[2]*Math.cos(a)-poly.getX(i)*scale[0]*Math.sin(a)];
  for (let i=0;i<poly.count;i+=3) {
    const color=tinted(base,.72+rand()*.49);
    batch.tri(point(i),point(i+1),point(i+2),color,plant?[.1,.1,.1]:undefined);
  }
}
function vegetation(T, scene, uniforms) {
  const rand=random(241323);
  const batch=new Geometry(T);
  const rubbleShape=new T.IcosahedronGeometry(1,0);
  const bushShape=new T.IcosahedronGeometry(1,1);
  const rock=rubbleShape.attributes.position;
  const shrub=bushShape.attributes.position;
  for (let i=0;i<620;i++) {
    const x=(rand()-.5)*58, z=(rand()-.5)*38;
    const y=elevation(x,z);
    const slope=Math.hypot(elevation(x+.3,z)-y,elevation(x,z+.3)-y)/.3;
    if (shore(x,z)>1.7 || Math.hypot(x-12,z+5)<3.3) continue;
    if (y>2.25 && slope<1.25 && i<240 && rand()>.27) {
      palm(batch,rand,x,y-.06,z,2.5+rand()*2.55);
    } else if (y>1.1 && slope<1.45) {
      rubble(batch,shrub,rand,x,y,z,.34+rand()*.84,true);
    } else if (rand()<.33) {
      rubble(batch,rock,rand,x,y-.14,z,.22+rand()*.91,false);
    }
  }
  for (const [x,z,h] of [[-22,5,4.8],[-18,8,4.5],[-10,10,4.9],[2,10,4.3],[5,10,3.6],[17,6,4.7],[21,2,4.1]]) {
    palm(batch,rand,x,elevation(x,z)-.06,z,h);
  }
  for(let i=0;i<21;i++) {
    const x=-23+rand()*12, z=6+rand()*7;
    rubble(batch,rock,rand,x,elevation(x,z)-.14,z,.45+rand()*1.5,false);
  }
  rubbleShape.dispose();
  bushShape.dispose();
  scene.add(batch.mesh(surface(T,uniforms,false)));
}

function lighthouse(T, scene, uniforms) {
  const tower=new T.Group();
  const x=12, z=-5, y=elevation(x,z)-.17;
  tower.position.set(x,y,z);
  scene.add(tower);
  const stone=new T.MeshStandardMaterial({color:0xe8d5ab,roughness:.86});
  const dark=new T.MeshStandardMaterial({color:0x413d3c,roughness:.75});
  const red=new T.MeshStandardMaterial({color:0x9e452f,roughness:.81});
  const glass=new T.MeshBasicMaterial({color:0x747b73});
  const lamp=new T.MeshBasicMaterial({color:0xffd394});
  const put=(g,m,px,py,pz)=>{
    const mesh=new T.Mesh(g,m);
    mesh.position.set(px,py,pz);
    tower.add(mesh);
    return mesh;
  };
  const cylinder=(top,base,h,py,m,n=20)=>put(new T.CylinderGeometry(top,base,h,n),m,0,py,0);
  cylinder(1.33,1.55,.42,.26,dark);
  cylinder(.96,1.34,2.8,1.76,stone);
  cylinder(.90,.97,.64,3.48,red);
  cylinder(.79,.90,1.01,4.29,stone);
  cylinder(1.18,.85,.28,4.92,dark);
  cylinder(1.19,1.19,.14,5.11,stone);
  cylinder(.72,.75,1.12,5.72,glass,10);
  const light=cylinder(.727,.752,.94,5.73,lamp,10);
  cylinder(.94,.97,.16,6.33,dark);
  cylinder(.09,.96,.67,6.71,red,12);
  cylinder(.042,.067,.38,7.14,dark,8);
  for (let i=0;i<10;i++) {
    const a=i*TAU/10;
    put(new T.BoxGeometry(.06,1.12,.075),dark,.746*Math.cos(a),5.73,.746*Math.sin(a)).rotation.y=-a;
    put(new T.BoxGeometry(.047,.57,.047),dark,1.11*Math.cos(a),5.38,1.11*Math.sin(a));
  }
  const rail=put(new T.TorusGeometry(1.11,.034,5,32),dark,0,5.65,0);
  rail.rotation.x=Math.PI/2;
  put(new T.BoxGeometry(.47,1.14,.11),dark,0,.96,1.23);
  put(new T.BoxGeometry(.25,.50,.11),dark,0,2.46,1.13);
  put(new T.BoxGeometry(.21,.37,.10),dark,0,4.32,.86);
  const annex=put(new T.BoxGeometry(2.55,1.14,1.94),stone,-1.97,.53,-.68);
  annex.rotation.y=-.24;
  const roof=put(new T.CylinderGeometry(0,1.71,.74,4),red,-1.97,1.38,-.68);
  roof.rotation.y=Math.PI/4-.24;
  uniforms.uLamp.value.set(x,y+5.74,z);
  return light;
}

function beamMesh(T,scene,uniforms) {
  const length=115;
  const g=new T.ConeGeometry(8.9,length,36,1,true);
  g.rotateZ(Math.PI/2);
  g.translate(length/2,0,0);
  const material=new T.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, side:T.FrontSide,
    blending:T.AdditiveBlending,
    vertexShader:`varying vec3 vWorld; void main(){
      vWorld=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vWorld; ${world}
      void main() {
        vec3 offset=vWorld-uLamp;
        float d=max(dot(offset,uBeam),0.);
        vec3 radial=normalize(offset-uBeam*d+vec3(.0001));
        vec3 view=normalize(cameraPosition-vWorld);
        float core=pow(abs(dot(radial,view)),.85);
        float fade=exp(-d*.028)*smoothstep(0.,3.,d)*(1.-smoothstep(80.,115.,d));
        gl_FragColor=vec4(.99,.75,.42,uBeacon*core*fade*.43);
      }`
  });
  const mesh=new T.Mesh(g,material);
  mesh.position.copy(uniforms.uLamp.value);
  scene.add(mesh);
  return mesh;
}

export function populateIsland(T,scene,uniforms) {
  scene.add(terrainMesh(T,uniforms));
  vegetation(T,scene,uniforms);
  const lamp=lighthouse(T,scene,uniforms);
  const beam=beamMesh(T,scene,uniforms);
  const glowMaterial=new T.SpriteMaterial({
    map:makeGlow(T), color:0xffcc86, transparent:true,
    depthWrite:false, blending:T.AdditiveBlending
  });
  const glow=new T.Sprite(glowMaterial);
  glow.scale.set(5.8,5.8,1);
  glow.position.copy(uniforms.uLamp.value);
  scene.add(glow);
  const axis=new T.Vector3(1,0,0);
  return (time, strength) => {
    lamp.visible=strength>.02;
    const pulse=.92+.08*Math.sin(time*4.7);
    lamp.material.color.setRGB(strength*pulse,.69*strength*pulse,.37*strength*pulse);
    glow.visible=lamp.visible;
    glowMaterial.opacity=strength*pulse*.61;
    beam.visible=strength>.002;
    beam.quaternion.setFromUnitVectors(axis,uniforms.uBeam.value);
  };
}

function makeGlow(T) {
  const size=64;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const r=Math.hypot(x-(size-1)/2,y-(size-1)/2)/(size/2);
    const i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;
    data[i+3]=Math.round(255*Math.exp(-r*6.6)*(1-smooth(.45,1,r)));
  }
  const map=new T.DataTexture(data,size,size);
  map.magFilter=T.LinearFilter;
  map.needsUpdate=true;
  return map;
}
