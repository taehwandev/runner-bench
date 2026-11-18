import * as T from './lib/three-0.160.0.module.min.js';
import {atmosphere,noiseGLSL,seeded} from './geometry.js';
import {motion} from './route.js';
export function sky(scene,camera){
 const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:atmosphere,
 vertexShader:`varying vec3 dir;void main(){dir=position;vec4 clip=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);gl_Position=clip.xyww;}`,
 fragmentShader:`
 uniform float night; varying vec3 dir;
 ${noiseGLSL}
 float fbm(vec2 p){return noise(p)*.55+noise(p*2.12+18.)*.28+noise(p*4.27-7.)*.12+noise(p*8.9)*.05;}
 void main(){
  vec3 d=normalize(dir);float h=d.y,az=atan(d.x,-d.z);vec2 u=vec2(az,h);
  vec3 horizon=mix(vec3(.91,.704,.656),vec3(.31,.35,.49),night);
  vec3 high=mix(vec3(.247,.323,.465),vec3(.065,.107,.21),night);
  vec3 sky=mix(horizon,high,smoothstep(-.025,.58,h));
  float cloud=fbm(vec2(az*3.1,h*13.)+vec2(17.2,4.));float wisps=smoothstep(.32,.72,cloud);
  sky=mix(sky,mix(vec3(.57,.515,.607),vec3(.18,.223,.34),night),wisps*.55*smoothstep(-.06,.12,h));
  float streak=fbm(u*vec2(7.,72.)+12.);
  sky+=vec3(.142,.066,.036)*smoothstep(.46,.75,streak)*exp(-abs(h-.12)*3.)*(1.-night);
  float disc=distance(d,normalize(vec3(.63,.237,-1.)));
  sky+=vec3(.32,.17,.075)*exp(-disc*6.5)*(1.-.82*night);
  sky=mix(sky,mix(vec3(1.,.858,.699),vec3(.8,.83,.89),night), (1.-smoothstep(.078,.079,disc))*(1.-.38*wisps));
  for(int i=0;i<3;i++){
    float j=float(i),ridge=.004+.052*fbm(vec2(az*5.+32.*j,11.))+.075*noise(vec2(az*11.+j*4.,5.))-.034*j;
    sky=mix(sky,mix(vec3(.71-.048*j,.66-.028*j,.707-.014*j),vec3(.25-.014*j,.30-.018*j,.416-.015*j),night),1.-smoothstep(ridge-.002,ridge,h));
  }
  sky+=(hash(gl_FragCoord.xy)-.5)*.018;gl_FragColor=vec4(sky,1.);
 }`});
 const mesh=new T.Mesh(new T.SphereGeometry(1,24,16),material);mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);
}
export function weather(scene,renderer){
 const random=seeded(19071), count=2100,geo=new T.BufferGeometry(),data=[];
 for(let i=0;i<count;i++)data.push(random()*52,random()*38,random()*57);
 geo.setAttribute('position',new T.Float32BufferAttribute(data,3));
 const uniforms={clock:{value:0},px:{value:1},...atmosphere};
 const snow=new T.Points(geo,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
 vertexShader:`uniform float clock,px;varying float opacity;
 void main(){ vec3 a=position;float s=fract(a.x*1.38+a.z*.28);
 vec3 volume=vec3(52.,38.,57.);
 vec3 wind=vec3(clock*(.78+.24*s)+.44*sin(clock*.7+a.y),-clock*(1.35+1.3*s),clock*.35);
 vec3 p=mod(a+wind-cameraPosition+volume*.5,volume)-volume*.5+cameraPosition;
 vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp((1.+s*1.6)*px*8./max(1.,-mv.z),.85,4.2*px);
 opacity=(.2+.46*s)*smoothstep(.35,2.5,-mv.z)*(1.-smoothstep(19.,29.,length(p-cameraPosition)));
 }`,fragmentShader:`varying float opacity;void main(){vec2 p=gl_PointCoord-.5;float a=smoothstep(.52,.13,length(vec2(p.x*1.28+p.y*.18,p.y)));gl_FragColor=vec4(.92,.92,.95,a*opacity);}`}));
 snow.frustumCulled=false;snow.renderOrder=4;scene.add(snow);
 const steamGeo=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1));
 const total=44,centers=new T.InstancedBufferAttribute(new Float32Array(total*3),3),puffs=new T.InstancedBufferAttribute(new Float32Array(total*3),3);
 steamGeo.setAttribute('center',centers);steamGeo.setAttribute('puff',puffs);steamGeo.instanceCount=total;
 const steam=new T.Mesh(steamGeo,new T.ShaderMaterial({uniforms:atmosphere,transparent:true,depthWrite:false,
 vertexShader:`attribute vec3 center,puff;varying vec2 st;varying vec3 f;void main(){st=uv;f=puff;
 vec4 mv=viewMatrix*vec4(center,1.);mv.xy+=position.xy*puff.x;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying vec2 st;varying vec3 f;uniform float night,bore;
 ${noiseGLSL}
 void main(){vec2 v=st*2.-1.;float w=noise(v*3.+f.z)*.39+noise(v*6.5+f.z)*.19;
 float alpha=(1.-smoothstep(.42,.98,length(v)+.25-w))*(1.-smoothstep(.76,1.,length(v)))*f.y;
 vec3 color=mix(vec3(.61,.62,.67),vec3(.89,.845,.82),clamp(.43+.45*v.y+.31*w,0.,1.));
 color*=1.-.37*night-.35*bore;gl_FragColor=vec4(color,alpha);}`}));
 steam.frustumCulled=false;steam.renderOrder=3;scene.add(steam);
 return t=>{
   uniforms.clock.value=t;uniforms.px.value=renderer.getPixelRatio();
   const duration=3.96,now=motion(t);
   for(let i=0;i<total;i++){
     const age=((t+i*duration/total)%duration+duration)%duration,k=age/duration;
     const birth=t-age,v=birth<0?birth*24:motion(birth).distance;
     const phase=Math.floor((t+i*duration/total)/duration)*17+i*3.09;
     centers.setXYZ(i,-age*.53+Math.sin(phase)*(.08+k*.46),4.77+age*(1.38+.19*Math.sin(phase))+k*k*.80,now.distance-6.2-(now.distance-v)*.38+Math.cos(phase)*.19);
     puffs.setXYZ(i,.49+age*1.31,(1.-k)*(.38+.13*Math.cos(phase)),phase%501);
   }centers.needsUpdate=puffs.needsUpdate=true;
 };
}

