# Aster — Departure Lab

A browser-local Three.js experience set at a sunny coastal spaceport.

- `npm install`
- `npm run dev` starts the local development server.
- `npm run build` creates the production site in `dist/`.
- `npm test` verifies the circular path, continuous one-way departure and pause/resume/replay timing.

Click **Begin departure** for a 24-second lap followed by a 22-second departure stage. The ship continues onward after the sequence completes. The camera follows its position while preserving the user's orbit and zoom. Reset restores the camera without restarting the flight. Use **Pause** to freeze the flight and its progress while keeping camera controls available, then **Resume** to continue from the same point. Once the departure stage finishes, **Replay departure** starts the entire flight again at the pad and restores the initial camera. Replaying also clears any paused state.

Drag, pinch, scroll, or use the camera buttons. Keyboard users can focus the scene and use arrow keys and +/−. Ambient hovering respects reduced motion; departure and automatic orbit require an explicit action. WebGL is required, with a reload action provided if initialization fails.

`src/world.js` owns procedural scenery and the ship; `src/flight.js` owns the flight path; `src/main.js` connects the scene, camera and interface. All 3D assets are generated locally. Google Fonts is optional, with system sans-serif fallbacks. No backend, accounts or persistence are needed.
