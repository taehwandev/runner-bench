import { clamp, smooth } from './timeline.js';

export class FilmSound {
  muted = false;

  start() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    if (!this.context) this.build(new Context());
    this.context.resume().catch(() => {});
  }

  build(context) {
    this.context = context;
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0;
    master.connect(compressor).connect(context.destination);
    this.master = master.gain;

    const noise = context.createBuffer(1, 4 * context.sampleRate, context.sampleRate);
    let seed = 60809;
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const layer = (type, hz, q) => {
      const filter = context.createBiquadFilter(), gain = context.createGain();
      filter.type = type;
      filter.frequency.value = hz;
      filter.Q.value = q;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      return { filter, volume: gain.gain };
    };
    this.wind = layer('bandpass', 470, .47);
    this.rail = layer('lowpass', 230, .8);
    this.steam = layer('bandpass', 1330, .69);

    const tone = (type, hz, volume, destination) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = hz;
      gain.gain.value = volume;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      return { pitch: oscillator.frequency, volume: gain.gain };
    };
    const soft = context.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 380;
    soft.Q.value = .18;
    soft.connect(master);
    this.engine = tone('triangle', 38, 0, soft);
    this.music = [55, 82.4, 130.8, 164.8].map(hz => tone('sine', hz, 0, soft));
    source.start();
  }

  update(t, train, playing) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const set = (param, value, delay = .055) => param.setTargetAtTime(value, now, delay);
    const pace = clamp(train.speed / 52);
    const fade = smooth((60 - t) / 3.5) * smooth((t + .2) / 1.15);
    const tunnel = train.inTunnel;
    const braking = smooth((t - 24) / 2.5) * smooth((30.7 - t) / 1.55);
    const clack = (.5 + .5 * Math.cos(train.distance * Math.PI / 2.35)) ** 5;
    set(this.master, playing && !this.muted ? .77 * fade : 0, .026);
    set(this.wind.volume, tunnel ? .045 : .058 + .068 * pace);
    set(this.rail.volume, (.09 + .165 * clack) * pace * (tunnel ? 1.62 : 1), .017);
    set(this.rail.filter.frequency, 160 + 285 * pace);
    set(this.steam.volume, .028 + .115 * braking + (train.atStation ? .088 : .018) * (1 + .3 * Math.sin(6.3 * t)));
    set(this.engine.pitch, 30 + train.speed * .75);
    set(this.engine.volume, .036 + pace * .05);
    const turn = smooth((t - 33) / 7), night = smooth((t - 47) / 8);
    const notes = [55, 82.406, 130.81 - 7.34 * turn, 164.81 + 9.81 * night];
    this.music.forEach((voice, i) => {
      set(voice.pitch, notes[i], .3);
      set(voice.volume, (.041 - i * .006) * (1 + .24 * Math.sin(t * (.74 + i * .23) + i)) * (tunnel ? .52 : 1));
    });
  }
}
