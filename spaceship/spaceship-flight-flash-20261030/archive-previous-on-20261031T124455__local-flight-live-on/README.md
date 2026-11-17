# AeroSpatiale Flight Test // Pad 04

A high-performance interactive 3D web experience built with Three.js and Vite, featuring a small spaceship ready on a landing pad, liftoff sequence, local test flight circuit, and vertical landing.

## Features

- **Detailed 3D Spaceship**:
  - Aerodynamic fuselage with cockpit canopy, pilot seat silhouette, and glowing interior HUD dash.
  - Swept wings with vertical stabilizers and navigation lighting (port red, starboard green, flashing dorsal strobe).
  - Dual ion/rocket thrusters with dynamic plasma exhaust plumes, throttle-linked scale/opacity, and particle exhaust trail.
  - Downward landing spotlight casting an illuminated landing cone on the pad.
  - Articulated 3-point landing gear (nose gear + dual main landing struts) that physically retract on liftoff and deploy on approach.

- **Well-Lit Daytime Environment & Scenery**:
  - High-resolution procedural landing pad with hazard chevrons, guidance concentric circles, center crosshair target, and "PAD 04" designation.
  - 24 pulsing perimeter LED runway lights.
  - 4 heavy-duty floodlight towers illuminating the pad.
  - Service umbilical gantry tower with safety beacon.
  - Spaceport Flight Control Tower with observation cupola and rotating radar dish.
  - Cryogenic spherical fuel storage tanks and connecting pipelines.
  - Solar panel array farm with procedural photovoltaic textures.
  - Distant mountain ridges and mesas providing depth perception and speed cues.
  - Sunny daytime sky dome with gradient atmospheric scattering and soft cumulus clouds.
  - Glowing 3D flight trajectory curve visualizing the test circuit path.

- **Flight Dynamics & Sequence**:
  1. `READY ON PAD`: Ship idling on landing pad with soft engine hum.
  2. `TAKEOFF SPOOL`: Engine revs to 100% thrust, airframe vibration, thruster flare.
  3. `VERTICAL ASCENT`: Lifts vertically to hover altitude; landing gear retracts with servo sound.
  4. `CIRCUIT FLIGHT`: Navigates local 3D Catmull-Rom spline circuit around landmarks with authentic aerodynamic banking into turns.
  5. `APPROACH & HOVER`: Aligns smoothly with pad center at altitude 7m; landing gear deploys.
  6. `VERTICAL DESCENT`: Feather-soft touchdown descent onto pad shock absorbers.
  7. `TOUCHDOWN`: Damped bounce on contact; thrusters return to idle; status updates to "LANDING COMPLETE".

- **Visibility & Camera Controls**:
  - **Track Ship (Default)**: Keeps the spaceship centered with dynamic framing while allowing free orbit and zoom.
  - **Chase Cam**: Dynamic cockpit/tail camera behind the ship with velocity-lag smoothing.
  - **Tower Cam**: Panoramic vantage point from the Spaceport Flight Control Tower observation deck.
  - **Pad Orbit**: Free camera centered on the landing pad.
  - **On-Screen Camera Controls**: Zoom In (`+`), Zoom Out (`−`), Orbit Left (`↶`), Orbit Right (`↷`), Reset View (`⟲`).

- **Responsive Desktop & Mobile HUD**:
  - Live telemetry: Airspeed (km/h), Altitude (m), Vertical Speed (m/s), Pad Distance (m), Engine Thrust (%).
  - Primary Action Button: "Initiate Takeoff", "Return & Land Now", "Re-launch Circuit".
  - Speed Multiplier: 0.5x (slow-motion cinematic), 1.0x (normal), 2.0x (fast).
  - Web Audio API Sound Synthesizer: Procedural engine hum, thruster roar, gear servos, and telemetry chimes (zero external assets).

## Development & Build

```bash
# Run local dev server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```
