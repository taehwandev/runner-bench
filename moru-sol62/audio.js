export function soundEngine(){
  let ctx, output, noise, muted=false;
  let step=0, beatClock=0;
  function open(){
    if(!ctx){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio) return;
      try {ctx=new Audio();} catch {return;}
      output=ctx.createGain();
      output.gain.value=muted?0:.68;
      const compressor=ctx.createDynamicsCompressor();
      output.connect(compressor).connect(ctx.destination);
      noise=ctx.createBuffer(1,ctx.sampleRate*.4,ctx.sampleRate);
      const wave=noise.getChannelData(0);
      for(let i=0;i<wave.length;i++) wave[i]=Math.random()*2-1;
    }
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
  }
  function mute(value){
    muted=value;
    if(output) output.gain.setTargetAtTime(muted?0:.68,ctx.currentTime,.025);
  }
  function envelope(source,time,length,volume,target=output){
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(volume,time+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    source.connect(gain).connect(target);
    source.start(time);
    source.stop(time+length+.012);
  }
  function tone(from,to,length,volume,type='sine',delay=0){
    const time=ctx.currentTime+delay;
    const oscillator=ctx.createOscillator();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(from,time);
    oscillator.frequency.exponentialRampToValueAtTime(to,time+length);
    envelope(oscillator,time,length,volume);
  }
  function hiss(freq,length,volume){
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter();
    source.buffer=noise;
    filter.type='bandpass';
    filter.frequency.value=freq;
    filter.Q.value=.69;
    filter.connect(output);
    envelope(source,ctx.currentTime,length,volume,filter);
  }
  function play(event,value){
    if(!ctx || muted || ctx.state!=='running') return;
    switch(event){
      case 'foot': hiss(320,.085,.070); break;
      case 'land': tone(83,37,.13,.16); hiss(370,.12,.15); break;
      case 'skid': hiss(1100,.13,.105); break;
      case 'step': hiss(830,.092,.094); break;
      case 'jump': tone(138,318,.19,.115,'triangle'); break;
      case 'slide': tone(239,63,.23,.09,'triangle'); hiss(780,.26,.12); break;
      case 'chip': {
        const note=587.33*[1,1.12,1.33,1.50][Math.floor(value/28-1)%4];
        tone(note,note*1.016,.10,.103,'triangle'); tone(note*1.5,note*1.5,.10,.047,'sine',.035);
        break;
      }
      case 'near':
        tone(330,450,.14,.14,'triangle'); tone(553,724,.18,.093,'sine',.067); break;
      case 'shield':
      case 'magnet':
        for(const [i,n] of [329,440,587,880].entries()) tone(n,n,.28,.095,'triangle',i*.064);
        break;
      case 'break':
      case 'crash':
        tone(97,24,.42,.38,'triangle'); hiss(460,.30,.32); break;
      case 'start':
        step=beatClock=0;
        tone(156,221,.21,.14,'triangle'); tone(392,392,.23,.10,'sine',.09); break;
      case 'district':
        tone(196,196,.3,.10,'triangle'); tone(294,294,.4,.09,'sine',.13); break;
    }
  }
  function beat(dt,speed){
    beatClock-=dt;
    if(beatClock>0) return;
    beatClock+=.245-speed*.0018;
    const tick=step++%16;
    if(!ctx || muted || ctx.state!=='running') return;
    const bass=[55,55,49,65.4][Math.floor(step/16)%4];
    if(tick%4===0) tone(94,37,.14,.19);
    if(tick%4===2) tone(bass,bass,.20,.086,'triangle');
    if(tick%2 || tick===6) hiss(4700,tick%4===3?.045:.072,.049);
    if(tick%8===4) hiss(810,.10,.075);
  }
  return {open,mute,play,beat};
}
