import {colors} from './city.js';
const {steel,glass,coal,ivory,pale,teal,amber,red,pink,gold}=colors;
const black=[.018,.028,.043];
const shell=[.69,.70,.72];
const coat=[.94,.25,.076];
const ceramic=[.84,.36,.13];
const lime=[.62,.86,.30];
export const pickupColors={chip:gold,shield:teal,magnet:pink};
export const hazards={
  low:{width:1.98,depth:.6,label:'CONSTRUCTION BARRIER',tip:'Jump over the low barrier'},
  high:{width:2.05,depth:.43,label:'LOW CLEARANCE',tip:'Slide under the beam'},
  car:{width:1.88,depth:3.32,label:'TRAFFIC COLLISION',tip:'Swipe away from vehicles'},
  taxi:{width:1.86,depth:3.16,label:'MOVING TRAFFIC',tip:'Watch for swerving taxis'},
  tram:{width:1.91,depth:4.45,label:'RAIL CROSSING',tip:'Take the clear lane at crossings'}
};

function chevron(g,x,y,z,size,color,up){
  for(const side of [-1,1]){
    g.box(x+side*size*.18,y,z,size*.51,size*.125,.041,color,3,0,0,side*(up?-.64:.64));
  }
}
function barrier(g,glow,x,z,high){
  if(high){
    for(const side of [-1,1]){
      g.box(x+side*1.08,.80,z,.12,1.56,.19,steel);
      g.box(x+side*1.08,.13,z,.29,.20,.66,black);
      g.box(x+side*1.08,1.47,z,.15,.32,.21,ivory);
    }
    g.box(x,1.38,z,2.32,.64,.32,[.26,.11,.13]);
    g.box(x,1.68,z,2.35,.053,.36,red,3);
    g.box(x,1.08,z,2.34,.055,.36,red,3);
    for(const side of [-1,1]){
      chevron(g,x+side*.54,1.39,z+.178,.61,[1.1,.35,.29],false);
      g.box(x+side*.99,1.39,z+.174,.082,.23,.048,pale,3);
    }
    glow.plane(x,1.41,z+.22,2.9,1.23,red,5,true);
    glow.plane(x,.031,z,2.76,3.2,red,4);
    return;
  }
  g.box(x,.32,z,2.04,.49,.51,[.64,.23,.046],0,0,0,0,.88);
  g.box(x,.08,z,2.13,.14,.67,steel);
  g.box(x,.58,z,1.79,.069,.43,amber,3);
  for(let k=-2;k<=2;k++) {
    const dx=k*.345;
    g.box(x+dx,.31,z+.259,.17,.40,.032,k%2?coal:ivory,0,0,0,-.53);
  }
  chevron(g,x,.71,z+.045,.46,amber,true);
  for(const side of [-1,1]){
    g.box(x+side*.81,.69,z,.14,.15,.12,gold,3);
    glow.plane(x+side*.81,.67,z+.09,.65,.66,amber,5,true);
  }
  glow.plane(x,.023,z+.53,2.8,3.2,amber,4);
}
function car(g,glow,x,z,taxi,traming,lean){
  const paint=taxi?[.91,.42,.073]:traming?[.22,.29,.41]:[.24,.13,.31];
  const w=traming?1.91:1.88,l=traming?4.45:taxi?3.16:3.32;
  const top=traming?1.91:1.30;
  g.box(x,.31,z,w*.96,.32,l*.96,coal,0,lean);
  g.box(x,.59,z,w,.42,l,paint,0,lean,0,0,.92);
  g.box(x,top-.28,z-.18,w*.87,traming?1.27:.54,l*(traming?.93:.59),paint,0,lean,0,0,traming?.92:.78);
  g.box(x,top,z-.18,w*.66,.095,l*(traming?.87:.46),paint,0,lean);
  g.box(x,top-.31,z+l*(traming?.42:.24),w*.74,.36,.069,glass,0,lean,-.20);
  g.box(x,top-.31,z-l*(traming?.48:.34),w*.69,.38,.05,glass,0,lean,.32);
  for(const side of [-1,1]){
    const dx=side*w*.405;
    const y=top-.30;
    g.box(x+dx,y,z-.33,.047,.29,l*(traming?.79:.47),glass,0,lean,0,side*.16);
    g.box(x+dx,y,z-.30,.046,.30,.052,paint,0,lean);
    g.box(x+side*w*.50,.83,z-.62,.20,.09,.25,paint,0,lean);
    for(const axle of [-.32,.32]){
      g.box(x+side*w*.46,.25,z+l*axle,.22,.48,.54,black,0,lean,0,0,.77);
      g.box(x+side*w*.51,.25,z+l*axle,.035,.21,.25,steel);
    }
    for(const end of [-1,1]){
      const back=end===1;
      const ink=back?red:pale;
      g.box(x+side*w*.35,.61,z+end*l*.499,.37,.12,.071,ink,3,lean);
      glow.plane(x+side*w*.35,.61,z+end*l*.53,1.25,.81,ink,5,true);
      glow.plane(x+side*w*.34,.025,z+end*(l*.5+1.05),.91,back?3.5:5.8,ink,4);
    }
  }
  g.box(x,.38,z+l*.50,w*.92,.10,.068,steel,0,lean);
  g.box(x,.48,z+l*.504,.35,.12,.042,ivory,0,lean);
  if(taxi){
    g.box(x,1.38,z-.18,.57,.19,.35,gold,3,lean);
    g.box(x,1.48,z-.18,.51,.032,.22,coal,0,lean);
  }
  if(traming) g.box(x,1.79,z+l*.49,.62,.095,.043,amber,3);
}
export function hazardModel(g,glow,o,z){
  if(o.type==='low' || o.type==='high') barrier(g,glow,o.x,z,o.type==='high');
  else car(g,glow,o.x,z,o.type==='taxi',o.type==='tram',o.lean||0);
}

export function pickupModel(g,glow,p,z,time) {
  const color=pickupColors[p.type], a=time*3.5+p.d*.19;
  const y=p.y+Math.sin(time*6.7+p.d)*.05;
  const power=p.type!=='chip', size=power?.35:.17;
  g.diamond(p.x,y,z,size,size*(power?1.26:1.35),color,a);
  if(power){
    for(let i=0;i<4;i++){
      const phase=a+i*Math.PI/2;
      g.box(p.x+Math.cos(phase)*.51,y+Math.sin(phase)*.44,z+.14,.13,.075,.06,color,3,0,0,phase);
    }
  }
  glow.plane(p.x,y,z+.29,power?1.88:.86,power?1.62:.84,color,5,true);
  glow.plane(p.x,.029,z,power?1.9:.83,power?2.5:1.15,color,4);
}

function bodyPart(g,p,y,z,w,h,l,color,pitch=0,kind=0,taper=1){
  const b=p.bank;
  g.box(p.x-Math.sin(b)*y,p.y+y*Math.cos(b),z,w,h,l,color,kind,0,pitch,b,taper);
}
function limb(g,x,y,z,w,h,l,tint,phase,arm,slide){
  if(slide){
    g.box(x,y+(arm?.08:-.22),z+(arm?-.2:.37),w,h,l,tint,0,0,arm?.76:1.12,0,.89);
    g.box(x,y+(arm?-.07:-.30),z+(arm?-.29:.62),w*.97,h*.59,l*.87,arm?ceramic:shell,0,0,.89);
    return;
  }
  const stride=Math.sin(phase);
  const lift=arm?0:Math.max(0,stride)*.13;
  g.box(x,y+lift,z+stride*.16,w,h,l,tint,0,0,stride*.74,0,.88);
  g.box(x,y-h*.58+lift,z+stride*.30+.05,w*.83,h*.63,l*.89,arm?ceramic:steel,0,0,stride*.77+.28);
  g.box(x,y-h*.88+lift,z+stride*.35+.01,w*.87,.12,arm?l*.86:l*1.65,arm?black:shell);
}
function powerAura(g,glow,p,z,time){
  if(p.shield>0){
    const y=p.y+.90;
    for(let i=0;i<14;i++){
      const a=i*Math.PI/7+time*.91;
      const x=p.x+Math.cos(a)*.89;
      g.box(x,y+Math.sin(a)*1.05,z+.29+Math.sin(a*2)*.27,.22,.049,.058,teal,3,0,0,a+1.57);
    }
    glow.plane(p.x,y,z+.39,2.4,2.75,[.14,.42,.57],5,true);
  }
  if(p.magnet>0){
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7+time*4;
      g.diamond(p.x+Math.cos(a)*.87,p.y+.49+Math.sin(a)*.25,z+Math.sin(a)*.7,.055,.08,pink,a);
    }
    glow.plane(p.x,.035,z,2.6,3.15,pink,4);
  }
}
export function runnerModel(g,glow,p,z,time,ready){
  const slide=p.slide>0 && p.y<.3;
  const swing=ready?.3:time*13;
  const bob=ready?Math.sin(time*2)*.045:Math.sin(swing*2)*.035;
  const pose={...p,y:p.y+bob};
  glow.plane(p.x,.019,z,1.91,2.04,[.076,.16,.19],4);
  g.plane(p.x,.024,z,.85,.82,[.013,.012,.023],0);
  const torso=slide?.57:1.22;
  const head=slide?.72:1.72;
  bodyPart(g,pose,torso,z-.04,.59,.60,.41,coat,slide?.99:-.10,0,.88);
  bodyPart(g,pose,torso-.30,z,.45,.27,.34,black,slide?.89:0);
  bodyPart(g,pose,head,z-.09,.47,.43,.45,shell,slide?.27:-.09,0,.73);
  bodyPart(g,pose,head+.006,z+.129,.38,.108,.046,black,0);
  bodyPart(g,pose,head+.005,z+.157,.29,.042,.026,amber,0,3);
  bodyPart(g,pose,torso+.02,z+.232,.40,.45,.16,steel,slide?.11:0,0,.93);
  bodyPart(g,pose,torso+.063,z+.321,.31,.2,.028,[.085,.13,.17]);
  bodyPart(g,pose,torso+.102,z+.342,.25,.026,.018,teal,0,3);
  bodyPart(g,pose,torso-.08,z+.338,.23,.063,.018,amber,0,3);
  for(const side of [-1,1]){
    const phase=swing+(side===1?Math.PI:0);
    limb(g,p.x+side*.365,p.y+(slide?.40:1.18),z-.01,.17,.35,.17,side===1?coat:ceramic,phase,true,slide);
    limb(g,p.x+side*.175,p.y+(slide?.43:.62),z,.23,.43,.23,black,phase+Math.PI,false,slide);
  }
  if(ready){
    glow.plane(p.x,1.08,z+.43,1.96,2.53,[.36,.35,.16],5,true);
    glow.plane(p.x,.030,z-1.2,2.05,4.6,[.37,.43,.27],4);
  }
  powerAura(g,glow,p,z,time);
}

export function trailModel(g,glow,particles){
  for(const p of particles){
    const fade=p.life/p.max;
    if(fade<.06) continue;
    const size=p.size*(.4+fade*.6);
    if(p.rain) {
      glow.plane(p.x,p.y,p.z,.025,size*8,[.21,.39,.55],5,true);
    } else {
      g.box(p.x,p.y,p.z,size,size,size*(p.long?4:1),p.color,3,0,.16);
    }
  }
}
