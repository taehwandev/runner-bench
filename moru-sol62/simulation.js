import {lanes,segmentLength} from './city.js';
import {hazards,pickupColors} from './models.js';

export const runnerZ=1.45;
export const powerDuration={shield:10,magnet:8};
const initial=[
  {d:43, items:[[1,'low']], guide:['↑  JUMP','Catch the chips above the barricade'], trail:[1,2.26]},
  {d:76, items:[[1,'high']], guide:['↓  SLIDE','Duck under the red clearance beam'], trail:[1,.43]},
  {d:110,items:[[1,'car'],[2,'low']], guide:['←  CHANGE LANE','Take the left lane around traffic'], trail:[0,.83,'shield']},
  {d:145,items:[[0,'taxi',1]], guide:['↔  MOVING TRAFFIC','The taxi swerves across two lanes'], trail:[2,.84]},
  {d:181,items:[[0,'tram'],[2,'high']], trail:[1,.85,'magnet']},
  {d:217,items:[[0,'high'],[1,'low']], trail:[1,2.24]},
  {d:251,items:[[0,'car'],[1,'high']], trail:[1,.44]},
  {d:290,items:[[1,'taxi',2]], trail:[0,.82]},
  {d:327,items:[[0,'low'],[2,'car']], trail:[0,2.22]},
  {d:379,items:[[1,'tram'],[2,'low']], trail:[2,2.23,'shield']}
];
const recovered={low:'JUMP CLEAR',high:'SLIDE CLEAR'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createRun(){
  const run={
    distance:0,time:0,speed:15,score:0,combo:1,chain:0,comboLeft:0,
    x:0,y:0,vY:0,lane:1,bank:0,slide:0,shield:0,magnet:0,
    pending:'',pendingLeft:0,impact:0,objects:[],pickups:[],particles:[],
    guides:[],nextRow:0,generated:0,nextDistance:416,stepSound:0,stepDust:0
  };
  for(const d of [10,13,16,19,22]) addPickup(run,1,d,.82);
  fillRun(run);
  return run;
}
function addPickup(run,lane,d,y,type='chip'){
  run.pickups.push({x:lanes[lane],d,y,type,collected:false,pull:false});
}
function addRow(run,row){
  for(const [lane,type,end=lane] of row.items) {
    run.objects.push({x:lanes[lane],lane,end,d:row.d,type,lean:0,done:false,near:false});
  }
  if(row.guide) run.guides.push({d:row.d,text:row.guide});
  if(!row.trail) return;
  const [lane,y,power]=row.trail;
  if(y>1.6){
    addPickup(run,lane,row.d-4.2,1.73);
    addPickup(run,lane,row.d-.35,y,power);
    addPickup(run,lane,row.d+4,1.75);
  } else if(y<.6) {
    addPickup(run,lane,row.d-3.1,y);
    addPickup(run,lane,row.d+.3,y,power);
    addPickup(run,lane,row.d+3.6,y);
  } else {
    for(const offset of [-8,-4,0,4,8]) addPickup(run,lane,row.d+offset,y,offset===-4?power:undefined);
  }
}
function proceduralRow(run){
  let d=run.nextDistance;
  const serial=run.generated++;
  const progress=Math.min(1,d/2900);
  const side=Math.random()<.5?0:2;
  const open=Math.floor(Math.random()*3);
  const blocked=[0,1,2].filter(l=>l!==open);
  const first=blocked[0],second=blocked[1];
  const mover=serial%7===3;
  const railIndex=Math.floor(d/segmentLength);
  const isRail=[3,8].includes(railIndex%10) && Math.abs(d-(railIndex*segmentLength+29))<8;
  const kind=isRail?'tram':'car';
  const action=Math.random()<.5?'low':'high';
  let items,trail;
  const power=serial%8===2?'shield':serial%8===6?'magnet':undefined;
  if(mover){
    items=[[side,'taxi',1]];
    trail=[2-side,.84,power];
  } else if(serial%6===4 || Math.random()<.16+.30*progress){
    if(isRail) d=railIndex*segmentLength+29;
    items=[[first,kind],[second,action]];
    trail=[second,action==='low'?2.25:.43,power];
  } else {
    items=[[first,action],[second,progress>.42?'high':kind]];
    trail=[first,action==='low'?2.25:.43,power];
  }
  // Row spacing is measured in seconds at the projected speed. A player can
  // finish a jump or slide and traverse two lanes before the next collision.
  const spacing=(15+17*(1-Math.exp(-d/1150)))*(1.90-.55*progress);
  run.nextDistance=d+spacing+Math.random()*6.5;
  return {d,items,trail};
}
export function fillRun(run){
  while(run.nextRow<initial.length && initial[run.nextRow].d<run.distance+135) addRow(run,initial[run.nextRow++]);
  while(run.nextRow===initial.length && run.nextDistance<run.distance+135) addRow(run,proceduralRow(run));
}
export function move(run,action,emit){
  if(action==='left' || action==='right'){
    const target=clamp(run.lane+(action==='left'?-1:1),0,2);
    if(target!==run.lane){run.lane=target;emit('step');}
    return;
  }
  if(action==='jump' && run.y<=.001 && run.slide<=0){
    run.vY=7.85;
    run.y=.001;
    run.pending='';
    emit('jump');
  } else if(action==='slide' && run.slide<=0 && run.y<=.05){
    run.slide=.79;
    run.pending='';
    emit('slide');
  } else {
    if(action==='slide' && run.y>.05) run.vY=Math.min(-7,run.vY);
    run.pending=action;
    run.pendingLeft=.16;
  }
}
function updatePlayer(run,dt,emit){
  const target=lanes[run.lane];
  const error=target-run.x;
  run.x+=error*(1-Math.exp(-dt*16));
  run.bank+=(clamp(-error*.14,-.35,.35)-run.bank)*(1-Math.exp(-dt*13));
  run.slide=Math.max(0,run.slide-dt);
  if(run.y>0 || run.vY>0){
    run.y+=run.vY*dt;
    run.vY-=21.1*dt;
    if(run.y<=0){
      run.y=run.vY=0;
      burst(run,run.x,.13,runnerZ,[.23,.45,.5],7);
      emit('land');
    }
  }
  if(run.pending){
    run.pendingLeft-=dt;
    if(run.pendingLeft<=0) run.pending='';
    else if(run.y===0 && run.slide===0) move(run,run.pending,emit);
  }
}
export function burst(run,x,y,z,color,count,long=false){
  for(let i=0;i<count && run.particles.length<160;i++){
    const max=.24+Math.random()*.38;
    run.particles.push({x,y,z,vx:(Math.random()-.5)*4.6,vy:Math.random()*3.8,
      vz:.8+Math.random()*3.9,life:max,max,size:.035+Math.random()*.072,color,long});
  }
}
function reward(run,points,boost){
  if(boost){
    run.chain++;
    run.combo=Math.min(8,1+run.chain);
    run.comboLeft=4.6;
  }
  const value=points*run.combo;
  run.score+=value;
  return value;
}
function updatePickups(run,dt,emit){
  const body=run.y+(run.slide>0?.39:.79);
  for(const p of run.pickups){
    if(p.collected) continue;
    const lead=p.d-run.distance;
    if(lead< -2 || lead>17) continue;
    if(run.magnet>0 && p.type==='chip' && lead<8.5) p.pull=true;
    if(p.pull){
      const pace=1-Math.exp(-dt*10);
      p.x+=(run.x-p.x)*pace;
      p.y+=(body-p.y)*pace;
      if(lead>2) p.d-=dt*7;
    }
    if(Math.abs(lead)>1.14 || Math.abs(run.x-p.x)>.65 || Math.abs(body-p.y)>(p.type==='chip'?.73:.92)) continue;
    p.collected=true;
    burst(run,p.x,p.y,runnerZ,pickupColors[p.type],p.type==='chip'?5:18);
    const points=reward(run,p.type==='chip'?28:110,false);
    if(p.type==='chip') emit('chip',points);
    else {
      run[p.type]=powerDuration[p.type];
      emit(p.type,points);
    }
  }
}
export function movingPose(o,distance){
  if(o.type!=='taxi') return;
  const progress=clamp((distance-o.d+33)/27,0,1);
  const curve=.5-.5*Math.cos(Math.PI*progress);
  o.x=lanes[o.lane]+(lanes[o.end]-lanes[o.lane])*curve;
  o.lean=(o.end-o.lane)*Math.sin(Math.PI*progress)*.16;
}
function updateHazards(run,previous,emit){
  for(const o of run.objects){
    const ahead=o.d-run.distance;
    if(ahead>58 || o.done) continue;
    movingPose(o,run.distance);
    const spec=hazards[o.type];
    const span=spec.depth/2+.26;
    const xgap=Math.abs(run.x-o.x), width=spec.width/2+.29;
    const vertical=o.type==='low'?run.y>.62:o.type==='high'?(run.slide>0 && run.y<.19):false;
    if(ahead<=span && o.d-previous>=-span){
      if(xgap<width && !vertical){
        o.done=true;
        run.impact=1;
        burst(run,run.x,run.y+.9,runnerZ,[1.56,.35,.10],28,true);
        run.chain=0; run.combo=1; run.comboLeft=0;
        if(run.shield>0){ run.shield=0; emit('break'); continue; }
        emit('crash',o.type);
        return false;
      }
      if((vertical && xgap<width) || (xgap>=width && xgap<(o.type==='low'||o.type==='high'?2.4:2.76))) {
        o.near=true;
        if(vertical && xgap<width) o.clear=recovered[o.type];
      }
    }
    if(ahead< -span){
      o.done=true;
      if(o.near){
        emit('near',{points:reward(run,o.clear?105:75,true),label:o.clear||'NEAR MISS'});
        burst(run,run.x,run.y+.72,runnerZ,[.13,1,.66],9,true);
      }
    }
  }
  return true;
}

export function advance(run,dt,emit){
  run.time+=dt;
  run.speed=15+17*(1-Math.exp(-run.distance/1150));
  const previous=run.distance;
  run.distance+=run.speed*dt;
  run.score+=run.speed*dt*(1+run.combo*.17);
  for(const timer of ['shield','magnet','comboLeft']) run[timer]=Math.max(0,run[timer]-dt);
  if(run.comboLeft<=0){run.chain=0;run.combo=1;}
  updatePlayer(run,dt,emit);
  fillRun(run);
  run.objects=run.objects.filter(o=>o.d>run.distance-15);
  run.pickups=run.pickups.filter(p=>!p.collected && p.d>run.distance-5);
  run.guides=run.guides.filter(o=>o.d>run.distance-4);
  updatePickups(run,dt,emit);
  if(!updateHazards(run,previous,emit)) return false;
  run.stepSound+=dt;
  run.stepDust+=dt;
  if(run.y<.04 && run.stepSound>(run.slide>0?.14:.24)){
    run.stepSound=0;
    emit(run.slide>0?'skid':'foot');
  }
  if(run.y<.04 && run.stepDust>(run.slide>0?.042:.14)){
    run.stepDust=0;
    burst(run,run.x+(Math.random()-.5)*.40,.07,runnerZ+.2,run.slide>0?[.83,.26,.07]:[.12,.27,.32],run.slide>0?3:1,true);
  }
  return true;
}

export function updateParticles(run,dt,ambient){
  if(ambient && run.particles.length<100 && Math.random()<dt*39){
    const max=.62+Math.random()*.68;
    run.particles.push({x:(Math.random()-.5)*18,y:1+Math.random()*7,z:-8-Math.random()*27,
      vx:-.36,vy:-4.5,vz:run.speed*.67,life:max,max,size:.08+Math.random()*.14,rain:true});
  }
  for(const p of run.particles){
    p.life-=dt;
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    p.z+=p.vz*dt;
    if(!p.rain) p.vy-=5.2*dt;
  }
  run.particles=run.particles.filter(p=>p.life>0 && p.y>0);
  run.impact=Math.max(0,run.impact-dt*2.7);
}
