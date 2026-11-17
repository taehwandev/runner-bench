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

## rocket/

Twenty builds from the earlier browser 3D rocket test, kept as the models left them (only tool state such as `.moru`, `.git` and `tests/` was left out). Ten stages, each built once with Moru (`-on`) and once without (`-off`), switching models between stages: stages 1-5 are a rocket launch scene and stages 6-10 add a Moon round trip, booster reuse and game elements.

| Stage | Model |
|---|---|
| 1, 4, 6, 9 | Claude Haiku |
| 2, 5, 7, 10 | GPT-6.1 Terra |
| 3, 8 | Gemini |

Folders are named `rocket/stage<N>-<model>-<on|off>/`. Each has an `index.html`; Three.js loads from a CDN. One run per cell, so treat the results as a reference.

## city-arena/

The first two rounds of the 3D neon-city test, taken out of the Moru report and kept here byte for byte. `arena-34-arms.json` holds the 34 phase-1 builds (17 models, with and without Moru, with each build's source, compiled script and HTML shell). `phase-two-arms.json` holds the six phase-2 patch runs. `phase-one-manifest.json` lists the builds with their hashes, and `SHA256SUMS` lets you check the files (the phase-1 bundle hash matches `bundleSha256` in the manifest). These are static code checks from the time, not a full quality assessment of the output.
