'use strict';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const paletteCache = new Map();
function rgb(hex) {
  if (!paletteCache.has(hex)) {
    const n = Number.parseInt(hex.replace('#', ''), 16);
    paletteCache.set(hex, [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
  }
  return paletteCache.get(hex);
}

function matrix(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const a = Math.cos(rx), b = Math.sin(rx);
  const c = Math.cos(ry), d = Math.sin(ry);
  const e = Math.cos(rz), f = Math.sin(rz);
  return [
    c * e * sx, c * f * sx, -d * sx, x,
    (e * d * b - f * a) * sy, (f * d * b + e * a) * sy, c * b * sy, y,
    (e * d * a + f * b) * sz, (f * d * a - e * b) * sz, c * a * sz, z
  ];
}

function transform(parent, local, start = 0) {
  const out = new Array(12);
  for (let i = 0; i < 12; i += 4) {
    const x = local[start + i], y = local[start + i + 1], z = local[start + i + 2];
    out[i] = parent[0] * x + parent[4] * y + parent[8] * z;
    out[i + 1] = parent[1] * x + parent[5] * y + parent[9] * z;
    out[i + 2] = parent[2] * x + parent[6] * y + parent[10] * z;
  }
  for (let i = 0; i < 3; i++) {
    out[i * 4 + 3] = parent[i] * local[start + 3] + parent[i + 4] * local[start + 7] +
      parent[i + 8] * local[start + 11] + parent[i * 4 + 3];
  }
  return out;
}

class Batch {
  constructor() { this.parts = {}; }
  add(kind, m, color, light = 0) {
    const buffer = this.parts[kind] ||= [];
    buffer.push(...m, ...(typeof color === 'string' ? rgb(color) : color), light);
  }
  shape(kind, x, y, z, w, h, d, color, light = 0, rx = 0, ry = 0, rz = 0) {
    this.add(kind, matrix(x, y, z, w, h, d, rx, ry, rz), color, light);
  }
}

const vec = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const len = Math.hypot(...a); return a.map((v) => v / len); };

function geometry(kind) {
  const out = [];
  function triangle(a, b, c, uv = [[0, 0], [1, 0], [1, 1]]) {
    const normal = unit(cross(vec(b, a), vec(c, a)));
    [a, b, c].forEach((p, i) => out.push(...p, ...normal, ...uv[i]));
  }
  function quad(a, b, c, d) {
    triangle(a, b, c);
    triangle(a, c, d, [[0, 0], [1, 1], [0, 1]]);
  }
  const a = [-.5, -.5, .5], b = [.5, -.5, .5], c = [.5, .5, .5], d = [-.5, .5, .5];
  if (kind === 'plane') {
    quad(a.map((v, i) => i === 2 ? 0 : v), b.map((v, i) => i === 2 ? 0 : v),
      c.map((v, i) => i === 2 ? 0 : v), d.map((v, i) => i === 2 ? 0 : v));
  } else if (kind === 'box') {
    const e = [-.5, -.5, -.5], f = [.5, -.5, -.5], g = [.5, .5, -.5], h = [-.5, .5, -.5];
    quad(a, b, c, d); quad(f, e, h, g); quad(b, f, g, c);
    quad(e, a, d, h); quad(d, c, g, h); quad(e, f, b, a);
  } else if (kind === 'gem') {
    const top = [0, .5, 0], bottom = [0, -.5, 0];
    const edge = [[.5, 0, 0], [0, 0, -.5], [-.5, 0, 0], [0, 0, .5]];
    edge.forEach((p, i) => {
      const next = edge[(i + 1) % 4];
      triangle(top, p, next); triangle(bottom, next, p);
    });
  } else {
    const segments = kind === 'cone' ? 8 : 10;
    const radius = kind === 'cone' ? .16 : .5;
    for (let i = 0; i < segments; i++) {
      const t = i * TAU / segments, n = (i + 1) * TAU / segments;
      const p = (angle, r, y) => [Math.cos(angle) * r, y, Math.sin(angle) * r];
      const low = p(t, .5, -.5), nextLow = p(n, .5, -.5);
      const high = p(t, radius, .5), nextHigh = p(n, radius, .5);
      quad(nextLow, low, high, nextHigh);
      triangle([0, .5, 0], nextHigh, high);
      triangle([0, -.5, 0], low, nextLow);
    }
  }
  return new Float32Array(out);
}

const CITY_SIGNS = ['N E O N', '夜', 'KIOSK', 'RAMEN', '24 / 7', 'PARK', 'QUAY', 'METRO',
  'EAST', 'HWY 04', 'TUNNEL', 'RAIL', 'L A N E', 'CARGO', 'TAXI', '→ GAP', '↓ DUCK', '↑ JUMP'];

const meshVert = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 ax;
layout(location=4) in vec4 ay;
layout(location=5) in vec4 az;
layout(location=6) in vec4 tint;
uniform mat4 vp;
uniform vec3 eye;
uniform float offset;
out vec3 wPos, normal;
out vec2 uv;
out vec4 color;
out float dist;
void main() {
  mat3 basis=mat3(ax.xyz,ay.xyz,az.xyz);
  wPos=basis*aPos+vec3(ax.w,ay.w,az.w+offset);
  normal=normalize(basis*(aNormal/max(vec3(.00001),vec3(dot(ax.xyz,ax.xyz),dot(ay.xyz,ay.xyz),dot(az.xyz,az.xyz)))));
  uv=aUV; color=tint; dist=length(wPos-eye);
  gl_Position=vp*vec4(wPos,1.);
}`;

const meshFrag = `#version 300 es
precision highp float;
in vec3 wPos, normal;
in vec2 uv;
in vec4 color;
in float dist;
uniform vec3 fog;
uniform float travel;
uniform int mode;
uniform sampler2D atlas;
out vec4 pixel;
float hash(vec2 p) { return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
void main() {
  float mist=1.-exp(-pow(dist*.016,1.42));
  vec3 c=color.rgb;
  if(mode==1) {
    vec2 g=uv*2.-1.;
    float light=exp(-dot(g,g)*4.8)*(1.-smoothstep(.72,1.,length(g)));
    light*= .86 + .14*sin(wPos.x*23.+sin(wPos.z*3.));
    pixel=vec4(c*light*color.a*(1.-mist),1.);
    return;
  }
  if(mode==5) {
    float rings=length(uv*2.-1.);
    float shadow=pow(max(0.,1.-rings),1.8)*color.a;
    pixel=vec4(c,shadow);
    return;
  }
  if(mode==2) {
    float index=color.a;
    vec2 cell=vec2(mod(index,4.),floor(index/4.));
    float ink=texture(atlas,(cell+vec2(uv.x,1.-uv.y))/vec2(4.,5.)).a;
    if(ink<.05) discard;
    c=color.rgb*(.68+.47*ink);
  } else if(mode==3) {
    vec2 p=vec2(wPos.x,wPos.z-travel);
    float grit=hash(floor(p*vec2(130.,66.)));
    float puddle=smoothstep(.27,.82,.5+.24*sin(p.x*2.+sin(p.y*.37))+.17*cos(p.y*.8+p.x*4.));
    c=mix(vec3(.037,.047,.084),vec3(.105,.132,.224),puddle*(.4+.6*smoothstep(1.,27.,dist)));
    c+=grit*.022;
    float edge=abs(p.x);
    float marks=1.-smoothstep(.027,.054,abs(edge-1.29));
    float dash=smoothstep(.1,.16,fract(p.y/6.4))*(1.-smoothstep(.55,.62,fract(p.y/6.4)));
    c=mix(c,vec3(.50,.64,.73),marks*dash*.68);
    float gutter=1.-smoothstep(.028,.065,abs(edge-4.04));
    c=mix(c,vec3(.40,.48,.61),gutter*.64);
    float streak=pow(max(0.,cos(p.x*16.+sin(p.y*.38))),13.);
    c+=streak*puddle*.034;
  } else {
    vec3 n=normalize(normal);
    float key=max(0.,dot(n,normalize(vec3(-.45,.74,.50))));
    float rim=max(0.,dot(n,normalize(vec3(.72,.2,-.40))));
    c=c*(.48+key*.47+rim*.12)+vec3(.016,.021,.037)*(key+.45);
    c+=color.rgb*color.a;
  }
  vec3 haze=fog+vec3(.027,.01,.026)*clamp(1.-abs(wPos.y)*.045,0.,1.);
  pixel=vec4(mix(c,haze,mist),1.);
}`;

const screenVert = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  uv=p;
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;

const skyFrag = `#version 300 es
precision highp float;
in vec2 uv;
uniform vec3 fog;
uniform float aspect, horizon;
out vec4 pixel;
float hash(vec2 p){return fract(sin(dot(p,vec2(191.7,73.21)))*43758.5453);}
void main(){
  vec2 p=uv;
  float height=(p.y-horizon);
  vec3 c=mix(fog+vec3(.07,.033,.07),vec3(.026,.033,.082),smoothstep(0.,.42,height));
  c+=vec3(.12,.018,.10)*exp(-abs(height-.018)*9.)*exp(-abs(p.x-.52)*2.2);
  vec2 q=vec2((p.x-.68)*aspect,p.y-(horizon+.18));
  float r=length(q);
  float moon=1.-smoothstep(.028,.029,r);
  c+=vec3(.51,.36,.59)*exp(-r*19.)*.4;
  c=mix(c,vec3(.93,.74,.81),moon*(.86+.12*sin(p.y*670.)));
  vec2 star=p*vec2(180.,240.);
  c+=.25*step(.995,hash(floor(star)))*(1.-smoothstep(.05,.27,length(fract(star)-.5)))*smoothstep(.07,.4,height);
  pixel=vec4(c,1.);
}`;

const blurFrag = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D image;
uniform vec2 stepUV;
uniform bool extract;
out vec4 pixel;
vec3 sampleColor(vec2 p){
  vec3 c=texture(image,p).rgb;
  return extract?c*smoothstep(.56,.96,max(c.r,max(c.g,c.b))):c;
}
void main(){
  vec3 c=sampleColor(uv)*.28;
  c+=(sampleColor(uv+stepUV*1.4)+sampleColor(uv-stepUV*1.4))*.23;
  c+=(sampleColor(uv+stepUV*3.1)+sampleColor(uv-stepUV*3.1))*.13;
  pixel=vec4(c,1.);
}`;

const compositeFrag = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D image, glow;
out vec4 pixel;
void main(){
  vec3 c=texture(image,uv).rgb+texture(glow,uv).rgb*.56;
  float vignette=length((uv-.5)*vec2(.96,.74));
  c*=1.-smoothstep(.2,.72,vignette)*.31;
  pixel=vec4(c,1.);
}`;

class NeonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: true, powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL 2 unavailable');
    this.mesh = this.program(meshVert, meshFrag, 'vp eye offset travel fog mode atlas');
    this.sky = this.program(screenVert, skyFrag, 'fog aspect horizon');
    this.blur = this.program(screenVert, blurFrag, 'image stepUV extract');
    this.composite = this.program(screenVert, compositeFrag, 'image glow');
    this.blank = gl.createVertexArray();
    this.geometry = {};
    this.modes = { box: 0, cyl: 0, cone: 0, gem: 0, panel: 0, glow: 1, sign: 2, road: 3, shadow: 5 };
    const planes = new Set(['panel', 'glow', 'sign', 'road', 'shadow']);
    for (const kind of ['box', 'cyl', 'cone', 'gem', 'plane']) {
      const vertices = geometry(kind);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      this.geometry[kind] = { buffer, count: vertices.length / 8 };
    }
    this.dynamic = {};
    for (const kind of Object.keys(this.modes)) {
      const data = this.geometry[planes.has(kind) ? 'plane' : kind];
      this.dynamic[kind] = this.instance(data);
    }
    this.atlas = this.createAtlas();
    this.targets = [];
    this.quality = Math.min(devicePixelRatio || 1, 1.42);
    this.resize();
  }

  program(sourceV, sourceF, names) {
    const gl = this.gl;
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, sourceV], [gl.FRAGMENT_SHADER, sourceF]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    names.split(' ').forEach((name) => { uniforms[name] = gl.getUniformLocation(program, name); });
    return { program, ...uniforms };
  }

  createAtlas() {
    const gl = this.gl;
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    CITY_SIGNS.forEach((text, i) => {
      ctx.font = '900 78px system-ui';
      ctx.fillText(text, (i % 4 + .5) * 256, (Math.floor(i / 4) + .53) * 128, 225);
    });
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  instance(geometryData) {
    const gl = this.gl;
    const vao = gl.createVertexArray(), buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometryData.buffer);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, i === 2 ? 2 : 3, gl.FLOAT, false, 32, [0, 12, 24][i]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (let i = 3; i < 7; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 64, (i - 3) * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
    return { vao, buffer, geometryData, count: 0 };
  }

  upload(instance, data, usage) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, instance.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
    instance.count = data.length / 16;
  }

  bake(batch) {
    const parts = {};
    for (const [kind, data] of Object.entries(batch.parts)) {
      parts[kind] = this.instance(this.dynamic[kind].geometryData);
      this.upload(parts[kind], data, this.gl.STATIC_DRAW);
    }
    return parts;
  }

  release(parts) {
    for (const part of Object.values(parts)) {
      this.gl.deleteVertexArray(part.vao);
      this.gl.deleteBuffer(part.buffer);
    }
  }

  target(w, h, useDepth) {
    const gl = this.gl, buffer = gl.createFramebuffer(), texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    let depth;
    if (useDepth) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    return { w, h, buffer, texture, depth };
  }

  resize() {
    const gl = this.gl;
    const w = Math.max(2, Math.round(this.canvas.clientWidth * this.quality));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * this.quality));
    if (this.canvas.width === w && this.canvas.height === h && this.targets.length) return;
    this.canvas.width = w; this.canvas.height = h;
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.buffer); gl.deleteTexture(t.texture);
      if (t.depth) gl.deleteRenderbuffer(t.depth);
    }
    this.targets = [this.target(w, h, true), this.target(Math.ceil(w / 4), Math.ceil(h / 4)),
      this.target(Math.ceil(w / 4), Math.ceil(h / 4))];
  }

  camera(eye, target, fov) {
    const aspect = this.canvas.width / this.canvas.height;
    const z = unit(vec(eye, target)), x = unit(cross([0, 1, 0], z)), y = cross(z, x);
    const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
    const f = 1 / Math.tan(fov / 2), near = .33, far = 185;
    const vp = new Float32Array(16);
    for (let i = 0; i < 16; i += 4) {
      vp[i] = view[i] * f / aspect;
      vp[i + 1] = view[i + 1] * f;
      vp[i + 2] = (far + near) / (near - far) * view[i + 2] + 2 * far * near / (near - far) * view[i + 3];
      vp[i + 3] = -view[i + 2];
    }
    return vp;
  }

  draw(batch, blocks, camera, travel, fog) {
    const gl = this.gl;
    const [base, blur1, blur2] = this.targets;
    const bind = (target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.buffer || null);
      gl.viewport(0, 0, target?.w || base.w, target?.h || base.h);
    };
    const use = (p) => gl.useProgram(p.program);
    const tex = (id, texture) => { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); };
    const screen = () => { gl.bindVertexArray(this.blank); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    bind(base);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    use(this.sky);
    gl.uniform3fv(this.sky.fog, fog);
    gl.uniform1f(this.sky.aspect, base.w / base.h);
    gl.uniform1f(this.sky.horizon, .5 + (camera.eye[1] - camera.target[1]) / (camera.eye[2] - camera.target[2]) / (2 * Math.tan(camera.fov / 2)));
    screen();

    gl.enable(gl.DEPTH_TEST);
    const mesh = this.mesh;
    use(mesh);
    gl.uniformMatrix4fv(mesh.vp, false, this.camera(camera.eye, camera.target, camera.fov));
    gl.uniform3fv(mesh.eye, camera.eye);
    gl.uniform3fv(mesh.fog, fog);
    gl.uniform1f(mesh.travel, travel);
    tex(0, this.atlas);
    gl.uniform1i(mesh.atlas, 0);
    for (const [kind, part] of Object.entries(this.dynamic)) {
      part.count = 0;
      if (batch.parts[kind]?.length) this.upload(part, batch.parts[kind], gl.DYNAMIC_DRAW);
    }
    const drawKind = (kind) => {
      gl.uniform1i(mesh.mode, this.modes[kind]);
      const drawPart = (part, offset) => {
        if (!part?.count) return;
        gl.uniform1f(mesh.offset, offset);
        gl.bindVertexArray(part.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, part.geometryData.count, part.count);
      };
      drawPart(this.dynamic[kind], 0);
      blocks.forEach((block) => drawPart(block.parts[kind], block.offset));
    };
    gl.enable(gl.CULL_FACE);
    ['box', 'cyl', 'cone', 'gem', 'panel'].forEach(drawKind);
    gl.disable(gl.CULL_FACE);
    ['road', 'sign'].forEach(drawKind);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawKind('shadow');
    gl.blendFunc(gl.ONE, gl.ONE);
    drawKind('glow');
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    const blur = (dest, source, x, y, extract) => {
      bind(dest);
      use(this.blur);
      tex(0, source.texture);
      gl.uniform1i(this.blur.image, 0);
      gl.uniform2f(this.blur.stepUV, x, y);
      gl.uniform1i(this.blur.extract, extract ? 1 : 0);
      screen();
    };
    blur(blur1, base, .72 / blur1.w, 0, true);
    blur(blur2, blur1, 0, .78 / blur2.h, false);
    bind(null);
    use(this.composite);
    tex(0, base.texture);
    tex(1, blur2.texture);
    gl.uniform1i(this.composite.image, 0);
    gl.uniform1i(this.composite.glow, 1);
    screen();
  }
}
