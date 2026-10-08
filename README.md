# 蘆光守夜 · Reedlight

An original, lightweight Traditional Chinese survival roguelite. A small lantern-carrying duck stands against a woodland fog horde.

## Play
WASD or arrow keys to move; Space to dodge; P or Escape to pause. Shooting is automatic. Collect gold experience seeds, choose one of three upgrades, and build weapon evolutions. Mobile includes a left joystick and right dodge button. Switching tabs pauses the game.

The boss appears at 2:30. Defeat it to win. At 3:30 the light fades and the run ends. Daily mode uses the UTC calendar date as a deterministic seed. Personal records and evolution achievements are stored locally with defensive parsing; failed storage never blocks play. Runs themselves are not resumed after refresh.

## Original art and sound
All duck, enemy, forest, lantern, particle, and UI visuals are original Canvas/CSS procedural artwork included in app.mjs and style.css. No external fonts, models, textures, artwork, or music are required. Optional sound uses synthesized Web Audio tones. The user's advertisement reference informed the broad survival-shooter mechanic only; no branding, assets, characters, or award claims were copied. This implementation uses stylized 2.5D drawing, not a GLB/3D engine.

## Run locally
Serve this directory with any static HTTP server, e.g. `python3 -m http.server 8000`. Open http://localhost:8000. No build or dependencies.

## Test
`node --test *.test.mjs`

The deterministic engine is independent of rendering, enabling legal-input full-run simulation and focused collision, progression, cap, and reset tests. See TESTING.md for verification and its limits.
