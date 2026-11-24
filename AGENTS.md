# Repository Guidelines

## Project Structure & Module Organization

This is a mobile RPG prototype using Phaser, TypeScript, Vite, and Capacitor for Android. `src/main.ts` initializes the game and opens `src/scenes/TitleScene.ts`; `src/scenes/GameScene.ts` coordinates input, movement, and combat for one run. Keep character behavior in `src/entities/`, enemy AI and combat effects in `src/combat/`, touch controls and HUD in `src/ui/`, map layout, path-finding, interactable spots and placeholder graphics in `src/world/`, and dialogue text in `src/story/`. `src/world/maps.ts` defines maps and exits; `village.ts` renders village terrain, with placement and footprints in `villageLayout.ts`. See `docs/rowen-village.md` for the north village and square layout. Shared gameplay constants belong in `src/config.ts`.

The active hero uses whole-character sheets in `src/assets/hero/academy/`, rendered by `src/entities/HeroSprite.ts`; `heroFrames.ts` controls direction and timing. `tools/build_hero_frames.py` generates the frame and anchor data under `src/assets/hero/academy/`. Regression checks live in `tools/*.test.mjs`.

## Build, Test, and Development Commands

Run commands from the repository root. Use Node.js 24, matching CI:

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite on port 5173 with network access enabled.
- `npm run typecheck`: check strict TypeScript types without emitting files.
- `npm test`: run the regression checks in `tools/*.test.mjs` (requires Node.js 24 or later).
- `npm run build`: typecheck and build production files into `dist/`.
- `npm run build:single`: typecheck and bundle a single HTML build into `dist-single/`.
- `npm run preview`: serve the production build for local inspection.
- `npm run test:browser`: run gameplay checks in headless Chromium; requires `chromium` on PATH or `CHROMIUM_PATH` pointing to its executable. The script starts its own Vite server and temporary browser profile.
- `npm run android:sync`: build the web app and sync it into the Capacitor Android project.
- `npm run android:apk`: sync and build a debug APK; requires an Android SDK and Java 21 (the version used in CI). Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The displayed app version comes from `package.json` through Vite's `__APP_VERSION__` definition; update that single source when changing the version.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, single-quoted strings, semicolons, and ES module imports. Use PascalCase for classes and their files (`HeroSprite.ts`), camelCase for functions, properties, and utility modules (`walkArea.ts`), and uppercase snake case for shared constants. Preserve strict typing and keep tuning values in `src/config.ts`. No formatter or lint script is configured; match surrounding code.

## Testing Guidelines

Run `npm test` on Node.js 24 or later for movement, combat timing, blade collision, and path-finding regression checks. These use the built-in Node.js test runner; no coverage threshold is configured. CI runs the same command before building the APK. Run typechecking and the relevant build before submitting. Manually verify changed gameplay in the browser: WASD/arrow movement, Space/J attacks, Shift/K dodges, and touch joystick/buttons. Use `?debug` to inspect walkable bounds. For animation changes, inspect idle, walking, all three combo attacks, and dodging.

In the development server, `?map=village`, `?map=village-north`, or `?map=south-field` skips the title screen for focused gameplay checks. `window.__game` is exposed only in development. Browser checks run separately from `npm test`; use them for changes affecting scene behavior, rendering, or interaction.

## Asset Workflow

Village source art lives in `src/assets/village/`. After replacing house/prop sheets, run `python3 tools/build_village_frames.py`; inspect start view, wall/trunk collision, depth order, and camera edges. Ground art must not bake in solid objects whose collision is placed separately.

For the active hero, run `python3 tools/build_hero_frames.py` after changing measured frame/foot/blade anchors. Keep source sheets intact and inspect all eight walking directions, all six attack directions, and dodge. Source attribution is in `src/assets/hero/academy/README.md`.

Keep generated build directories out of commits.

Asset generators using `PIL` require Python and Pillow. `python3 tools/build_map_art.py` regenerates runtime WebP map backgrounds from source PNGs; preserve the source composition. Keep terrain separate from solid props so collision and depth ordering match the displayed objects.

## Character Jobs

Whenever you design or add a character who fights in the game — an ally (companion, fighting NPC) or an enemy of upper rank or above (상급 이상: commanders, bosses, heirs, named rivals) — always recommend a job for it from `src/entities/jobs.ts` / `docs/jobs.md` (base job and likely advancement branch, with a one-line reason tied to its story and fighting style), and note which combat art it would need. Recommend jobs only for characters who need to fight; people who never fight (villagers, shopkeepers, story-only characters) and low/mid-rank minions get none.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as “Fix doubled upper arms” and “Add dodge button.” Follow that pattern and keep commits focused. PRs should explain behavior changes, list validation performed, link relevant issues, and include screenshots or short recordings for visual or gameplay changes.
