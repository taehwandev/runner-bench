import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facadeTexture, signTexture, skylineTexture, tileTexture, rng } from './textures.js';
import { R, neonMat, glowMat } from './models.js';

export const LANE_W = 2.2;
export const ROAD_HALF = 3.7;
export const DISTRICT_LEN = 800;

export const DISTRICTS = [
  { name: 'NEON CORE', fog: '#1d0a36', sky: ['#04010d', '#2a0b4a', '#ff3fd0'], neon: ['#ff2bd6', '#22e6ff', '#8a4dff', '#ff4f7b'], facade: ['#150d26', '#1b1032', '#100b1e'], curb: '#ff2bd6', signs: ['NOVA', 'KIRA', 'VOLT', 'LUX', 'ZERO', 'NEXUS', 'HOTEL', '24H'] },
  { name: 'CHROME HARBOR', fog: '#062530', sky: ['#010a10', '#0b3340', '#19f5c1'], neon: ['#19f5c1', '#ffae2b', '#2bc4ff', '#ffe066'], facade: ['#0c171d', '#112027', '#0a1317'], curb: '#19f5c1', signs: ['DOCK 9', 'CARGO', 'PORT', 'FERRY', 'SALT', 'TIDE', 'BAY', 'REEF'] },
  { name: 'RED LANTERN ROW', fog: '#2c0914', sky: ['#0d0105', '#3d0a1c', '#ff3355'], neon: ['#ff3355', '#ffd23f', '#ff7a3d', '#ff2bd6'], facade: ['#1e0b11', '#250d15', '#17080a'], curb: '#ffd23f', signs: ['RAMEN', 'NOODLE', 'KARAOKE', 'TEA', 'LUCKY', 'DRAGON', 'DIM SUM', 'BAR'] },
  { name: 'ULTRAVIOLET HEIGHTS', fog: '#170838', sky: ['#03010c', '#1c0a4a', '#9d4dff'], neon: ['#9d4dff', '#b6ff3b', '#22e6ff', '#ff4fd8'], facade: ['#110a28', '#160c33', '#0c0822'], curb: '#b6ff3b', signs: ['ARCADE', 'SYNTH', 'ORBIT', 'PULSE', 'HYPER', 'GRID', 'VR', 'DATA'] },
];
export const districtAt = s => Math.floor(Math.max(0, s) / DISTRICT_LEN) % DISTRICTS.length;

const MAX_L = 12;

// ---------- shaders ----------
const roadVert = /* glsl */`
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main(){
    vec4 w = modelMatrix * vec4(position,1.0);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const roadFrag = /* glsl */`
  uniform float uDist; uniform vec3 uCurb; uniform vec3 uNeonA; uniform vec3 uNeonB; uniform float uTime;
  uniform vec4 uL[${MAX_L}]; uniform vec4 uRP[${MAX_L}]; uniform vec3 uLC[${MAX_L}];
  uniform float uTunnel;
  varying vec3 vW;
  #include <fog_pars_fragment>
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  void main(){
    float s = uDist - vW.z;           // track coordinate (increases ahead)
    vec2 p = vec2(vW.x, s);
    float n = vnoise(p*vec2(0.35,0.18)) * 0.65 + vnoise(p*vec2(1.3,0.7))*0.35;
    float puddle = smoothstep(0.52, 0.66, n);
    float grain = vnoise(p*vec2(9.0,5.0))*0.5 + vnoise(p*vec2(23.0,13.0))*0.5;
    vec3 col = vec3(0.012,0.010,0.018) + grain*vec3(0.012,0.011,0.016);
    col *= mix(1.0, 0.5, puddle);
    // lane markings
    float ax = abs(vW.x);
    float dash = step(fract(s/7.0), 0.45);
    float laneLine = (1.0 - smoothstep(0.05, 0.09, abs(ax - ${(LANE_W / 2).toFixed(2)}))) * dash;
    float edge = 1.0 - smoothstep(0.07, 0.11, abs(ax - ${(ROAD_HALF - 0.25).toFixed(2)}));
    col += vec3(0.32,0.32,0.38) * laneLine * (1.0 - puddle*0.6);
    col += uCurb * edge * 0.9;
    // wet reflections of lights
    float wet = 0.25 + puddle * 1.1;
    vec3 acc = vec3(0.0);
    for (int i=0;i<${MAX_L};i++){
      vec4 L = uL[i]; vec4 RP = uRP[i]; vec3 C = uLC[i];
      vec2 d = vW.xz - L.xy;
      float pool = 1.0 / (1.0 + dot(d,d) * L.w);
      vec2 r = vW.xz - RP.xy;
      float streak = exp(-r.x*r.x*RP.z) * exp(-r.y*r.y*RP.w);
      acc += C * (pool * 0.05 + streak * wet * 0.7);
    }
    col += acc;
    // ambient neon streaks reflected from the facades along the road edges
    float bandL = exp(-pow(vW.x + 2.6, 2.0)*0.6), bandR = exp(-pow(vW.x - 2.6, 2.0)*0.6);
    float flick = 0.5 + 0.5*sin(s*0.21 + vnoise(vec2(s*0.05, 1.0))*6.0);
    col += (uNeonA*bandL + uNeonB*bandR) * flick * (0.08 + puddle * 0.5) * 0.5 * (1.0 - uTunnel*0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

const bldVert = /* glsl */`
  varying vec2 vUv; varying float vY; varying float vRoof; varying float vH;
  #include <fog_pars_vertex>
  void main(){
    vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
    vec3 p = position * sc;
    vUv = (abs(normal.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y)) / vec2(6.0, 12.0);
    vY = p.y + sc.y*0.5; vH = sc.y;
    vRoof = step(0.5, normal.y);
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(position,1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const bldFrag = /* glsl */`
  uniform sampler2D map; uniform vec3 uTint; uniform vec3 uGlow;
  varying vec2 vUv; varying float vY; varying float vRoof; varying float vH;
  #include <fog_pars_fragment>
  void main(){
    vec3 c = texture2D(map, vUv).rgb * uTint;
    // neon wash from the street below + darker crown
    c += uGlow * exp(-vY*0.25) * 0.5;
    c *= mix(1.0, 0.45, smoothstep(vH*0.75, vH, vY));
    c = mix(c, vec3(0.02,0.015,0.035), vRoof);
    gl_FragColor = vec4(c,1.0);
    #include <fog_fragment>
  }`;

const skyVert = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const skyFrag = `
  uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHaze; uniform float uTime;
  varying vec3 vP;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec3 d = normalize(vP);
    float y = d.y;
    vec3 c = mix(uMid, uTop, smoothstep(0.0, 0.55, y));
    c += uHaze * exp(-abs(y)*9.0) * 0.55;
    // stars
    vec2 gp = vec2(atan(d.z,d.x)*600.0, y*600.0); vec2 g = floor(gp);
    float st = step(0.997, h(g)) * smoothstep(0.5, 0.1, length(fract(gp)-0.5)) * smoothstep(0.15, 0.5, y) * (0.6+0.4*sin(uTime*2.0+h(g)*30.0));
    c += vec3(st);
    // moon
    vec3 md = normalize(vec3(-0.35, 0.42, -1.0));
    float m = dot(d, md);
    c += vec3(1.0,0.85,1.0) * smoothstep(0.9985, 0.9992, m) * 1.6;
    c += uHaze * pow(max(m,0.0), 180.0) * 0.6;
    gl_FragColor = vec4(c,1.0);
  }`;

function fogUniforms() { return THREE.UniformsUtils.clone(THREE.UniformsLib.fog); }

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.time = 0;
    this.dIndex = 0;
    this.fogCol = new THREE.Color(DISTRICTS[0].fog);
    this.root = new THREE.Group(); scene.add(this.root);
    this.lightsList = [];
    this.tunnels = []; // {s0, s1}
    this.overpasses = [];

    // district resources
    this.dres = DISTRICTS.map((d, i) => {
      const mats = [0, 1, 2].map(st => new THREE.ShaderMaterial({
        uniforms: { ...fogUniforms(), map: { value: facadeTexture(1000 + i * 31 + st * 7, d, st) }, uTint: { value: new THREE.Color(1.05, 1.0, 1.1) }, uGlow: { value: new THREE.Color(d.neon[st % d.neon.length]).multiplyScalar(0.35) } },
        vertexShader: bldVert, fragmentShader: bldFrag, fog: true,
      }));
      const signs = d.signs.map((t, k) => {
        const col = d.neon[k % d.neon.length];
        return {
          v: new THREE.MeshBasicMaterial({ map: signTexture(t, col, { w: 96, h: 384 }), color: new THREE.Color(1.7, 1.7, 1.7), side: THREE.DoubleSide }),
          h: new THREE.MeshBasicMaterial({ map: signTexture(t, col, { w: 512, h: 160 }), color: new THREE.Color(1.6, 1.6, 1.6) }),
          col,
        };
      });
      return { mats, signs, sky: skylineTexture(77 + i * 13, d) };
    });

    this.buildSky();
    this.buildGround();
    this.buildBuildings();
    this.buildLamps();
    this.buildTunnelPool();
    this.buildOverpassPool();
    this.buildRail();
    this.buildRain();
    this.applyDistrictInstant(0);
  }

  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uTime: { value: 0 } },
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), this.skyMat);
    this.sky.renderOrder = -10; this.root.add(this.sky);
    // skyline ring
    this.skylineMat = new THREE.MeshBasicMaterial({ map: this.dres[0].sky, transparent: true, fog: false, depthWrite: false, side: THREE.BackSide, color: new THREE.Color(1, 1, 1) });
    const cyl = new THREE.CylinderGeometry(330, 330, 110, 48, 1, true);
    this.skyline = new THREE.Mesh(cyl, this.skylineMat);
    this.skyline.position.y = 40; this.skyline.renderOrder = -9;
    this.dres.forEach(d => { d.sky.repeat.set(3, 1); });
    this.root.add(this.skyline);
  }

  buildGround() {
    this.roadU = {
      ...fogUniforms(),
      uDist: { value: 0 }, uTime: { value: 0 }, uCurb: { value: new THREE.Color() }, uNeonA: { value: new THREE.Color() }, uNeonB: { value: new THREE.Color() },
      uL: { value: Array.from({ length: MAX_L }, () => new THREE.Vector4(0, 999, 0, 1)) },
      uRP: { value: Array.from({ length: MAX_L }, () => new THREE.Vector4(0, 999, 1, 1)) },
      uLC: { value: Array.from({ length: MAX_L }, () => new THREE.Vector3()) },
      uTunnel: { value: 0 },
    };
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 260, 1, 1),
      new THREE.ShaderMaterial({ uniforms: this.roadU, vertexShader: roadVert, fragmentShader: roadFrag, fog: true }));
    road.rotation.x = -Math.PI / 2; road.position.z = -110;
    this.road = road; this.root.add(road);

    // sidewalks
    this.tile = tileTexture(); this.tile.repeat.set(3, 70);
    const swMat = new THREE.MeshStandardMaterial({ map: this.tile, color: 0x5a5068, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.25 });
    this.sidewalks = [];
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 260), swMat);
      sw.position.set(side * (ROAD_HALF + 3), 0.09, -110); this.root.add(sw); this.sidewalks.push(sw);
      // neon curb strip
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 260), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      curb.position.set(side * (ROAD_HALF + 0.02), 0.2, -110); this.root.add(curb);
      (this.curbs ||= []).push(curb);
    }
    // ground beyond sidewalks (dark)
    const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 260), new THREE.MeshBasicMaterial({ color: 0x050308 }));
    far.rotation.x = -Math.PI / 2; far.position.set(0, -0.05, -110); this.root.add(far);
  }

  // ---------- buildings ----------
  buildBuildings() {
    this.unitBox = new THREE.BoxGeometry(1, 1, 1); this.unitBox.translate(0, 0.5, 0);
    this.planeV = new THREE.PlaneGeometry(1, 1);
    this.stripGeo = new THREE.BoxGeometry(0.12, 1, 0.12); this.stripGeo.translate(0, 0.5, 0);
    this.buildings = [];
    this.nextB = [-20, -20];
    const N = this.quality.low ? 11 : 14;
    for (const sideI of [0, 1]) {
      for (let i = 0; i < N; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(this.unitBox, this.dres[0].mats[0]);
        const sign = new THREE.Mesh(this.planeV, this.dres[0].signs[0].v);
        const bill = new THREE.Mesh(this.planeV, this.dres[0].signs[0].h);
        const s1 = new THREE.Mesh(this.stripGeo, neonMat('#ffffff'));
        const s2 = new THREE.Mesh(this.stripGeo, neonMat('#ffffff'));
        const top = new THREE.Mesh(this.stripGeo, neonMat('#ffffff'));
        g.add(body, sign, bill, s1, s2, top);
        const b = { g, body, sign, bill, s1, s2, top, side: sideI ? 1 : -1, s: 0, len: 10 };
        this.root.add(g);
        this.placeBuilding(b);
        this.buildings.push(b);
      }
    }
  }

  inTunnel(s, pad = 0) { return this.tunnels.some(t => s > t.s0 - pad && s < t.s1 + pad); }

  placeBuilding(b) {
    const si = b.side < 0 ? 0 : 1;
    const r = Math.random;
    let s = this.nextB[si];
    const len = 7 + r() * 11;
    b.s = s + len / 2; b.len = len;
    this.nextB[si] = s + len + 0.6 + r() * 2.5;
    const di = districtAt(b.s), D = DISTRICTS[di], res = this.dres[di];
    const hidden = this.inTunnel(b.s, 12);
    b.g.visible = !hidden;
    const h = (di === 1 ? 10 : 14) + Math.pow(r(), 1.6) * (di === 3 ? 70 : 50);
    const depth = 10 + r() * 8;
    const inner = ROAD_HALF + 6.2 + r() * 1.5;
    b.body.material = res.mats[Math.floor(r() * 3)];
    b.body.scale.set(depth, h, len);
    const cx = b.side * (inner + depth / 2);
    b.g.position.set(cx, 0, 0);
    b.body.position.set(0, 0, 0);
    const faceX = -b.side * depth / 2; // road-facing face (local)
    // blade sign
    const sg = res.signs[Math.floor(r() * res.signs.length)];
    b.sign.visible = r() < 0.75;
    b.sign.material = sg.v;
    const sh = 3 + r() * 4;
    b.sign.scale.set(sh / 4, sh, 1);
    b.sign.position.set(faceX - b.side * 0.8, 3.5 + r() * Math.max(0, h - 10) * 0.4 + sh / 2, len * (r() - 0.5) * 0.6);
    b.sign.rotation.y = 0;
    // billboard on facade facing road, angled toward camera
    const bg = res.signs[Math.floor(r() * res.signs.length)];
    b.bill.visible = r() < 0.5;
    b.bill.material = bg.h;
    const bw = Math.min(len * 0.8, 7);
    b.bill.scale.set(bw, bw * 0.31, 1);
    b.bill.position.set(faceX - b.side * 0.06, Math.min(h - 3, 6 + r() * 10), 0);
    b.bill.rotation.y = -b.side * Math.PI / 2 + b.side * 0.0;
    // neon edges
    const ncol = D.neon[Math.floor(r() * D.neon.length)];
    const nm = neonMat(ncol, 2.2);
    b.s1.material = nm; b.s2.material = nm; b.top.material = nm;
    const edges = r() < 0.7;
    b.s1.visible = b.s2.visible = edges;
    b.s1.scale.set(1, h, 1); b.s2.scale.set(1, h, 1);
    b.s1.position.set(faceX, 0, len / 2); b.s2.position.set(faceX, 0, -len / 2);
    b.top.visible = r() < 0.6;
    b.top.scale.set(1, len, 1); b.top.rotation.x = Math.PI / 2; b.top.position.set(faceX, h, -len / 2);
  }

  // ---------- street lamps ----------
  buildLamps() {
    this.lamps = [];
    const N = 6;
    const poleM = R.mat.steel;
    const coneGeo = new THREE.ConeGeometry(2.2, 6.6, 16, 1, true); coneGeo.translate(0, -3.3, 0);
    this.coneMat = new THREE.MeshBasicMaterial({ map: R.beamTex, color: 0xffd0a0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.lampHead = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.5, 1.0) });
    for (const side of [-1, 1]) for (let i = 0; i < N; i++) {
      const g = new THREE.Group();
      if (!this.lampGeo) this.lampGeo = {};
      if (!this.lampGeo[side]) {
        // merge pole + arm + base into a single draw call
        const parts = [];
        const p1 = new THREE.CylinderGeometry(0.08, 0.12, 7.2, 8).toNonIndexed(); p1.translate(0, 3.6, 0); parts.push(p1);
        const p2 = new THREE.BoxGeometry(1.8, 0.1, 0.12).toNonIndexed(); p2.translate(-side * 0.9, 7.1, 0); parts.push(p2);
        const p3 = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8).toNonIndexed(); p3.translate(0, 0.25, 0); parts.push(p3);
        this.lampGeo[side] = mergeGeometries(parts);
      }
      const pole = new THREE.Mesh(this.lampGeo[side], poleM);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.35), this.lampHead); head.position.set(-side * 1.7, 7.0, 0);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glowTex, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      glow.position.copy(head.position); glow.scale.set(3.5, 2.2, 1);
      const cone = new THREE.Mesh(coneGeo, this.coneMat); cone.position.set(-side * 1.7, 6.95, 0);
      const ring = null;
      g.add(pole, head, glow, cone);
      g.position.x = side * (ROAD_HALF + 0.9);
      const lamp = { g, side, s: i * 30 + (side > 0 ? 15 : 0), ring, cone, head, glow };
      this.root.add(g); this.lamps.push(lamp);
    }
    this.lampSpacing = 30 * N / N; // spacing per side
    this.lampN = N;
  }

  // ---------- tunnels ----------
  buildTunnelPool() {
    const wallM = new THREE.MeshStandardMaterial({ color: 0x1e1a2a, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.5 });
    this.tunnelStrip = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) });
    this.tunnelRings = [];
    const SEG = 12;
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, SEG), wallM); w.position.set(side * 7.8, 3.5, 0); g.add(w);
        const lightBand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, SEG * 0.9), this.tunnelStrip); lightBand.position.set(side * 7.48, 2.2, 0); g.add(lightBand);
        const lb2 = lightBand.clone(); lb2.position.y = 4.4; g.add(lb2);
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 2), neonMat('#ffffff', 0.25)); tile.position.set(side * 7.47, 3.3, -3); g.add(tile);
      }
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, SEG), wallM); ceil.position.set(0, 7.2, 0); g.add(ceil);
      for (const x of [-2.2, 2.2]) {
        const cl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, SEG * 0.55), this.tunnelStrip); cl.position.set(x, 6.85, 0); g.add(cl);
      }
      g.visible = false; this.root.add(g);
      this.tunnelRings.push({ g, s: -1e9 });
    }
    // portal
    const pg = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 2, 1.2), R.mat.concrete); frame.position.y = 8.3; pg.add(frame);
    for (const side of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9.3, 1.2), R.mat.concrete); col.position.set(side * 8.2, 4.65, 0); pg.add(col); }
    this.portalNeon = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const n1 = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.14, 0.1), this.portalNeon); n1.position.set(0, 7.25, 0.62); pg.add(n1);
    for (const side of [-1, 1]) { const n = new THREE.Mesh(new THREE.BoxGeometry(0.14, 7.2, 0.1), this.portalNeon); n.position.set(side * 7.5, 3.6, 0.62); pg.add(n); }
    const signM = new THREE.MeshBasicMaterial({ map: signTexture('UNDERPASS', '#22e6ff', { w: 512, h: 96 }), color: new THREE.Color(1.6, 1.6, 1.6) });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), signM); sign.position.set(0, 8.4, 0.62); pg.add(sign);
    this.portalSignM = signM;
    pg.visible = false; this.root.add(pg);
    this.portal = { g: pg, s: -1e9 };
    this.portalExit = { g: pg.clone(), s: -1e9 }; this.portalExit.g.visible = false; this.root.add(this.portalExit.g);
    this.portalExit.g.rotation.y = Math.PI;
  }

  // ---------- overpasses ----------
  buildOverpassPool() {
    this.overpassPool = [];
    const deckM = R.mat.concrete;
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 1.4, 7), deckM); deck.position.y = 8.6; g.add(deck);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 0.2), R.mat.steel); rail.position.set(0, 9.7, 3.4); g.add(rail);
      const neon = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.08), neonMat('#ffffff')); neon.position.set(0, 7.95, 3.55); g.add(neon);
      const neon2 = neon.clone(); neon2.position.y = 9.25; g.add(neon2);
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.6), deckM); p.position.set(side * 5.4, 4, 0); g.add(p);
        const ps = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7, 0.1), neonMat('#ffffff')); ps.position.set(side * 5.4 - side * 0.62, 4, 0.82); g.add(ps);
      }
      const bill = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), this.dres[0].signs[0].h); bill.position.set(0, 8.6, 3.53); g.add(bill);
      // elevated train (shown sometimes)
      const train = new THREE.Group();
      const carM = new THREE.MeshStandardMaterial({ color: 0xbfc6d6, metalness: 0.8, roughness: 0.3 });
      for (let c = 0; c < 4; c++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 2.8), carM); car.position.x = c * 11.6; train.add(car);
        const win = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 2.85), R.mat.windowLit); win.position.set(c * 11.6, 0.3, 0); train.add(win);
        const st = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 2.86), neonMat('#ff2bd6', 2.6)); st.position.set(c * 11.6, -0.5, 0); train.add(st);
      }
      train.position.set(-60, 10.9, 0); g.add(train);
      g.visible = false; this.root.add(g);
      this.overpassPool.push({ g, s: -1e9, neon: [neon, neon2], bill, train, trainOn: false, trainX: -60, ps: g.children.filter(c => c.geometry && c.geometry.parameters && c.geometry.parameters.height === 7) });
    }
    this.nextOverpass = 260;
  }

  // ---------- rail crossing decor ----------
  buildRail() {
    this.rails = [];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      for (const z of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 0.12), R.mat.chrome); r.position.set(0, 0.06, z); g.add(r); }
      for (let k = -6; k <= 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 2.6), R.mat.dark); t.position.set(k * 1.2, 0.025, 0); g.add(t); }
      const lamps = [];
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), R.mat.steel); pole.position.set(side * (ROAD_HALF + 0.8), 2, 1.6); g.add(pole);
        const xb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.05), R.mat.stripeR); xb.position.set(side * (ROAD_HALF + 0.8), 3.6, 1.65); xb.rotation.z = 0.6; g.add(xb);
        const xb2 = xb.clone(); xb2.rotation.z = -0.6; g.add(xb2);
        for (const dx of [-0.3, 0.3]) {
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), R.mat.redLamp.clone()); l.position.set(side * (ROAD_HALF + 0.8) + dx, 2.8, 1.75); g.add(l);
          const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glowTex, color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          gl.position.copy(l.position); gl.scale.setScalar(1.8); g.add(gl);
          lamps.push({ l, gl, phase: dx > 0 ? 1 : 0 });
        }
      }
      g.visible = false; this.root.add(g);
      this.rails.push({ g, s: -1e9, lamps });
    }
  }
  addRailCrossing(s) {
    const r = this.rails.find(x => !x.g.visible) || this.rails[0];
    r.s = s; r.g.visible = true;
  }

  // ---------- rain + speed lines ----------
  buildRain() {
    const N = this.quality.low ? 450 : 800;
    const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random(), d = Math.random();
      for (let k = 0; k < 2; k++) { seed.set([a, b, c, k], (i * 2 + k) * 4); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.rainU = { uTime: { value: 0 }, uSpeed: { value: 20 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.6, 0.7, 1.0) }, uAlpha: { value: 1 } };
    this.rain = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms: this.rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uSpeed; uniform vec3 uCam; varying float vA;
        void main(){
          vec3 p;
          p.x = uCam.x + (seed.x - 0.5) * 36.0;
          p.z = uCam.z - 4.0 - seed.z * 60.0;
          float fall = 22.0;
          p.y = mod(seed.y * 24.0 - uTime * fall, 24.0) - 2.0;
          vec3 vel = vec3(-1.5, -fall, uSpeed);
          p -= vel * 0.03 * seed.w;
          vA = (1.0 - seed.w*0.85) * smoothstep(-2.0, 0.5, p.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA * 0.33 * uAlpha, 1.0); }`,
    }));
    this.rain.frustumCulled = false; this.root.add(this.rain);

    // speed lines
    const M = 70;
    const sp = new Float32Array(M * 2 * 3), ss = new Float32Array(M * 2 * 4);
    for (let i = 0; i < M; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 2.6 + Math.random() * 4;
      for (let k = 0; k < 2; k++) ss.set([Math.cos(ang) * rad, Math.sin(ang) * rad * 1.3, Math.random(), k], (i * 2 + k) * 4);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g2.setAttribute('seed', new THREE.BufferAttribute(ss, 4));
    this.speedU = { uTime: { value: 0 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) } };
    this.speedLines = new THREE.LineSegments(g2, new THREE.ShaderMaterial({
      uniforms: this.speedU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uAmt; varying float vA;
        void main(){
          float z = -mod(seed.z * 40.0 - uTime * 60.0, 40.0) - 1.0;
          vec3 p = vec3(seed.x, seed.y, z + seed.w * (2.0 + uAmt*4.0));
          vA = uAmt * (1.0 - seed.w) * smoothstep(-40.0, -25.0, z);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol*vA*0.8, 1.0); }`,
    }));
    this.speedLines.frustumCulled = false; this.speedLines.renderOrder = 50;
  }

  // ---------- district transitions ----------
  applyDistrictInstant(i) {
    this.dIndex = i;
    const D = DISTRICTS[i];
    this.fogCol.set(D.fog);
    this.target = this.makeTarget(i);
    this.cur = { fog: this.target.fog.clone(), top: this.target.top.clone(), mid: this.target.mid.clone(), haze: this.target.haze.clone(), curb: this.target.curb.clone(), a: this.target.a.clone(), b: this.target.b.clone() };
    this.skylineMat.map = this.dres[i].sky;
  }
  makeTarget(i) {
    const D = DISTRICTS[i];
    return {
      fog: new THREE.Color(D.fog), top: new THREE.Color(D.sky[0]), mid: new THREE.Color(D.sky[1]), haze: new THREE.Color(D.sky[2]),
      curb: new THREE.Color(D.curb).multiplyScalar(2.2), a: new THREE.Color(D.neon[0]), b: new THREE.Color(D.neon[1]),
    };
  }
  setDistrict(i) {
    if (i === this.dIndex) return false;
    this.dIndex = i; this.target = this.makeTarget(i);
    this.skylineMat.map = this.dres[i].sky; this.skylineMat.needsUpdate = true;
    return true;
  }

  reset(start = 0) {
    this.tunnels = [];
    this.nextB = [start - 20, start - 20];
    for (const b of this.buildings) this.placeBuilding(b);
    this.lamps.forEach((l, i) => { l.s = start + (i % this.lampN) * 30 + (l.side > 0 ? 15 : 0); });
    this.tunnelRings.forEach(t => { t.g.visible = false; t.s = -1e9; });
    this.portal.g.visible = false; this.portalExit.g.visible = false;
    this.overpassPool.forEach(o => { o.g.visible = false; o.s = -1e9; });
    this.rails.forEach(r => { r.g.visible = false; });
    this.nextOverpass = start + 220;
    this.nextTunnel = start + 520;
    this.applyDistrictInstant(districtAt(start));
  }

  // Schedule set pieces ahead of the player
  scheduleAhead(dist) {
    const ahead = dist + 230;
    if (this.nextTunnel < ahead) {
      const s0 = this.nextTunnel, s1 = s0 + 130 + Math.random() * 60;
      this.tunnels.push({ s0, s1 });
      this.portal.s = s0; this.portal.g.visible = true;
      this.portalExit.s = s1; this.portalExit.g.visible = true;
      this.nextTunnel = s1 + 650 + Math.random() * 400;
      // keep overpasses away from tunnel
      if (this.nextOverpass > s0 - 40 && this.nextOverpass < s1 + 40) this.nextOverpass = s1 + 60;
    }
    if (this.nextOverpass < ahead) {
      const s = this.nextOverpass;
      if (!this.inTunnel(s, 30)) {
        const o = this.overpassPool.find(x => !x.g.visible);
        if (o) {
          o.s = s; o.g.visible = true;
          const D = DISTRICTS[districtAt(s)];
          const col = D.neon[Math.floor(Math.random() * D.neon.length)];
          o.neon.forEach(n => n.material = neonMat(col, 2.4));
          o.ps.forEach(n => n.material = neonMat(col, 2.4));
          const res = this.dres[districtAt(s)];
          o.bill.material = res.signs[Math.floor(Math.random() * res.signs.length)].h;
          o.trainOn = Math.random() < 0.6; o.trainX = -70 - Math.random() * 30; o.train.visible = o.trainOn;
        }
      }
      this.nextOverpass = s + 170 + Math.random() * 160;
    }
    this.tunnels = this.tunnels.filter(t => t.s1 > dist - 40);
  }

  // Collect light sources for the road shader
  pushLight(x, y, z, r, g, b, radius = 0.12) { if (this.lightsList.length < 40) this.lightsList.push({ x, y, z, r, g, b, radius }); }

  update(dt, dist, speed, camera, extraLights) {
    this.time += dt;
    const t = this.time;
    // smooth palette transitions
    const k = 1 - Math.exp(-dt * 1.2);
    for (const key of ['fog', 'top', 'mid', 'haze', 'curb', 'a', 'b']) this.cur[key].lerp(this.target[key], k);
    const tun = this.inTunnel(dist, 0) ? 1 : 0;
    this.tunnelAmt = (this.tunnelAmt || 0) + (tun - (this.tunnelAmt || 0)) * Math.min(1, dt * 4);
    const fog = this.scene.fog;
    fog.color.copy(this.cur.fog).lerp(new THREE.Color(0x0a0810), this.tunnelAmt * 0.6);
    fog.near = 18 - this.tunnelAmt * 6; fog.far = 150 - this.tunnelAmt * 40;
    this.skyMat.uniforms.uTop.value.copy(this.cur.top);
    this.skyMat.uniforms.uMid.value.copy(this.cur.mid);
    this.skyMat.uniforms.uHaze.value.copy(this.cur.haze);
    this.skyMat.uniforms.uTime.value = t;
    this.curbs.forEach(c => c.material.color.copy(this.cur.curb));
    this.roadU.uCurb.value.copy(this.cur.curb).multiplyScalar(0.35);
    this.roadU.uNeonA.value.copy(this.cur.a); this.roadU.uNeonB.value.copy(this.cur.b);
    this.roadU.uDist.value = dist; this.roadU.uTime.value = t;
    this.roadU.uTunnel.value = this.tunnelAmt;
    this.tile.offset.y = (dist / (260 / 70)) % 1;
    this.sky.position.set(camera.position.x, 0, camera.position.z);
    this.skyline.position.x = camera.position.x; this.skyline.position.z = camera.position.z;
    this.skyline.rotation.y = dist * 0.00008;
    this.skylineMat.opacity = 1 - this.tunnelAmt;

    this.lightsList.length = 0;
    // buildings recycle
    for (const b of this.buildings) {
      const z = dist - b.s;
      if (z - b.len / 2 > 12) this.placeBuilding(b);
      b.g.position.z = dist - b.s;
    }
    // lamps
    const span = this.lampN * 30;
    for (const l of this.lamps) {
      if (dist - l.s > 12) l.s += span;
      l.g.position.z = dist - l.s;
      const hidden = this.inTunnel(l.s, 4);
      l.g.visible = !hidden;
      l.cone.visible = l.g.position.z < -14;
      l.head.visible = l.glow.visible = l.g.position.z < -2;
      if (!hidden && dist - l.s < 8) this.pushLight(l.g.position.x - l.side * 1.7, 7, l.g.position.z, 1.0, 0.62, 0.32, 0.05);
    }
    // tunnel rings
    const SEG = 12;
    let ri = 0;
    for (const tn of this.tunnels) {
      const startK = Math.max(0, Math.floor((dist - 14 - tn.s0) / SEG));
      for (let kk = startK; tn.s0 + kk * SEG + SEG / 2 < tn.s1 && tn.s0 + kk * SEG < dist + 175 && ri < this.tunnelRings.length; kk++) {
        const ring = this.tunnelRings[ri++];
        ring.s = tn.s0 + kk * SEG + SEG / 2; ring.g.visible = true; ring.g.position.z = dist - ring.s;
        if (kk % 2 === 0 && dist - ring.s < 8) this.pushLight(0, 6.8, ring.g.position.z, 0.5, 0.75, 1.0, 0.04);
      }
    }
    for (; ri < this.tunnelRings.length; ri++) this.tunnelRings[ri].g.visible = false;
    const pd = DISTRICTS[this.dIndex];
    this.tunnelStrip.color.set(pd.neon[1]).multiplyScalar(2.2);
    this.portalNeon.color.set(pd.neon[0]).multiplyScalar(2.6);
    for (const p of [this.portal, this.portalExit]) {
      if (p.g.visible) { p.g.position.z = dist - p.s; if (dist - p.s > 30) p.g.visible = false; }
    }
    // overpasses
    for (const o of this.overpassPool) {
      if (!o.g.visible) continue;
      o.g.position.z = dist - o.s;
      if (dist - o.s > 30) { o.g.visible = false; continue; }
      if (o.trainOn) { o.trainX += dt * 26; o.train.position.x = o.trainX; if (o.trainX > 80) o.trainX = -120; }
    }
    // rail crossings
    for (const r of this.rails) {
      if (!r.g.visible) continue;
      r.g.position.z = dist - r.s;
      if (dist - r.s > 30) { r.g.visible = false; continue; }
      const ph = Math.floor(t * 3) % 2;
      for (const lp of r.lamps) {
        const on = ph === lp.phase;
        lp.gl.visible = on; lp.l.material.color.setRGB(on ? 3.5 : 0.25, on ? 0.1 : 0.02, on ? 0.12 : 0.02);
      }
      if (dist - r.s < 8 && dist - r.s > -90) this.pushLight(0, 2.8, r.g.position.z + 1.7, 0.9 * ph, 0.05, 0.05, 0.08);
    }
    // extra lights (cars, player, pickups)
    for (const L of extraLights) this.pushLight(L.x, L.y, L.z, L.r, L.g, L.b, L.radius);
    this.uploadLights(camera);

    // rain & speed lines
    this.rainU.uTime.value = t; this.rainU.uSpeed.value = speed;
    this.rainU.uAlpha.value = 1 - this.tunnelAmt;
    this.rain.visible = this.tunnelAmt < 0.98;
    this.rainU.uCam.value.copy(camera.position);
  }

  uploadLights(camera) {
    const list = this.lightsList;
    list.sort((a, b) => Math.abs(a.z + 25) - Math.abs(b.z + 25));
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const U = this.roadU;
    for (let i = 0; i < MAX_L; i++) {
      const L = list[i];
      if (!L) { U.uL.value[i].set(0, 999, 0, 1); U.uRP.value[i].set(0, 999, 1, 1); U.uLC.value[i].set(0, 0, 0); continue; }
      U.uL.value[i].set(L.x, L.z, L.y, L.radius);
      // mirror point on the wet road (camera -> mirrored light)
      const tt = cy / (cy + L.y);
      const px = cx + (L.x - cx) * tt, pz = cz + (L.z - cz) * tt;
      const distC = Math.max(4, Math.hypot(px - cx, pz - cz));
      U.uRP.value[i].set(px, pz, 6.0, 0.9 / (distC * 0.6 + L.y * 2.5));
      U.uLC.value[i].set(L.r, L.g, L.b);
    }
  }
}
