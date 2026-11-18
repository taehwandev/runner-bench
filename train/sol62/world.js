import { Geometry, rgb } from './renderer.js';
import { CARS, STRIDE, STATION, PORTAL, EXIT, trainAt, clamp } from './timeline.js';

export function random(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
}

const c = {
  snow: rgb('b9d0d9'), ridge: rgb('8da9b8'), ice: rgb('597f92'),
  concrete: rgb('344856'), edge: rgb('586c78'), steel: rgb('223542'),
  rail: rgb('879ba5'), tie: rgb('3d4752'), dark: rgb('141f2c'),
  amber: rgb('ffd097'), lamp: rgb('ffe1b6'), cyan: rgb('91d0e5'),
  oxide: rgb('a34e3a'), red: rgb('e75f46'),
  armor: rgb('374c5d'), armorLight: rgb('546a79'), armorShade: rgb('213443')
};
const buildings = ['304653','425968','536775','495460','435363','526474','615d63','283d4d'].map(rgb);
const box = (g,...params) => g.box(...params);

function tower(g,x,z,w,d,h,palette,rng,base=0) {
  const roof=base+h, seed=Math.floor(rng()*970);
  box(g,x,base+h/2,z,w,h,d,palette,1,seed);
  box(g,x,roof+.35,z,w+.7,.7,d+.6,c.edge);
  box(g,x,roof+.85,z,w+.8,.46,d+.6,c.snow,2);
  if(h<24) return;
  const capH=2+rng()*h*.22, capW=w*(.43+rng()*.33), capD=d*(.48+rng()*.31);
  const capX=x+(rng()-.5)*(w-capW)*.48, capZ=z+(rng()-.5)*(d-capD)*.50;
  box(g,capX,roof+capH/2,capZ,capW,capH,capD,palette,1,seed+30);
  box(g,capX,roof+capH+.45,capZ,capW+.55,.9,capD+.55,c.snow,2);
  if(rng()>.53) {
    const a=4+rng()*14;
    box(g,capX,roof+capH+a/2,capZ,.57,a,.57,c.steel);
    box(g,capX,roof+capH+a,capZ,1.08,1.1,1.08,c.red,3);
  }
  if(w>25 && h>53) {
    for(const side of [-1,1]) {
      const ribX=x+side*(w*.5-2.1);
      box(g,ribX,base+h*.46,z,1.7,h*.94,d+.35,c.concrete);
    }
    box(g,x,base+h*.29,z,w+.4,1.25,d+.4,c.edge);
  }
}

function downtown(g,start,end,rng,after) {
  for(let x=start;x<end;x+=48) {
    for(const side of [-1,1]) {
      for(let row=0;row<8;row++) {
        const z=side*(39+row*64+rng()*18);
        const px=x+9+rng()*29;
        if(!after && row<2 && px>828 && px<1150) continue;
        const w=16+rng()*23, d=17+rng()*29;
        let h=16+Math.pow(rng(),1.6)*(row<3?121:174);
        if(side>0 && row<2 && px<330) h=Math.min(h,side>0&&row===0?24:46);
        if(row===0 && px>555 && px<741) h=Math.min(h,35);
        if(row===0 && side<0 && px>=167 && px<=430) h=Math.min(h,24);
        if(after && row===0) h=Math.min(h,44);
        const pal=buildings[Math.floor(rng()*buildings.length)];
        tower(g,px,z,w,d,h,pal,rng);
        if(rng()>.54) tower(g,px+20,z+side*26,w*.47,d*.38,7+rng()*15,c.concrete,rng);
      }
    }
  }
}

function trackbed(g,start,end,bridge) {
  const length=end-start, mid=(start+end)/2;
  const deck=bridge?c.steel:c.concrete;
  box(g,mid,38.1,0,length,2.9,bridge?9.8:8.5,deck);
  box(g,mid,39.62,0,length,.26,bridge?9.7:8.5,c.ridge,2);
  box(g,mid,39.80,0,length,.14,3.75,c.tie);
  for(const z of [-1.63,1.63]) {
    box(g,mid,40.04,z,length,.28,.19,c.steel);
    box(g,mid,40.22,z,length,.12,.24,c.rail,5);
  }
  for(const z of [-3.78,3.78]) {
    box(g,mid,39.88,z,length,.35,1.04,c.snow,2);
    box(g,mid,37.50,z*1.10,length,.33,.14,c.edge);
  }
  // Continuous lines live in separate runs, while the ties establish motion parallax.
  for(let x=start+1;x<end;x+=1.85) box(g,x,39.87,0,.52,.24,4.5,c.tie);
}

function viaduct(g,start,end,rng) {
  trackbed(g,start,end,false);
  for(let x=start+13;x<end;x+=28) {
    box(g,x,15,0,5.7,30,5.9,c.concrete,0,0,'bevel');
    box(g,x,28.5,0,6.65,1.2,6.7,c.edge);
    box(g,x,35.9,0,9.5,2.35,10.1,c.steel);
    box(g,x,2.5,0,11.4,5,10.9,c.concrete);
    for(const z of [-3.48,3.48]){
      g.beam([x,23,z*.61],[x,36,z*1.34],2.0,1.85,c.concrete);
      for(let j=0;j<4;j++) {
        const xx=x+(rng()-.5)*12, h=.4+rng()*2.5;
        box(g,xx,38.7-h/2,z*1.22,.17,h,.18,c.ridge);
      }
    }
  }
  for(let x=start+36;x<end;x+=67) {
    if(x>435&&x<710 || x>840&&x<1140) continue;
    const z=4.4;
    box(g,x,43.7,z,.35,8,.38,c.steel);
    g.beam([x,47.3,z],[x,46.25,2.5],.18,.20,c.rail);
    box(g,x,46.19,2.42,.61,.17,.51,c.lamp,3);
    box(g,x-.03,43.77,z-.36,.55,.68,.72,c.dark);
    box(g,x-.34,43.83,z-.41,.08,.24,.24,c.cyan,3);
  }
}

function station(g) {
  const start=447, end=654, mid=(start+end)/2, len=end-start;
  for(const side of [-1,1]) {
    box(g,mid,40.05,side*8.45,len,1.52,9.45,c.concrete);
    box(g,mid,40.90,side*8.45,len,.20,9.45,c.edge,2);
    box(g,mid,41.04,side*4.21,len,.10,.21,c.amber,3);
    box(g,mid,40.18,side*12.82,len,.17,.19,c.snow,2);
    for(let x=start+6;x<end;x+=12.5) {
      const z=side*11.96;
      box(g,x,39.43,z,2.1,3,2.1,c.concrete);
      g.beam([x,31.7,side*3.1],[x,39.6,z],.78,.8,c.steel);
      box(g,x,41.83,side*12.71,.20,1.43,.20,c.steel);
    }
    box(g,mid,42.57,side*12.71,len,.13,.17,c.rail);
  }
  for(let x=470;x<644;x+=17.25) {
    const z=9.9;
    box(g,x,44.25,z,.51,6.45,.53,c.steel);
    box(g,x,41.37,z,.85,.76,.84,c.concrete);
    g.beam([x,45.15,z],[x,47.5,5.15],.29,.33,c.rail);
    g.beam([x,45.17,z],[x,47.65,13.7],.24,.26,c.rail);
    box(g,x,47.55,9.4,.32,.55,10.1,c.steel);
    box(g,x,46.98,7.4,4.25,.13,.25,c.lamp,3);
    box(g,x+4.5,41.55,10.7,2.9,.20,.78,c.oxide);
    for(const shift of [-.94,.94]) box(g,x+4.5+shift,41.26,10.7,.16,.55,.52,c.steel);
  }
  box(g,552,47.93,9.6,182,.50,10.7,c.armor);
  box(g,552,48.30,9.65,182,.24,10.8,c.snow,2);
  box(g,552,47.71,4.23,182,.22,.12,c.edge);
  box(g,552,47.63,4.12,182,.055,.07,c.amber,3);
  for(const x of [520,578,637]) {
    box(g,x,45.51,6,.13,1.34,.13,c.rail);
    box(g,x,45.01,5.9,8.1,1.13,.24,c.dark);
    box(g,x,45.56,5.74,8.12,.07,.055,c.oxide);
    stationLettering(g,x);
  }
  for(const x of [461,498,548,596,644]) {
    box(g,x,43.75,-12,.20,5.23,.20,c.steel);
    box(g,x,46.27,-11.76,.92,.27,.34,c.concrete);
    box(g,x,46.1,-11.76,.73,.08,.27,c.lamp,3);
  }
}

function stationLettering(g,x) {
  // Five-dot lettering sits directly on the enamel sign face.
  const letters={
    M:[17,27,21,21,17,17,17], E:[31,16,16,30,16,16,31],
    R:[30,17,17,30,20,18,17], I:[31,4,4,4,4,4,31],
    D:[30,17,17,17,17,17,30], A:[14,17,17,31,17,17,17],
    N:[17,25,25,21,19,19,17]
  };
  for(const [i,letter] of [...'MERIDIAN'].entries()){
    for(const [row,bits] of letters[letter].entries()){
      for(let col=0;col<5;col++){
        if(bits&(16>>col)) box(g,x-(i*6+col-23)*.115,45.04+(.375-row*.107),5.762,.118,.110,.036,c.lamp,3);
      }
    }
  }
}

function tunnel(g,rng) {
  const len=EXIT-PORTAL, x=(PORTAL+EXIT)/2;
  trackbed(g,PORTAL,EXIT,false);
  box(g,x,18.1,0,len,36.2,52,c.concrete);
  for(const z of [-18.5,18.5]) {
    box(g,x,45, z,len,20,16,c.armorShade,6);
    box(g,x,47.3,Math.sign(z)*10.43,len,.13,.15,c.rail);
    box(g,x,40.65,Math.sign(z)*9.8,len,1.24,1.36,c.steel,6);
  }
  box(g,x,55.3,0,len,4.25,53,c.armorShade,6);
  for(let xx=PORTAL+4;xx<EXIT;xx+=12) {
    for(const side of [-1,1]) {
      box(g,xx,46.68,side*10.1,1.2,13.4,.91,c.concrete,6);
      box(g,xx+1.26,49.1,side*10.07,3.9,.31,.19,c.cyan,3);
      box(g,xx+1.26,48.55,side*10.28,4.13,1.11,.43,c.steel,6);
      if(xx%24<12) box(g,xx+3.8,42.7,side*10.15,.22,.32,.29,c.amber,3);
    }
    box(g,xx,53.15,0,1.25,.79,20,c.concrete,6);
    box(g,xx+4,53.04,0,4,.19,.57,c.lamp,3);
  }
  for(const portal of [PORTAL,EXIT]) {
    for(const s of [-1,1]) {
      box(g,portal,46.19,s*12.08,3.3,15.9,4.3,c.concrete);
      box(g,portal,40.85,s*10.11,2.95,2.05,.38,c.oxide);
      g.beam([portal,50.21,s*10.52],[portal,53.8,s*6.8],1.35,3.08,c.concrete);
      box(g,portal+(portal===EXIT?1.78:-1.78),49.54,s*12,.13,.67,1.5,c.lamp,3);
    }
    box(g,portal,54.68,0,3.55,2.4,28.5,c.concrete);
    box(g,portal,56.03,0,3.7,.34,29,c.snow,2);
  }
  for(let j=0;j<5;j++) {
    const px=PORTAL+24+j*46;
    tower(g,px,(j%2?1:-1)*7,44,51,23+rng()*62,buildings[j],rng,56.8);
    tower(g,px,(j%2?1:-1)*46,42,39,67+rng()*65,buildings[j+1],rng);
  }
}

function bridge(g,start,end,rng) {
  trackbed(g,start,end,true);
  const span=35;
  for(let x=start;x<end-.1;x+=span) {
    const next=Math.min(x+span,end), w=next-x;
    for(const side of [-1,1]){
      const z=side*4.65, foot=side*3.86;
      g.beam([x,36.4,z],[next,36.4,z],.56,.39,c.edge);
      g.beam([x,28.5,foot],[next,28.5,foot],.49,.39,c.steel);
      g.beam([x,36.5,z],[x+w*.5,28.5,foot],.42,.36,c.steel);
      g.beam([x+w*.5,28.5,foot],[next,36.5,z],.42,.36,c.steel);
      box(g,x+.65,40.13,side*4.72,1.6,.22,.39,c.amber,3);
      box(g,x+w*.5,30.75,foot,.21,.67,.20,c.cyan,3);
    }
    if(Math.round((x-start)/span)%3===0) {
      box(g,x,11.8,0,8.4,23.6,12.6,c.concrete,0,0,'bevel');
      box(g,x,23.05,0,10.4,2.12,14.9,c.edge);
      for(const side of [-1,1]) g.beam([x,19,side*3],[x,35.95,side*4.8],1.6,1.4,c.concrete);
    }
    box(g,x+6*rng(),36.92,4.93,.7,.44,.31,c.rail);
  }
}

function suspension(g) {
  const anchors=[1356,1533,1710,1887,2064];
  for(const x of anchors) {
    for(const s of [-1,1]) {
      const z=s*6.1;
      box(g,x,13.8,z,5.7,28.2,5.8,c.concrete);
      box(g,x,44,z,2.4,35.1,2.5,c.steel);
      box(g,x,61.1,z,3.5,1.22,3.25,c.edge);
      box(g,x,61.87,z,2.4,.35,1.93,c.snow,2);
      box(g,x,62.36,z,.58,.39,.55,c.red,3);
      box(g,x,54.82,z,2.62,1.1,2.68,c.edge);
    }
    box(g,x,56.02,0,1.27,1.27,12,c.steel);
    box(g,x,56.76,0,1.44,.20,11.9,c.snow,2);
    g.beam([x,51,-5.9],[x,56,0],.45,.43,c.edge);
    g.beam([x,56,0],[x,51,5.9],.45,.43,c.edge);
  }
  for(let a=0;a<anchors.length-1;a++){
    const x=anchors[a], len=anchors[a+1]-x;
    const cord=t=>44.9+16.2*(2*t-1)**2;
    for(const s of [-1,1]) {
      const z=s*6.1;
      for(let i=0;i<12;i++){
        const t=i/12, next=(i+1)/12;
        g.beam([x+len*t,cord(t),z],[x+len*next,cord(next),z],.29,.26,c.rail);
        if(i) g.beam([x+len*t,cord(t),z],[x+len*t,38.2,z*.79],.12,.12,c.edge);
      }
    }
  }
}

function landscape(g,rng){
  box(g,730,-4.7,0,4040,4,2550,c.ice,4);
  box(g,194,-2.6,4,1855,5.0,1740,c.snow,2);
  box(g,2547,-2.25,0,975,4.6,1750,c.snow,2);
  for(let i=0;i<185;i++) {
    const x=1107+rng()*987, z=(rng()-.5)*1300;
    box(g,x,-2.69+i*.0013,z,4+rng()**2*85,.24+rng()*.38,1.4+rng()**2*32,i%6?c.ridge:c.snow,2,0,'bevel');
  }
  for(let i=0;i<42;i++){
    const x=-700+rng()*3280, z=(705+rng()*460)*(i%2===0?1:-1);
    const h=22+rng()**2*110;
    box(g,x,h*.46-9,z,110+rng()*235,h,100+rng()*150,c.ridge,2,0,'bevel');
  }
  for(let i=0;i<190;i++){
    const x=-470+rng()*1580, z=(rng()-.5)*1200;
    box(g,x,-.18,z,9+rng()*38,.45+rng()*.67,9+rng()*46,c.snow,2,0,'bevel');
  }
  for(const side of [-1,1]){
    for(let i=0;i<18;i++){
      const z=side*(31+i*37);
      const x=2084+rng()*35;
      box(g,x,-1.1,z,35+rng()*22,4.3,12+rng()*18,c.concrete,0,0,'bevel');
      box(g,x,.94,z,31,.4,12,c.ridge,2);
      if(i%3!==0) continue;
      box(g,x-8,4.1,z,.31,6.1,.31,c.steel);
      box(g,x-8,7.15,z,.98,.27,1.02,c.amber,3);
    }
  }
}

export function makeWorld(renderer) {
  const rng=random(579042), sectors=[];
  function add(g,x,radius=900,essential=false) {
    sectors.push({x,radius,essential,meshes:renderer.upload(g)});
  }
  const ground=new Geometry();
  landscape(ground,rng);
  add(ground,0,0,true);
  for(const [start,end] of [[-550,-240],[-240,72],[72,384],[384,690],[690,876],[876,1140],[2080,2392],[2392,2704]]) {
    const g=new Geometry();
    downtown(g,start,end,rng,start>2000);
    if(end<=876) viaduct(g,start,end,rng);
    if(start===384) station(g);
    if(start===876) tunnel(g,rng);
    add(g,(start+end)/2,1060);
  }
  for(const [start,end] of [[EXIT,1391],[1391,1671],[1671,1951],[1951,2231],[2231,2511]]) {
    const g=new Geometry();
    bridge(g,start,end,rng);
    add(g,(start+end)/2,950);
  }
  const cable=new Geometry();
  suspension(cable);
  add(cable,1700,1080);
  return sectors;
}

function disk(g,x,y,z,diam,thick,color,material=0) {
  g.instance('wheel',[x,y,z],[[0,0,-diam],[0,diam,0],[thick,0,0]],color,material,0);
}

function bogies(g,x) {
  for(const axle of [-7.4,-5.15,5.2,7.45]){
    for(const s of [-1,1]) {
      box(g,x+axle,40.98,s*1.72,1.62,1.61,.56,c.dark,0,0,'wheel');
      box(g,x+axle,40.98,s*2.03,1.28,1.28,.09,c.steel,5,0,'wheel');
      box(g,x+axle,40.98,s*2.10,.52,.52,.13,c.rail,5,0,'wheel');
    }
  }
  for(const xx of [x-6.2,x+6.2]) {
    box(g,xx,41.38,0,3.91,1.13,3.8,c.dark,0,0,'bevel');
    for(const s of [-1,1]) {
      box(g,xx,41.38,s*2.15,3.34,.42,.29,c.armor);
      box(g,xx,41.38,s*2.31,.65,.61,.23,c.oxide);
    }
  }
}

function carriage(g,x,i) {
  const w=i===0?22.6:19.1, armor=i%3===0?c.armor:buildings[i%3];
  const roof=i===0?46.92:46.01;
  bogies(g,x);
  box(g,x,41.74,0,w-.36,.69,4.86,c.armorShade,0,0,'bevel');
  box(g,x,43.44,0,w,3.82,5.02,armor,5,i,'bevel');
  box(g,x,44.15,0,w*.854,3.08,5.02,armor,5);
  box(g,x,roof-.52,0,w*.91,1.25,4.91,c.armorShade,5,0,'bevel');
  box(g,x,roof+.025,0,w*.74,.43,3.96,c.ridge,2,0,'bevel');
  box(g,x-.62,roof+.19,.15,w*.58,.28,2.67,c.snow,2,0,'bevel');
  box(g,x-w*.52,41.60,0,i===0?3.3:2.24,.42,.7,c.steel);
  box(g,x-w*.46,42.38,0,.32,1.8,2.95,c.dark);
  for(const s of [-1,1]){
    const edge=s*2.55;
    box(g,x,42.22,s*2.48,w*.92,.79,.36,c.armorShade,5);
    box(g,x,42.69,s*2.64,w*.88,.15,.14,i===0?c.oxide:c.armorLight);
    box(g,x,45.63+(i===0?.22:0),s*2.41,w*.85,.145,.28,c.rail,5);
    if(i===0){
      box(g,x+5.9,44.78,edge,2.24,1.03,.17,c.dark);
      box(g,x+5.96,44.80,s*2.66,1.81,.69,.07,c.amber,3);
      box(g,x+6.03,44.80,s*2.705,.12,.70,.055,c.steel);
      for(let j=0;j<7;j++) box(g,x-6.3+j*.64,44.51,edge,.34,1.10,.18,c.armorShade);
    }else{
      for(let j=0;j<5;j++){
        const xx=x+(j-2)*2.74, windowW=i%3===2?1.25:1.84;
        box(g,xx,44.27,edge,windowW+.32,.89,.15,c.dark);
        box(g,xx,44.27,s*2.647,windowW,.60,.04,(j+i)%5===0?c.cyan:c.amber,3);
        box(g,xx-.12,44.27,s*2.68,.11,.62,.05,c.armorShade);
        box(g,xx,44.76,s*2.61,windowW+.43,.10,.32,c.armorLight);
        box(g,xx+1.08,43.39,s*2.60,.29,1.19,.17,c.armorShade);
      }
    }
    for(const e of [-1,1]) {
      box(g,x+e*w*.397,44.08,s*2.55,.27,2.42,.19,c.armorLight);
      box(g,x+e*w*.41,43.15,s*2.56,.41,.20,.29,c.oxide);
    }
  }
  if(i!==0) {
    for(let j=0;j<3;j++){
      const xx=x+(j-1)*4.7, z=(i%3-1)*.4;
      box(g,xx,roof+.32,z,2.65,.45,1.91,c.armorLight,5,0,'bevel');
      box(g,xx,roof+.55,z,2.25,.10,1.53,c.snow,2);
    }
  }
}

export function makeTrain(renderer) {
  const g=new Geometry();
  const x=-11.5;
  carriage(g,x,0);
  for(let i=1;i<=CARS;i++) carriage(g,x-1-i*STRIDE,i);
  box(g,-1.55,43.04,0,3.04,2.78,4.98,c.armorLight,5,0,'bevel');
  box(g,-.142,42.56,0,.25,.43,4.42,c.oxide);
  box(g,-.117,42.23,0,.227,.43,4.50,c.armorShade);
  box(g,-.233,41.60,0,.44,.57,4.98,c.steel);
  box(g,-.126,41.17,0,.23,.34,4.64,c.armorShade);
  box(g,-1.52,45.49,0,2.48,1.71,4.65,c.armor,5,0,'bevel');
  for(const s of [-1,1]) {
    box(g,-.368,45.62,s*.96,.16,.94,1.53,c.dark);
    box(g,-.261,45.62,s*.96,.067,.66,1.28,c.cyan,3);
    box(g,-.205,45.71,s*1.07,.045,.13,1.09,c.armorLight,5);
    box(g,-.12,42.57,s*1.64,.10,.45,.18,c.amber,3);
    disk(g,-.15,43.27,s*1.7,.62,.17,c.armorShade);
    disk(g,-.053,43.27,s*1.7,.45,.031,c.lamp,7);
    box(g,-.17,41.74,s*1.77,.13,.26,.64,c.dark);
  }
  disk(g,-.225,44.1,0,1.13,.23,c.armorShade);
  disk(g,-.091,44.1,0,.89,.081,c.rail,5);
  disk(g,-.034,44.1,0,.65,.036,c.lamp,7);
  box(g,-7.25,47.18,.05,2.02,1.03,1.71,c.dark,5,0,'bevel');
  box(g,-7.25,47.69,.05,1.74,.13,1.46,c.armorLight);
  box(g,-7.25,47.77,.05,1.28,.10,1.09,c.dark);
  for(let j=0;j<3;j++) box(g,-13.9-j*1.37,47.24,0,1.15,.38,2.37,c.armorLight,5,0,'bevel');
  for(const s of [-1,1]) {
    box(g,-211.10,43.30,s*1.49,.24,.57,.62,c.dark);
    box(g,-211.25,43.30,s*1.49,.10,.38,.40,c.red,3);
  }
  return renderer.upload(g);
}

const puffRandom=random(62991);
const puffSeeds=Array.from({length:75},()=>[puffRandom(),puffRandom(),puffRandom(),puffRandom()]);
export function particlesAt(t,train,eye) {
  const p=[];
  const add=(x,y,z,r,a,seed,mode=0,aspect=1)=>p.push([x,y,z,r,a,seed,mode,aspect]);
  const spacing=.12;
  for(let j=0;j<63;j++){
    const k=Math.floor(t/spacing)-j;
    const [a,b,c,d]=puffSeeds[((k%75)+75)%75];
    const age=t-k*spacing, spawn=trainAt(Math.max(0,k*spacing));
    const position=k<0?24*k*spacing:spawn.distance;
    const x=position-7.25-age*(1.7+a*1.9);
    const y=47.75+age*(1.05+d*1.37)+Math.sin(age*1.29+b*9)*age*.31;
    const z=.05+age*(1.03+b*1.66)+Math.sin(age*1.74+c*14)*age*.45;
    const inTunnel=x>PORTAL&&x<EXIT, braking=t>25&&t<31;
    const alpha=(1-clamp(age/7.4))*(braking?.35:.47)*(inTunnel?.55:1);
    add(x,inTunnel?Math.min(y,52.2):y,z,.58+age*(.73+b*.67),alpha,a*31,0,.73+b*.47);
  }
  if(t>24&&t<35){
    const surge=Math.sin(clamp((t-24)/11)*Math.PI)*.79;
    for(let j=0;j<26;j++){
      const [a,b,c,d]=puffSeeds[j+31];
      const age=(t*1.42+j*.127)%2.5;
      const spawn=trainAt(Math.max(0,t-age));
      add(spawn.distance-7-j*.50-age*(a*2),41.1+age*(b*1.38),(-1)**j*(2.48+age*(c+.7)),.24+age*1.34,(1-age/2.5)*surge,d*27,0,.58);
    }
  }
  const x=train.distance;
  if(eye[0]>x) {
    add(x+.18,44.1,0,2.65,.72,1,1,.91);
    add(x+.15,44.1,0,1.18,.80,1,1,.93);
    for(const s of [-1,1]) add(x+.08,43.27,s*1.7,.96,.57,1,1,1);
    for(let j=1;j<=10;j++){
      const dx=j*2.25;
      add(x+dx,44.1-dx*.106,0,.40+dx*.10,(1-j/11)*.064,1,1,.72);
    }
  } else if(eye[0]<x-211.3) {
    for(const s of [-1,1]) add(x-211.36,43.30,s*1.49,1.7,.74,1,2,.84);
  }
  const sortKey=p=> (p[0]-eye[0])**2+(p[1]-eye[1])**2+(p[2]-eye[2])**2;
  p.sort((a,b)=>sortKey(b)-sortKey(a));
  return new Float32Array(p.flat());
}
