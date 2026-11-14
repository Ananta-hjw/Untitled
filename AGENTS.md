# Repository Guidelines

## Project Structure & Module Organization

This is a mobile RPG prototype using Phaser, TypeScript, and Vite. `src/main.ts` initializes the game; `src/scenes/GameScene.ts` coordinates input, movement, and combat for one run. Keep character behavior in `src/entities/`, enemy AI and combat effects in `src/combat/`, touch controls and HUD in `src/ui/`, map layout, path-finding, interactable spots and placeholder graphics in `src/world/`, and dialogue text in `src/story/`. The active starting map is `village.ts`, with placement and footprints in `villageLayout.ts`. Shared gameplay constants belong in `src/config.ts`.

The active hero uses whole-character sheets in `src/assets/hero/academy/`, rendered by `src/entities/HeroSprite.ts`; `heroFrames.ts` controls direction and timing. `tools/build_hero_frames.py` generates the frame and anchor data under `src/assets/hero/academy/`. Regression checks live in `tools/*.test.mjs`.

## Build, Test, and Development Commands

Run commands from the repository root:

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite on port 5173 with network access enabled.
- `npm run typecheck`: check strict TypeScript types without emitting files.
- `npm test`: run the regression checks in `tools/*.test.mjs` (requires Node.js 24 or later).
- `npm run build`: typecheck and build production files into `dist/`.
- `npm run build:single`: typecheck and bundle a single HTML build into `dist-single/`.
- `npm run preview`: serve the production build for local inspection.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, single-quoted strings, semicolons, and ES module imports. Use PascalCase for classes and their files (`HeroSprite.ts`), camelCase for functions, properties, and utility modules (`walkArea.ts`), and uppercase snake case for shared constants. Preserve strict typing and keep tuning values in `src/config.ts`. No formatter or lint script is configured; match surrounding code.

## Testing Guidelines

Run `npm test` on Node.js 24 or later for movement, combat timing, blade collision, and path-finding regression checks. These use the built-in Node.js test runner; no coverage threshold is configured. CI runs the same command before building the APK. Run typechecking and the relevant build before submitting. Manually verify changed gameplay in the browser: WASD/arrow movement, Space/J attacks, Shift/K dodges, and touch joystick/buttons. Use `?debug` to inspect walkable bounds. For animation changes, inspect idle, walking, all three combo attacks, and dodging.

## Asset Workflow

Village source art lives in `src/assets/village/`. After replacing house/prop sheets, run `python3 tools/build_village_frames.py`; inspect start view, wall/trunk collision, depth order, and camera edges. Ground art must not bake in solid objects whose collision is placed separately.

For the active hero, run `python3 tools/build_hero_frames.py` after changing measured frame/foot/blade anchors. Keep source sheets intact and inspect all eight walking directions, all six attack directions, and dodge. Source attribution is in `src/assets/hero/academy/README.md`.

Keep generated build directories out of commits.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as “Fix doubled upper arms” and “Add dodge button.” Follow that pattern and keep commits focused. PRs should explain behavior changes, list validation performed, link relevant issues, and include screenshots or short recordings for visual or gameplay changes.
