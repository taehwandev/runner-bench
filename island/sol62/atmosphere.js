export const world = `
uniform float uTime, uDusk, uNight, uBeacon;
uniform vec3 uSun, uHorizon, uZenith, uWarm, uLamp, uBeam;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p) {
  return .57*noise(p)+.28*noise(p*2.07+7.3)+.15*noise(p*4.03-3.5);
}
float shore(vec2 p) {
  vec2 n = vec2(p.x/28., p.y/17.);
  float a = atan(n.y, n.x + .00001);
  return (length(n) - 1. - .12*sin(3.*a+.6) - .075*cos(5.*a-.5)
                         - .028*sin(11.*a+1.)) * 20.;
}
vec3 clearSky(vec3 d) {
  float h = max(d.y, 0.);
  float toward = max(dot(d,uSun),0.);
  vec3 sky = mix(uHorizon,uZenith,1.-exp(-h*4.8));
  sky += uWarm*(.17*pow(toward,8.)+.22*pow(toward,42.))*(1.-uNight);
  return sky;
}
float fogFactor(float distance) {
  return 1.-exp(-distance*(.0016+.0017*uDusk+.0006*uNight));
}
`;

const skyFragment = `
varying vec3 vWorld;
${world}

float stars(vec3 d) {
  vec2 uv = vec2(atan(d.x,d.z), asin(d.y))*110.;
  vec2 cell = floor(uv);
  vec2 p = fract(uv)-.5;
  float seed = hash(cell);
  p -= vec2(hash(cell+10.3), hash(cell-7.2))*.58-.29;
  float aa = clamp(length(fwidth(uv))*.42,.045,.24);
  float radius = mix(.035,.16,pow(seed,10.));
  return (1.-smoothstep(radius*.27,radius+aa,length(p))) *
    smoothstep(.71,.99,seed) * (.82+.18*sin(seed*374.+uTime*.8)) / (1.+aa*3.);
}
void main() {
  vec3 d = normalize(vWorld-cameraPosition);
  vec3 col = clearSky(d);
  float sd = length(d-uSun);
  float altitude = smoothstep(-.038,.0,uSun.y);
  float sun = (1.-smoothstep(.016,.018,sd))*altitude;
  col = mix(col,vec3(1.,.92-.10*uDusk,.69-.16*uDusk),sun);
  col += uWarm*.19*exp(-sd*19.)*altitude;
  float y = max(d.y+.10,.052);
  vec2 p = d.xz/y * vec2(1.36, 2.05);
  p += vec2(uTime*.022,uTime*.008);
  float body = fbm(p*.83+vec2(0,fbm(p*.51)*1.9));
  float streak = fbm(p*vec2(1.65,2.6)+15.);
  float cloud = smoothstep(.48,.72,body*.78+streak*.22) *
                smoothstep(.008,.13,d.y) * (1.-smoothstep(.57,.94,d.y));
  float edge = clamp((body-fbm((p+vec2(.31,.06))*.83+vec2(0,fbm(p*.51)*1.9)))*3.+.42,0.,1.);
  vec3 cloudDark = mix(vec3(.29,.34,.40),vec3(.255,.188,.275),uDusk);
  vec3 cloudLit = mix(vec3(.86,.79,.68),vec3(.97,.46,.32),uDusk);
  vec3 cloudColor = mix(mix(cloudDark,cloudLit,edge),vec3(.044,.071,.139),uNight);
  col = mix(col,cloudColor,cloud*(.81-.39*uNight));
  float dust = exp(-abs(dot(d,normalize(vec3(.48,.50,.72))))*12.);
  float starLight = stars(d)*.79 + stars(normalize(d+vec3(.134,.023,.085)))*.31;
  col += uNight * smoothstep(.025,.23,d.y) * (1.-cloud) *
         (vec3(.68,.79,1.)*starLight+vec3(.026,.031,.063)*dust);
  float grain = (hash(gl_FragCoord.xy)-.5)*.013;
  gl_FragColor = vec4(col+grain,1.);
}
`;

const waterVertex = `
varying vec3 vWorld;
uniform float uTime;
void main() {
  vec3 p = position;
  float local = 1.-smoothstep(20.,95.,length(p.xz));
  p.y += local*(.10*sin(dot(p.xz,vec2(.62,.91))-uTime*1.62)
      + .063*sin(dot(p.xz,vec2(-1.25,.39))-uTime*2.28)
      + .035*sin(dot(p.xz,vec2(.24,1.78))-uTime*2.6));
  vWorld=p;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}
`;

const waterFragment = `
varying vec3 vWorld;
${world}

vec2 waveSlope(vec2 p, vec2 dir, float speed, float strength) {
  float phase=dot(p,dir)-uTime*speed;
  return dir*cos(phase)*strength*(1.-smoothstep(.52,2.65,fwidth(phase)));
}
void main() {
  vec2 p = vWorld.xz;
  vec3 view = normalize(cameraPosition-vWorld);
  float dist = length(cameraPosition-vWorld);
  float swell=fbm(p*.084);
  vec2 warped=p+vec2(swell,noise(p*.099+8.)) * 2.3;
  vec2 slope = waveSlope(warped,vec2(.62,.91),1.62,.061)
             + waveSlope(warped,vec2(-1.25,.39),2.28,.056)
             + waveSlope(warped,vec2(.24,1.78),2.6,.031)
             + waveSlope(p,vec2(.084,.16),.74,.073);
  float detail = 1.-smoothstep(22.,180.,dist);
  slope += detail*(waveSlope(p,vec2(3.3,-1.9),4.1,.009)
                 + waveSlope(p,vec2(2.2,5.2),4.8,.008)
                 + waveSlope(p,vec2(-6.1,1.1),5.9,.006));
  slope *= (.62+.54*swell)*(1.-smoothstep(140.,565.,dist));
  vec3 n = normalize(vec3(-slope.x,1.,-slope.y));
  vec3 r = reflect(-view,n);
  float fresnel = .055+.83*pow(1.-clamp(dot(n,view),0.,1.),4.);
  float edge = shore(p);
  float shelf = 1.-smoothstep(.3,13.,edge);
  float sand = 1.-smoothstep(-.7,3.0,edge);
  float texture = fbm(p*.39);
  vec3 deep = mix(vec3(.035,.255,.324),vec3(.027,.086,.166),uDusk*.53+uNight*.46);
  vec3 reef = mix(vec3(.059,.594,.537),vec3(.049,.183,.228),uDusk*.44+uNight*.56);
  vec3 water = mix(deep,reef,shelf*(.63+.42*texture));
  water = mix(water,mix(vec3(.56,.67,.49),vec3(.068,.153,.219),uNight),sand*.50);
  water *= .86+.21*texture;
  vec3 color = mix(water,clearSky(r),fresnel*.84);
  float glint = max(dot(r,uSun),0.);
  float glitter = pow(glint,80.)*.26 + pow(glint,335.)*.74;
  color += glitter*uWarm*smoothstep(-.12,.02,uSun.y)*(1.-uNight);
  float wave = sin(edge*1.85+uTime*2.25+fbm(p*.48)*3.);
  float foamTexture = fbm(p*1.62+vec2(uTime*.24,-uTime*.19));
  float breaker = smoothstep(.60,.96,wave+foamTexture*.41-.24);
  float lace = smoothstep(.42,.70,foamTexture+breaker*.17);
  float foam = max(breaker*lace*exp(-max(edge,0.)*.19)*.85,
                  exp(-abs(edge-.22+sin(uTime*1.72+p.x*.29)*.35)*2.4)*lace*.91);
  foam *= smoothstep(-1.15,-.25,edge);
  float crest = smoothstep(.86,1.,sin(dot(warped,vec2(.51,.86))-uTime*1.66)) *
        smoothstep(.61,.78,texture)*.21*detail;
  vec3 foamColor = mix(vec3(.85,.96,.89),vec3(.29,.40,.60),uNight*.94+uDusk*.06);
  color = mix(color,foamColor,clamp(foam+crest,0.,1.));
  vec3 rel = vWorld-uLamp;
  float projected = dot(normalize(rel.xz),uBeam.xz);
  float sweep = smoothstep(.971,.999,projected);
  color += uBeacon*vec3(.40,.31,.15)*sweep*exp(-length(rel.xz)*.043)*(.3+.7*texture)*.69;
  color = mix(color,clearSky(normalize(vec3(-view.x,.013,-view.z))),smoothstep(105.,1000.,dist)*.93);
  gl_FragColor = vec4(color+(hash(gl_FragCoord.xy)-.5)*.009,1.);
}
`;

export function atmosphere(T, scene, uniforms) {
  const sky = new T.Mesh(new T.SphereGeometry(1750,32,18), new T.ShaderMaterial({
    uniforms, side: T.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vWorld;
      void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: skyFragment
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  const grid = new T.PlaneGeometry(2,2,108,108);
  grid.rotateX(-Math.PI/2);
  const pos = grid.attributes.position;
  const spread = x => 19*Math.sinh(x*5.21);
  for (let i=0; i<pos.count; i++) pos.setXYZ(i,spread(pos.getX(i)),0,spread(pos.getZ(i)));
  grid.computeBoundingSphere();
  scene.add(new T.Mesh(grid, new T.ShaderMaterial({
    uniforms, vertexShader: waterVertex, fragmentShader: waterFragment
  })));
}
