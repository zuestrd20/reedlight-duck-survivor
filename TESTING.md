# Verification — 2026-10-07

## Automated checks: 13/13 passed

Run `node --test *.test.mjs` from this directory. Latest complete run took 3.45 seconds in the available Node 24 environment.

Engine checks:
- Full legal-input runs won with each of the three weapon evolution routes (movement, dodge, and offered upgrade choices only).
- Standing still with utility upgrade selection lost naturally.
- A legal evasive run reached the enforced 210-second loss cap.
- Identical seed and controls reproduced exact state.
- Upgrade pauses froze simulation; invalid or repeated choices were rejected.
- Claimed XP gems did not return; progression and entity bounds were checked throughout runs.
- Fresh runs reset independently, and invalid inputs/long frame deltas were bounded.

UI boundary harness checks:
- Home, field guide, start, drawing calls, keyboard movement, blur pause, visibility pause, resume, exit, and restart.
- Corrupt and disabled local storage did not block play.
- Daily seed stability and virtual joystick cancellation.

Syntax checks: app.mjs and engine.mjs passed `node --check`.

## What these tests do not prove

The UI harness is a lightweight mock DOM/Canvas test, not a real browser. No visual or real-browser full-run pass is claimed. The cloud browser's localhost attempt returned ERR_BLOCKED_BY_CLIENT. Public desktop/narrow layout, touch interaction, rendering performance, audio, and real-browser completion remain unverified.

## Deployment state

The repository was created through the cloud browser at https://github.com/zuestrd20/reedlight-duck-survivor. The initial README commit is bb73a797f9304ff9a4095eb323979ee91c9b170a.

The attempted source tree upload returned “user cancelled MCP tool call.” No alternate upload route was attempted, and publishing is paused pending fresh authorization. GitHub Pages is not enabled and no playable public URL is claimed. The local source archive is the current deliverable/checkpoint.
