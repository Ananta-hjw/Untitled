# Repository Guidelines

## Project Structure & Module Organization

This is a mobile RPG prototype using Phaser, TypeScript, and Vite. `src/main.ts` initializes the game; `src/scenes/GameScene.ts` coordinates input, camera, movement, and combat. Keep character and rig behavior in `src/entities/`, enemy AI in `src/combat/`, touch controls in `src/ui/`, and terrain and placeholder graphics in `src/world/`. Shared gameplay constants belong in `src/config.ts`.

The active hero uses whole-character sheets in `src/assets/hero/academy/`, rendered by `src/entities/HeroSprite.ts`; `heroFrames.ts` controls direction and timing. Legacy hero PNG parts live in `art/hero_parts/images/`. Python utilities in `tools/` generate runtime assets under `src/assets/hero/`. Regression checks live in `tools/*.test.mjs`.

## Build, Test, and Development Commands

Run commands from the repository root:

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite on port 5173 with network access enabled.
- `npm run typecheck`: check strict TypeScript types without emitting files.
- `npm run build`: typecheck and build production files into `dist/`.
- `npm run build:single`: typecheck and bundle a single HTML build into `dist-single/`.
- `npm run preview`: serve the production build for local inspection.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, single-quoted strings, semicolons, and ES module imports. Use PascalCase for classes and their files (`HeroRig.ts`), camelCase for functions, properties, and utility modules (`walkArea.ts`), and uppercase snake case for shared constants. Preserve strict typing and keep tuning values in `src/config.ts`. No formatter or lint script is configured; match surrounding code.

## Testing Guidelines

Run `node --test tools/*.test.mjs` on Node.js 24 or later for movement, combat timing, and blade collision regression checks. These use the built-in Node.js test runner; no coverage threshold or `npm test` command is configured. Run typechecking and the relevant build before submitting. Manually verify changed gameplay in the browser: WASD/arrow movement, Space/J attacks, Shift/K dodges, and touch joystick/buttons. Use `?debug` to inspect walkable bounds. For animation changes, inspect idle, walking, all three combo attacks, and dodging.

## Asset Workflow

For the active hero, run `python3 tools/build_hero_frames.py` after changing measured frame/foot/blade anchors. Keep source sheets intact and inspect all four walking directions, both attack facings, and dodge. Source attribution is in `src/assets/hero/academy/README.md`.

For the legacy rig, after editing hero parts or rig assembly settings, run `python3 tools/build_hero_rig.py art/hero_parts/images --preview preview.png` with Pillow available. Review the preview and corresponding `rig.png`/`rig.json` changes together. Keep generated build directories and the ignored preview image out of commits.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as “Fix doubled upper arms” and “Add dodge button.” Follow that pattern and keep commits focused. PRs should explain behavior changes, list validation performed, link relevant issues, and include screenshots or short recordings for visual or gameplay changes.
