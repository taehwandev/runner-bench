import {motion} from './route.js';
const tau=2*Math.PI;
const bells=[[24.9,392],[25.64,493.88],[30.45,329.63],[31.15,392],[33.2,493.88],[46.3,246.94],[53.6,293.66]];
// The soundtrack has a sample address for every film time, including after a seek.
function compose(ctx){
 const rate=22050,buffer=ctx.createBuffer(1,rate*60,rate),out=buffer.getChannelData(0);
 let seed=31971,wind=0,rumble=0,old=0,motorPhase=0;
 const notes=[146.83,164.81,130.81,123.47,146.83,110];
 for(let i=0;i<out.length;i++){
   const t=i/rate,m=motion(t),v=m.speed/36;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const noise=seed/2147483648-1;wind+=(noise-wind)*.024;rumble+=(noise-rumble)*.0055;
   const rail=m.distance%8.5;
   const beat=(Math.exp(-rail*4.2)+.7*Math.exp(-Math.abs(rail-1.32)*5.6))*v;
   motorPhase+=(37+v*15)/rate;
   let s=(wind*(.14+v*.20)+rumble*(.9+v*.65))*(.83+.17*Math.sin(t*.79));
   s+=Math.sin(tau*motorPhase)*(.021+.032*v)+beat*(noise*.055+Math.sin(tau*t*87)*.105);
   const k=Math.min(5,Math.floor(t/10)),u=t/10-k, env=Math.sin(Math.PI*u)**.75;
   s+=env*.035*(Math.sin(tau*t*notes[k]*.5)+.63*Math.sin(tau*t*notes[k]*1.499));
   for(const [start,freq] of bells){const a=t-start;if(a>=0&&a<4.4)s+=.057*(1-Math.exp(-a*50))*Math.exp(-a*1.21)*(Math.sin(tau*a*freq)+.33*Math.sin(tau*a*freq*2.71));}
   for(const start of [4.3,34.6,50.2]){
     const a=t-start;if(a>=0&&a<2.8)s+=.044*Math.sin(Math.PI*a/2.8)**1.4*(Math.sin(tau*110*a)+.64*Math.sin(tau*138.6*a)+.35*Math.sin(tau*220.4*a));
   }
   old+=((s-old)*(m.inTunnel?.16:.68));
   out[i]=old*Math.min(1,t/.6,(60-t)/2.4);
 }return buffer;
}
export class Soundtrack{
 muted=false;
 unlock(){
   if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
     this.ctx=new Audio();this.gain=this.ctx.createGain();this.gain.connect(this.ctx.destination);this.gain.gain.value=this.muted?0:.84;
     this.buffer=compose(this.ctx);
   }
   this.ctx.resume().catch(()=>{});
 }
 play(t){
   this.stop();if(!this.ctx||t>=60)return;
   this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.gain);this.source.start(0,t);
 }
 stop(){if(this.source){this.source.stop();this.source.disconnect();this.source=null;}}
 toggle(){this.muted=!this.muted;if(this.gain)this.gain.gain.setTargetAtTime(this.muted?0:.84,this.ctx.currentTime,.016);}
}

