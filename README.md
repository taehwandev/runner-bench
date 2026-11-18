# runner-bench

Eight playable 3D neon-night-city endless runners (portrait phone screen), built from one prompt by four AI models, each once with Moru and once without ("raw"): three models on 2026-11-15 (Three.js from a CDN) and Sol 6.2 on 2026-11-18 (plain WebGL). One run per build, so this is a reference, not a ranking.

The folders are the generated output, kept byte-for-byte as the models left them. Nothing was edited, split or cleaned up afterwards.

Conditions: medium reasoning, empty folder, 45-minute limit.

| Model | With Moru | Without Moru |
|---|---|---|
| Opus 5.5 | `moru-opus/` NIGHT LINE, 41m13s, $8.53 | `raw-opus/` NEON NIGHTRUN, 33m43s, $6.38 |
| Sol 6.1 | `moru-sol/` AFTER HOURS, 15m52s | `raw-sol/` AFTERHOURS, 8m19s |
| Gemini 4 Carbon | `moru-carbon/` NEON OVERDRIVE, 22m42s | `raw-carbon/` NEON RUSH, 30m59s |
| Sol 6.2 (added 2026-11-18) | `moru-sol62/` AFTERLIGHT, 26m30s | `raw-sol62/` NIGHT SHIFT, 21m17s |

Sol 6.2 was run on 2026-11-18 with the same prompt and conditions. Both 6.2 builds draw with WebGL directly instead of Three.js, so they need no internet.

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

## spaceship/

Fifty-five builds from the spaceship departure tests, kept as the models left them. Only tool state (`.moru`, `.git`, `node_modules`), logs, screenshots and videos were left out. Folders are `spaceship/<experiment>/<run>/`, where `<experiment>` is the original evaluation folder name and `<run>` is the original run folder (`__` replaces a path separator). Each has an `index.html` (Three.js from a CDN or a bundled `dist/`). `-on` means built with Moru, `-off` without. One run per cell, so treat the results as a reference, not a ranking.

The `on-run1`, `on-run2` and `on-run3` runs of `spaceship-depart-terra-20261101T185800` produced no `index.html`, so there is nothing to upload for them. Runs that were invalid or cut off by a time ceiling in `spaceship-flight-flash-20261030` have no playable build and are not included.

| Experiment | Builds |
|---|---|
| `spaceship-depart-chain-20261101T220332` | 4 |
| `spaceship-depart-clean-chain-20261102T101332` | 12 |
| `spaceship-depart-handoff-20261101T214830` | 4 |
| `spaceship-depart-sol-medium-20261101T201720` | 2 |
| `spaceship-depart-sol-stages-20261101T210735` | 4 |
| `spaceship-depart-terra-20261101T185800` | 1 |
| `spaceship-depart-terra-docker-20261101T193818` | 2 |
| `spaceship-depart-terra-xhigh-20261101T195424` | 2 |
| `spaceship-flight-flash-20261030` | 7 |
| `spaceship-structure-chain-20261103T130714` | 5 |
| `spaceship-structure-rep-20261103` | 9 |
| `spaceship-structure-rerun-20261103T104124` | 1 |
| `spaceship-structure-rerun2-20261103T114404` | 1 |
| `spaceship-structure-rerun3-20261103T123038` | 1 |

Every build folder:

- `spaceship-depart-chain-20261101T220332`: `gemini-stage5-off`, `gemini-stage5-on`, `sol-stage6-off`, `sol-stage6-on`
- `spaceship-depart-clean-chain-20261102T101332`: `stage1-haiku-off`, `stage1-haiku-on`, `stage2-terra-off`, `stage2-terra-on`, `stage3-gemini-off`, `stage3-gemini-on`, `stage4-haiku-off`, `stage4-haiku-on`, `stage5-terra-off`, `stage5-terra-on-rerun2`, `stage6-sol-off-rerun2`, `stage6-sol-on-rerun2`
- `spaceship-depart-handoff-20261101T214830`: `gemini-off`, `gemini-on`, `terra-off`, `terra-on`
- `spaceship-depart-sol-medium-20261101T201720`: `off-run1`, `on-run1`
- `spaceship-depart-sol-stages-20261101T210735`: `off-stage2`, `off-stage3`, `on-stage2`, `on-stage3`
- `spaceship-depart-terra-20261101T185800`: `off-run1`
- `spaceship-depart-terra-docker-20261101T193818`: `off-run1`, `on-run1`
- `spaceship-depart-terra-xhigh-20261101T195424`: `off-run1__project__dist`, `on-run1`
- `spaceship-flight-flash-20261030`: `archive-previous-on-20261031T120850__local-flight-live-on`, `archive-previous-on-20261031T124455__local-flight-live-on`, `archive-previous-on-20261031T125708__local-flight-live-on`, `archive-previous-on-20261031T131312__local-flight-live-on`, `archive-previous-on-20261031T133037__local-flight-live-on`, `archive-previous-on-20261031T134313__local-flight-live-on`, `archive-previous-on-20261031T135352__local-flight-live-on`
- `spaceship-structure-chain-20261103T130714`: `stage2-terra-on`, `stage3-gemini-on`, `stage4-haiku-on`, `stage5-terra-on`, `stage6-sol-on`
- `spaceship-structure-rep-20261103`: `rep1__stage1-haiku-on-rep`, `rep2-chain__stage2-terra-on`, `rep2-chain__stage3-gemini-on`, `rep2-chain__stage4-haiku-on`, `rep2-chain__stage5-terra-on`, `rep2-chain__stage6-sol-on-rerun`, `rep2-chain__stage6-sol-on`, `rep2__stage1-haiku-on-rep`, `rep3__stage1-haiku-on-rep`
- `spaceship-structure-rerun-20261103T104124`: `stage1-haiku-on-structure`
- `spaceship-structure-rerun2-20261103T114404`: `stage1-haiku-on-structure`
- `spaceship-structure-rerun3-20261103T123038`: `stage1-haiku-on-structure`
