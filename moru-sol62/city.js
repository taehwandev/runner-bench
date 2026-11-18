import {Geometry} from './renderer.js';

export const segmentLength=44;
export const lanes=[-2.65,0,2.65];
export const colors={
  asphalt:[.025,.027,.048], steel:[.047,.063,.099], glass:[.028,.064,.104],
  coal:[.018,.019,.031], ivory:[.53,.54,.58], pale:[.62,.83,.85],
  teal:[.14,.91,.82], amber:[1.05,.52,.115], red:[1.15,.105,.065],
  pink:[.91,.22,.59], gold:[1.42,.78,.22]
};

export const districts=[
  {name:'Lantern Mile',fog:[.285,.113,.195],accent:[.17,.69,.67],trim:[.13,.68,.63],sign:'MIRO'},
  {name:'Copper Works',fog:[.29,.123,.102],accent:[.9,.42,.13],trim:[.92,.36,.095],sign:'WORKS'},
  {name:'Undercurrent',fog:[.089,.153,.239],accent:[.10,.63,.93],trim:[.09,.57,.94],sign:'METRO'},
  {name:'Glass Quarter',fog:[.207,.115,.287],accent:[.70,.22,.82],trim:[.79,.22,.73],sign:'HALO'}
];

export function districtAt(distance){
  return Math.floor(Math.max(0,distance)/(segmentLength*10))%districts.length;
}
const {asphalt,steel,glass,coal,ivory,pale,teal,amber,red,pink,gold}=colors;
const curb=[.15,.137,.18], walk=[.065,.057,.083];
const glyphs={
  A:['01110','10001','11111','10001','10001'], E:['11111','10000','11110','10000','11111'],
  H:['10001','10001','11111','10001','10001'], I:['111','010','010','010','111'],
  K:['10001','10010','11100','10010','10001'], L:['10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10001','10001'], O:['01110','10001','10001','10001','01110'],
  R:['11110','10001','11110','10010','10001'], S:['01111','10000','01110','00001','11110'],
  T:['11111','00100','00100','00100','00100'], W:['10001','10001','10101','10101','01010'],
  X:['10001','01010','00100','01010','10001'], '0':['01110','10011','10101','11001','01110'],
  '4':['10010','10010','11111','00010','00010'], '7':['11111','00010','00100','01000','01000']
};
function lettering(g,text,x,y,z,unit,color){
  const rows=[...text].map(c=>glyphs[c]);
  const width=rows.reduce((sum,r)=>sum+r[0].length+1,-1);
  let offset=-width/2;
  for(const letter of rows){
    letter.forEach((row,i)=>{
      for(let j=0;j<row.length;){
        if(row[j]!=='1'){j++;continue;}
        let end=j+1;
        while(row[end]==='1') end++;
        g.plane(x+(offset+(j+end)/2)*unit,y+(2-i)*unit,z,(end-j)*unit*.98,unit*.86,color,3,true);
        j=end;
      }
    });
    offset+=letter[0].length+1;
  }
}

function randomFor(seed){
  let state=seed|0;
  return ()=>{
    state=(Math.imul(1664525,state)+1013904223)|0;
    return (state>>>0)/4294967296;
  };
}
function façade(g,x,z,w,h,l,tint,trim,side,random){
  g.box(x,h/2+.12,z,w,h,l,tint,2);
  g.box(x,.79,z,w+.13,1.52,l+.15,[.052,.044,.069]);
  g.box(x,h+.16,z,w+.27,.23,l+.25,steel);
  g.box(x,h+.56,z,w*.46,.64,l*.42,tint);
  const inner=x-side*w*.5;
  g.box(inner-side*.075,1.89,z,.16,.10,l,trim,3);
  g.box(inner-side*.03,1.1,z,.13,1.06,l*.79,glass);
  g.box(inner-side*.10,1.6,z,.22,.045,l*.78,trim,3);
  for(let j=-2;j<=2;j++) g.box(inner-side*.12,1.09,z+j*l*.153,.13,1.06,.047,steel);
  if(h>11){
    for(const u of [.35,.67,.96]) g.box(inner-side*.06,h*u,z,.13,.11,l+.03,steel);
  }
  if(h>16 && random()>.35){
    g.box(x,h+1.95,z,.09,3.0,.09,ivory);
    g.box(x,h+3.49,z,.14,.18,.14,red,3);
  }
}
function streetLamp(g,light,side,z,district){
  const x=side*4.93;
  const head=side*3.85;
  const ink=side<0?district.trim:amber;
  g.box(x,.35,z,.29,.53,.27,steel);
  g.box(x,2.47,z,.12,4.85,.13,steel);
  g.box((x+head)/2,4.79,z,1.18,.105,.14,steel);
  g.box(head,4.73,z,.64,.16,.38,coal);
  g.box(head,4.64,z,.53,.06,.29,ink,3);
  light.plane(head,4.63,z+.03,2.8,1.96,ink,5,true);
  light.plane(side*3.23,.016,z,3.5,8.0,ink,4);
}
function shopSign(g,light,side,z,ink,label){
  const x=side*4.73,y=3.45;
  g.box(side*5.58,y,z,2.6,.10,.14,steel);
  g.box(x,y,z,1.55,1.08,.20,coal);
  g.plane(x,y+.46,z+.106,1.40,.032,ink,3,true);
  g.plane(x,y-.46,z+.106,1.40,.032,ink,3,true);
  lettering(g,label,x,y+.12,z+.11,.049,ink);
  g.plane(x,y-.24,z+.111,.92,.061,ink,3,true);
  light.plane(x,y,z+.12,2.43,1.8,ink,5,true);
  light.plane(side*4.1,.014,z+.35,2.1,8,ink,4);
}
function crossing(g,light,z){
  g.plane(0,.018,z,9.4,4.6,steel);
  for(const offset of [-1.26,1.26]){
    g.box(0,.046,z+offset,14.2,.036,.105,ivory);
    g.box(0,.069,z+offset,14.2,.009,.034,amber,3);
  }
  for(let x=-4.3;x<=4.4;x+=.63) g.plane(x,.025,z,.20,3.4,coal);
  for(const side of [-1,1]){
    const x=side*4.72;
    g.box(x,1.5,z+2.8,.12,3,.11,ivory);
    g.box(x,2.69,z+2.84,.74,.33,.13,coal);
    for(const dx of [-.22,.22]){
      g.box(x+dx,2.69,z+2.92,.15,.15,.07,red,3);
      light.plane(x+dx,2.69,z+3,.8,.8,red,5,true);
    }
    for(const sign of [-1,1]) g.box(x,3.15,z+2.88,.83,.12,.1,ivory,0,0,0,sign*.57);
  }
}
function overpass(g,light,z,district,tunnel){
  const ink=district.trim;
  const length=tunnel?13:4.8;
  g.box(0,5.58,z,16.8,.71,length,steel);
  g.box(0,6.08,z+length/2,17.8,.48,.19,walk);
  g.box(0,5.68,z+length/2+.019,16.9,.082,.10,ink,3);
  for(const side of [-1,1]){
    g.box(side*4.94,2.66,z,.73,5.32,length-.1,steel);
    g.box(side*4.53,3.34,z,.066,.15,length,ink,3);
    if(tunnel) g.box(side*3.27,5.17,z,.38,.085,length-.2,pale,3);
    light.plane(side*3.1,.024,z,2.4,length+1.5,ink,4);
  }
  g.box(0,4.91,z+length/2,.99,.47,.19,coal);
  lettering(g,tunnel?'METRO':'04',0,4.91,z+length/2+.11,.047,ink);
}

function industrial(g,light,z,side){
  const x=side*6.48;
  const beam=[.34,.13,.052];
  g.box(x,4.03,z,.27,8.0,.33,beam);
  g.box(x+side*.59,4.03,z,.18,8.0,.33,beam);
  g.box(x+side*.65,8.03,z,5.7,.21,.4,beam);
  g.box(x+side*.65,8.65,z,5.7,.11,.28,beam);
  for(let i=0;i<7;i++){
    g.box(x+side*(i*.79-1.71),8.33,z,.11,.8,.28,beam,0,0,0,(i%2?1:-1)*.69);
    g.box(x+side*.29,i*1.06+.68,z+.09,.11,.96,.15,amber,0,0,0,(i%2?1:-1)*.68);
  }
  const hook=x-side*1.28;
  g.box(hook,6.99,z,.036,1.94,.036,ivory);
  g.box(hook,6.04,z,.32,.18,.14,amber);
  for(let i=-1;i<=1;i++) {
    g.box(x+side*.25,1.15,z+i*2.8,2.56,1.95,2.68,[.31,.112,.054]);
    for(const dx of [-.91,-.45,0,.45,.91]) g.box(x+side*.25+dx,1.19,z+i*2.8+1.352,.05,1.68,.05,beam);
    g.box(x+side*.25,2.16,z+i*2.8,2.62,.09,2.72,amber);
  }
  g.box(x-side*1.49,2.15,z+.91,.13,.15,.15,amber,3);
  light.plane(x-side*1.5,2.15,z+1,.78,.66,amber,5,true);
}

function glassCanopy(g,light,z,side){
  const x=side*6.31;
  g.box(x,2.98,z,3.22,.19,8.8,[.09,.079,.18]);
  g.box(x-side*1.62,2.96,z,.046,.10,8.76,pink,3);
  g.box(x,2.97,z+4.36,3.22,.072,.069,teal,3);
  for(let i=-1;i<=1;i++){
    g.box(x-side*1.30,1.52,z+i*3.9,.065,2.10,.11,steel);
    g.box(x-side*1.25,1.71,z+i*3.9+1.42,.037,1.92,2.72,[.11,.106,.22]);
    g.box(x-side*1.27,1.0,z+i*3.9+1.42,.047,.048,2.73,pink,3);
  }
  light.plane(x-side*1.12,.025,z,3.01,10.0,pink,4);
}

export function buildSegment(index){
  const g=new Geometry(), light=new Geometry(4096);
  const random=randomFor(index*3719+44031);
  const district=districts[districtAt(index*segmentLength)];
  const slot=((index%10)+10)%10;
  g.plane(0,0,-22,9.66,44,asphalt,1);
  for(const side of [-1,1]){
    g.box(side*6.97,.033,-22,4.8,.19,44,walk);
    g.box(side*4.65,.076,-22,.18,.24,44,curb);
    g.plane(side*4.39,.012,-22,.076,44,[.46,.31,.19]);
    for(let j=0;j<4;j++){
      const z=-5.5-j*11, w=5.7+random()*3.0, l=7.9+random()*2.7;
      const h=5.3+random()*(district===districts[1]?12:21);
      const tint=[.038+random()*.062,.035+random()*.036,.074+random()*.085];
      façade(g,side*(5.8+w*.5+random()*.8),z,w,h,l,tint,district.trim,side,random);
      if(!(j%2)) façade(g,side*(15+random()*4),z-4,7,15+random()*20,8,[.051+random()*.03,.044,.092],steel,side,random);
      for(let k=0;k<3;k++) g.plane(side*5.17,.131,z-2.8+k*2.3,.22,1.5,curb);
    }
    streetLamp(g,light,side,side<0?-11:-22,district);
    streetLamp(g,light,side,side<0?-33:-.4,district);
    if(index!==0 || side===-1) shopSign(g,light,side,-14-(side+1)*5,side<0?district.trim:pink,district.sign);
    shopSign(g,light,side,-35,side<0?amber:district.trim,side<0?'07':'HALO');
  }
  for(let i=0;i<8;i++){
    const z=-2-i*5.5;
    for(const x of [-1.325,1.325]) g.plane(x,.012,z,.067,2.02,[.42,.39,.41]);
  }
  if(slot===4 || slot===8){
    const z=-29;
    for(let x=-3.94;x<4.3;x+=.55) g.plane(x,.017,z,.25,2.25,[.38,.37,.40]);
    for(const offset of [-2,2]) g.plane(0,.014,z+offset,8.4,.085,ivory);
  }
  if(index===4) crossing(g,light,-5);
  if(index===8) overpass(g,light,-10,district,true);
  if(slot===3 || slot===8) crossing(g,light,-29);
  if(slot===6 || (district===districts[2] && [2,3,4,7].includes(slot))) overpass(g,light,-22,district,district===districts[2]);
  if(district===districts[1] && slot%3!==2) industrial(g,light,-9,slot%2?1:-1);
  if(district===districts[3]) glassCanopy(g,light,-17,slot%2?1:-1);
  if(index===0) {
    g.box(-6.15,7.3,-34,4.2,1.95,.31,steel);
    g.plane(-6.15,7.3,-33.83,3.96,1.68,[.11,.09,.13],0,true);
    lettering(g,'MIRO',-6.15,7.48,-33.8,.132,teal);
    g.plane(-6.15,6.90,-33.79,3.48,.083,amber,3,true);
  }
  return {g,light};
}

export function railCar(g,light,x,z){
  g.box(x,.29,z,4.7,.46,2.35,coal);
  g.box(x,1.17,z,4.9,1.45,2.13,[.21,.23,.32],0,0,0,0,.94);
  g.box(x,1.94,z,4.55,.18,1.9,steel);
  g.box(x,.67,z+1.09,4.66,.14,.07,amber,3);
  for(const dx of [-1.65,-.55,.55,1.65]){
    g.box(x+dx,1.34,z+1.077,.84,.53,.05,glass);
    g.box(x+dx,1.46,z+1.11,.71,.21,.033,[.41,.31,.225],3);
  }
  for(const dx of [-1.99,1.99]) {
    g.box(x+dx,.89,z+1.099,.20,.11,.06,red,3);
    light.plane(x+dx,.89,z+1.15,1.1,.81,red,5,true);
  }
}
