# Verification — 2026-10-08

## Automated checks: 13/13 passed

Run `node --test *.test.mjs` from this directory. Latest complete run took 1.89 seconds in the available Node 24 environment.

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

## Public browser checks

At gameplay commit 1016cd5ba6aae5dc52e8c8261338cfdceda2311a, a full legal public UI run won: UTC daily seed 20261008, 156 seconds, 503 enemies cleared, level 21, evolutions 破曉潮音 and 日輪提燈. Only ordinary keyboard movement, dodge, pause, and displayed upgrade buttons were used; no game-state inspection or mutation. Victory screenshot is included in the source archive's qa folder.

Also verified: desktop artwork, tutorial dismissal, health loss/healing, automatic attacks, XP and successive three-choice upgrade modals, dodge cooldown, keyboard pause (clock frozen at 1:09), resume, fresh restart (100 HP / 00:00 / LV.1), and victory records persisted after refresh (1 win / 156 seconds / 2 evolutions).

Readability follow-ups: trees become translucent near the duck, upgrade cards show the resulting ability level, evolved waves retain their visual rings, charging foes gain danger rings, and short-height home pages can scroll. No engine/balance changes were made after the full UI victory. Narrow iframe viewport validation is pending this follow-up deployment.

No real mobile hardware or numerical browser FPS benchmark is claimed. The automation boundary harness is not a real-browser test; the public UI run above is separate. Browser extension metadata errors were observed, distinct from game scripts.

## Deployment state

The repository was created through the cloud browser at https://github.com/zuestrd20/reedlight-duck-survivor. The initial README commit is bb73a797f9304ff9a4095eb323979ee91c9b170a.

Following fresh owner approval on 2026-10-08, the previously cancelled source-tree upload succeeded. Remote main was verified at commit 1016cd5ba6aae5dc52e8c8261338cfdceda2311a. GitHub Pages settings visibly confirmed “GitHub Pages source saved” and building from main / root.

A transient browser denial was resolved by retrying the identical navigation once with explicit user authorization evidence. GitHub Pages run 37711663586 completed successfully for commit 1016cd5ba6aae5dc52e8c8261338cfdceda2311a. Public URL: https://zuestrd20.github.io/reedlight-duck-survivor/. Public UI verification is in progress; findings will be recorded below before delivery.
