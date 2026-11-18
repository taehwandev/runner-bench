// All shader colors use display space for a deliberately limited film palette.
export const common = `
precision highp float;
uniform vec3 eye,forward,right,up,sun,lamp;
uniform float t,night,dusk,lens;
const float aspect=.5625;
vec3 horizon(){return mix(mix(vec3(.99,.82,.64),vec3(1.,.53,.37),dusk),vec3(.21,.27,.41),night);}
`;
export const screenVertex=`attribute vec2 pos; varying vec2 uv;void main(){uv=pos;gl_Position=vec4(pos,.99999,1.);}`;
export const screenFragment=common+`
varying vec2 uv;
uniform sampler2D grain,reflection;
float n(vec2 p){return texture2D(grain,p/256.).r;}
float fb(vec2 p){return .55*n(p)+.29*n(p*2.11)+.16*n(p*4.23);}
vec3 sky(vec3 ray){
  float h=max(ray.y,0.),dist=length(ray-sun);
  vec3 zen=mix(mix(vec3(.32,.65,.73),vec3(.42,.41,.62),dusk),vec3(.025,.046,.12),night);
  vec3 col=mix(horizon(),zen,1.-exp(-h*4.2));
  vec3 sunlight=vec3(1.,.76,.42);
  col+=sunlight*(.15*exp(-dist*4.)+.19*exp(-dist*15.))*(1.-night);
  col=mix(col,vec3(1.,.944,.747),(1.-smoothstep(.042,.044,dist))*(1.-night));
  vec2 astro=vec2(atan(ray.x,-ray.z),asin(ray.y))*155.;
  vec2 cell=floor(astro),off=vec2(n(cell*3.91),n(cell*5.2+18.))*.73+.13;
  float star=1.-smoothstep(.03,.20,length(fract(astro)-off));
  col+=vec3(.81,.86,1.)*star*smoothstep(.62,.94,n(cell*7.1))*night*smoothstep(.005,.13,h);
  vec2 q=ray.xz/(h+.075)*4.8+vec2(t*.057,3.);
  q+=vec2(n(q*.69),n(q*.71+8.))*.64;
  float clouds=fb(q*vec2(.68,1.04)),mask=smoothstep(.48,.68,clouds)*smoothstep(.0,.075,h);
  vec3 shade=mix(vec3(.87,.76,.69),vec3(.76,.49,.53),dusk);
  vec3 lit=mix(vec3(1.,.94,.81),vec3(1.,.74,.56),dusk);
  vec3 cloud=mix(shade,lit,smoothstep(-.02,.07,clouds-fb(q*vec2(.68,1.04)+vec2(.45,.72))));
  cloud=mix(cloud,vec3(.15,.18,.29),night);
  return mix(col,cloud,mask*mix(.79,.44,night));
}
float waves(vec2 p){
  return .62*sin(p.y*2.9+p.x*.64+1.35*t+2.7*n(p*.62))+
         .29*sin(p.y*5.1-p.x*1.15-1.17*t+2.1*n(p*1.24))+
         .12*sin(p.y*11.+p.x*1.9+1.6*t);
}
vec3 water(vec3 ray){
  float d=min(800.,-eye.y/min(ray.y,-.0001));vec3 p=eye+ray*d;
  float w=waves(p.xz),grainy=n(p.xz*vec2(2.3,8.)+t*.32);
  float atten=1.-smoothstep(27.,130.,d);
  vec2 slope=vec2((waves(p.xz+vec2(.09,0))-w)*.34,(waves(p.xz+vec2(0,.09))-w)*.52)*(.22+.78*atten);
  vec3 normal=normalize(vec3(-slope.x,1.,-slope.y)),refl=reflect(ray,normal);
  vec2 coast=(p.xz-vec2(0.,.2))/vec2(7.65,5.05);
  float reef=length(coast),shallows=exp(-max(reef-1.,0.)*1.72);
  vec3 deep=mix(vec3(.075,.43,.49),vec3(.22,.33,.44),dusk);
  deep=mix(deep,vec3(.035,.115,.18),night);
  vec3 col=mix(deep,mix(vec3(.29,.74,.66),vec3(.12,.28,.32),night),shallows*.87);
  float grazing=pow(1.-max(-ray.y,0.),5.);
  col=mix(col,horizon(),grazing*.76);
  col+=(.03*w+.05*(grainy-.5))*atten*(1.-.65*night);
  vec2 mirrorUV=uv*.5+.5+vec2(slope.x*.68,slope.y*.42)*min(.9,10./d);
  vec4 island=texture2D(reflection,clamp(mirrorUV,.001,.999));
  col=mix(col,island.rgb*.78,island.a*(.37+.30*grazing));
  float sparkle=dot(refl,sun);
  col+=vec3(1.,.71,.36)*(pow(max(sparkle,0.),145.)*.65+pow(max(sparkle,0.),36.)*.17)*(1.-night);
  float crest=smoothstep(.67,.87,w+grainy*.24)*smoothstep(.3,.73,grainy);
  col+=vec3(.46,.65,.62)*crest*atten*(.25-.17*night);
  float angle=atan(coast.y,coast.x);
  float edge=reef-.055*cos(angle*3.+.7)-.04*sin(angle*5.)+.025*(grainy-.5);
  float shore=exp(-abs(edge-1.07)*13.);
  float curl=.5+.5*cos(edge*93.-t*1.59+w*.91+grainy*2.);
  float foam=shore*smoothstep(.35,.86,curl)*(.48+.52*grainy);
  col=mix(col,mix(vec3(.9,.96,.85),vec3(.38,.59,.63),night),foam);
  return mix(col,horizon(),smoothstep(65.,420.,d)*.83);
}
float beam(vec3 ray,vec3 dir){
  vec3 rel=eye-lamp;float a=dot(ray,dir),b=dot(rel,ray),c=dot(rel,dir);
  float depth=(a*c-b)/max(.001,1.-a*a);
  float along=clamp(c+a*depth,0.,42.);depth=max(0.,dot(lamp+dir*along-eye,ray));
  float radial=length(eye+ray*depth-lamp-dir*along),width=.1+along*.058;
  return exp(-2.*radial*radial/(width*width))*exp(-along*.073)*(1.-smoothstep(34.,42.,along));
}
void main(){
  vec3 ray=normalize(forward+lens*(uv.x*aspect*right+uv.y*up));
  vec3 col=ray.y>=0.?sky(ray):water(ray);
  if(night>.001){
    vec3 dir=normalize(vec3(cos(t*.63),.008,sin(t*.63)));
    float light=beam(ray,dir)+.55*beam(ray,-dir);
    float g=length(cross(lamp-eye,ray));
    col+=night*vec3(1.,.76,.38)*(light*.69+.64*exp(-g*3.5));
  }
  col+=(texture2D(grain,gl_FragCoord.xy/256.).r-.5)*.014;
  gl_FragColor=vec4(col,1.);
}`;
export const meshVertex=common+`
attribute vec3 pos,norm,pigment;attribute float wind;
uniform float mirror;
varying vec3 material,world,normal;
void main(){
  vec3 p=pos;
  if(wind>1.5){
    float a=t*.13+wind*.44, flap=sin(t*3.3+wind)*.14+.06;
    p.y+=abs(p.x)*flap;
    p.xz=mat2(cos(a),sin(a),-sin(a),cos(a))*p.xz;
    p+=vec3(-4.+sin(a)*4.5,8.6+(wind-2.)*.62+.28*sin(a*3.),-3.+cos(a)*3.4);
  }else{
    p.x+=wind*.112*sin(t*1.74+p.z*.84+p.x*.3);p.y+=wind*.078*cos(t*2.05+p.x);
  }
  world=p;normal=norm;material=pigment;p.y*=mirror;vec3 d=p-eye;
  float z=dot(d,forward);gl_Position=vec4(dot(d,right)/(lens*aspect),dot(d,up)/lens,z*1.0005-.20,z);
}`;
export const meshFragment=common+`
varying vec3 material,world,normal;
void main(){
  if(world.y<.026*sin(world.x*1.8+t)+.026*sin(world.z*2.3-t)) discard;
  vec3 key=normalize(vec3(sun.x-.47,max(.42,sun.y),.58));
  float diffuse=max(dot(normal,key),0.),height=smoothstep(.0,3.4,world.y);
  vec3 light=vec3(.70,.76,.78)+vec3(.36,.29,.16)*diffuse;
  light*=.92+.08*height;
  light=mix(light,light*vec3(1.12,.78,.73),dusk*.75);
  vec3 col=material*light;
  col=mix(col,material*vec3(.21,.31,.44)+vec3(.014,.027,.06),night*.97);
  float lantern=(1.-smoothstep(.32,.38,length(world.xz-lamp.xz)))*(1.-smoothstep(.26,.35,abs(world.y-lamp.y)));
  col=mix(col,vec3(1.,.89,.58),night*lantern*smoothstep(.4,.7,material.r));
  col=mix(col,horizon(),.045+smoothstep(25.,70.,length(world-eye))*.09);
  gl_FragColor=vec4(col,1.);
}`;
