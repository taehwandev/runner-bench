# Aero-X1 // Interactive 3D Spaceship Flight Simulator

An interactive 3D web application built with Three.js featuring an aerodynamic small spaceship on a detailed landing pad, liftoff, a local test circuit flight around the spaceport scenery, and a smooth landing back on the pad.

## Features

- **Spaceship Model**:
  - Detailed procedural design with aerodynamic lifting-body fuselage, canopy cockpit with glass reflection, swept wings with canted winglets, dual ion/rocket engine nozzles with glowing interior cores, RCS maneuvering blocks, and 3 retractable shock-absorbing landing gear legs with footpads.
  - Active lighting: Port (red) & Starboard (green) wingtip navigation lights, blinking dorsal anti-collision beacon, dynamic thruster flame plumes and point light.
- **Landing Pad & Spaceport Environment**:
  - Multi-tiered landing pad (LP-01) with concrete surface, high-contrast target markings, hazard chevron perimeter border, 8 pulsing runway guide lights, 4 blast deflector barricades, and floodlight towers.
  - Well-lit daytime lighting: Warm directional sun light casting soft shadows, natural hemisphere sky-ground illumination, and ambient fill light.
  - Spaceport backdrop: Control tower with observation deck and rotating radar dish, arched spacecraft hangars, fuel storage tanks with piping, perimeter rolling hills, and stylized low-poly trees and rocks.
  - Drifting daytime cumulus clouds against a deep-to-horizon blue sky gradient.
- **Flight Mechanics & Local Circuit**:
  - Full flight lifecycle: `READY` &rarr; `TAKEOFF` &rarr; `CIRCUIT FLIGHT` &rarr; `FINAL APPROACH` &rarr; `TOUCHDOWN & SETTLE`.
  - Smooth centripetal Catmull-Rom spline trajectory staying within a tight 40m radius and 12-26m altitude, keeping the craft clearly visible against the spaceport landmarks at all times.
  - Aerodynamic banking: Dynamically computes turning curvature to bank the spaceship into corners.
  - Particle systems: Trailing engine exhaust sparks and ground dust kickup rings during liftoff and landing.
  - Holographic 3D flight trajectory ribbon with waypoint rings.
  - Early abort / Return to Pad option at any point during the circuit.
- **Camera Controls**:
  - **Orbit**: Click/drag (desktop) or touch drag (mobile) with smooth damping.
  - **Zoom**: Mouse wheel, pinch-to-zoom, or on-screen `+` / `−` zoom buttons.
  - **Reset Camera**: One-click button (or `R` key) to smoothly animate back to ideal framing.
  - **Perspective Modes**:
    - **Director**: Intelligently tracks the spaceship throughout the flight while keeping surrounding spaceport scenery framed.
    - **Chase**: Dynamic third-person behind-the-ship perspective following heading and banking.
    - **Tower**: Elevated vantage point from the control tower.
    - **Free Orbit**: Unconstrained orbit and inspection.
- **Responsive Telemetry & Flight Deck**:
  - Real-time digital telemetry: Altitude (m), Speed (km/h), Throttle (%) with dynamic gauge bar, Flight Time, and Waypoint Circuit progress.
  - Flight controls: Initiate Takeoff / Return to Pad, Pause/Resume, Speed multiplier (0.5x, 1.0x, 1.5x), Trajectory Ribbon toggle.
  - Web Audio API synthesizer for engine idle hum, liftoff rocket roar, and touchdown confirmation chimes (with mute toggle).
  - Keyboard shortcuts: `Space` (Launch/Return), `P` (Pause), `R` (Reset Cam), `C` (Cycle Cam), `M` (Mute), `1`/`2`/`3` (Speed).

## Getting Started

```bash
# Run local development server
npm run dev

# Run automated tests
npm test

# Build production distribution
npm run build

# Preview production build
npm run preview
```
