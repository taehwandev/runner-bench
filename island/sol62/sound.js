import { random } from './island.js';

export function soundtrack() {
  let context, level, sea, lowpass, drone;
  function initialize() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context=new Audio();
    level=context.createGain();
    level.gain.value=0;
    level.connect(context.destination);

    const buffer=context.createBuffer(1,context.sampleRate*8,context.sampleRate);
    const samples=buffer.getChannelData(0);
    const rng=random(80551);
    for (let i=0;i<samples.length;i++) samples[i]=rng()*2-1;
    const wind=context.createBufferSource();
    wind.buffer=buffer;
    wind.loop=true;
    lowpass=context.createBiquadFilter();
    lowpass.type='lowpass';
    lowpass.frequency.value=600;
    const highpass=context.createBiquadFilter();
    highpass.type='highpass';
    highpass.frequency.value=64;
    sea=context.createGain();
    wind.connect(lowpass).connect(highpass).connect(sea).connect(level);
    wind.start();

    drone=context.createGain();
    drone.gain.value=0;
    drone.connect(level);
    for (const [frequency,volume,pan] of [[55,.062,-.26],[82.41,.048,.38],[110,.029,-.04],[164.81,.019,.53],[220,.009,-.42]]) {
      const tone=context.createOscillator();
      const gain=context.createGain();
      const stereo=context.createStereoPanner();
      tone.frequency.value=frequency;
      gain.gain.value=volume;
      stereo.pan.value=pan;
      tone.connect(gain).connect(stereo).connect(drone);
      tone.start();
    }
  }
  return {
    enable() {
      if (!context) initialize();
      if (context?.state === 'suspended') context.resume().catch(()=>{});
    },
    sync(time, shot, playing, muted) {
      if (!context) return;
      const now=context.currentTime;
      const swell=.5+.32*Math.sin(time*1.64)+.18*Math.sin(time*2.79+.5);
      const close=shot===2 ? 1 : .53;
      level.gain.setTargetAtTime(playing && !muted ? Math.min(1,(60-time)*1.75)*.77 : 0,now,.065);
      sea.gain.setTargetAtTime((.10+.16*swell)*close,now,.08);
      lowpass.frequency.setTargetAtTime(280+880*close+410*swell,now,.1);
      drone.gain.setTargetAtTime((.21+.19*Math.sin(time*.19)**2)*Math.min(1,time/3),now,.26);
    }
  };
}
