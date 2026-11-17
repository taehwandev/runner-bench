# Skyport Pad 1: spaceship departure

A small interactive 3D scene. A spaceship hovers over a landing pad. Press **Launch**
and it makes one slow lap around the pad, then flies off into the distance while the
camera follows. It does not come back until you press **Replay**.

## Run

The page uses ES modules, so it must be served over HTTP (opening `index.html`
directly from disk will not load the scripts).

```sh
npm run serve      # python3 -m http.server 8080
# then open http://localhost:8080
```

Three.js 0.160 is loaded from jsDelivr, so the page needs internet access on first load.

## Controls

| Action        | Desktop                           | Touch                    |
| ------------- | --------------------------------- | ------------------------ |
| Orbit         | Left-drag                         | One-finger drag          |
| Zoom          | Scroll wheel, `+` / `−` buttons   | Pinch, `+` / `−` buttons |
| Pan           | Right-drag                        | Two-finger drag          |
| Reset camera  | **Reset camera** button, `R`      | Button                   |
| Launch        | **Launch** button, `L`            | Button                   |
| Replay        | **Replay** button (after departure) | Button                 |

## Layout

```
index.html         markup, import map, controls
style.css          HUD, control bar, responsive rules
js/config.js       tunables and palette (no DOM, no three.js)
js/flight.js       pure flight model: hover → lap → depart → gone
js/world.js        sky, ground, landing pad, scenery, clouds
js/ship.js         spaceship model and per-frame pose/engine visuals
js/exhaust.js      pooled exhaust glow sprites
js/camera-rig.js   OrbitControls, departure follow, reset, zoom
js/ui.js           status text, phase chips, button states
js/main.js         renderer, loop, and wiring
tests/             flight model tests (node:test)
```

## Test

```sh
npm test
```

The flight model is pure logic, so the tests run in Node without a browser.
