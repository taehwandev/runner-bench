# runner-bench

Six playable 3D neon-night-city endless runners (portrait phone screen, Three.js from a CDN), built on 2026-11-15 from one prompt by three AI models, each once with Moru and once without ("raw"). One run per build, so this is a reference, not a ranking.

The folders are the generated output, kept byte-for-byte as the models left them. Nothing was edited, split or cleaned up afterwards.

Conditions: medium reasoning, empty folder, 45-minute limit.

| Model | With Moru | Without Moru |
|---|---|---|
| Opus 5.5 | `moru-opus/` NIGHT LINE, 41m13s, $8.53 | `raw-opus/` NEON NIGHTRUN, 33m43s, $6.38 |
| Sol 6.1 | `moru-sol/` AFTER HOURS, 15m52s | `raw-sol/` AFTERHOURS, 8m19s |
| Gemini 4 Carbon | `moru-carbon/` NEON OVERDRIVE, 22m42s | `raw-carbon/` NEON RUSH, 30m59s |

Only Opus reported a cost. Token counters differ per CLI, so do not compare them across models.

Play: swipe on a phone (left/right lanes, up jump, down slide), or ← → ↑ ↓ / A D W S / Space on a keyboard. Needs internet for Three.js.

Play them on the showcase page: https://getmoru.com/runner
