# Repository Guidelines

## Project Structure & Module Organization

This is a mobile RPG prototype using Phaser, TypeScript, and Vite. `src/main.ts` initializes the game; `src/scenes/GameScene.ts` coordinates input, movement, and combat for one run. Keep character and rig behavior in `src/entities/`, enemy AI and combat effects in `src/combat/`, touch controls and HUD in `src/ui/`, and map layout, path-finding, and placeholder graphics in `src/world/`. Shared gameplay constants belong in `src/config.ts`.

Original hero PNG parts live in `art/hero_parts/images/`. Python utilities in `tools/` generate runtime assets under `src/assets/hero/`. Regression checks live in `tools/*.test.mjs`.

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

Follow existing TypeScript style: two-space indentation, single-quoted strings, semicolons, and ES module imports. Use PascalCase for classes and their files (`HeroRig.ts`), camelCase for functions, properties, and utility modules (`walkArea.ts`), and uppercase snake case for shared constants. Preserve strict typing and keep tuning values in `src/config.ts`. No formatter or lint script is configured; match surrounding code.

## Testing Guidelines

Run `npm test` on Node.js 24 or later for movement, combat timing, blade collision, and path-finding regression checks. These use the built-in Node.js test runner; no coverage threshold is configured. CI runs the same command before building the APK. Run typechecking and the relevant build before submitting. Manually verify changed gameplay in the browser: WASD/arrow movement, Space/J attacks, Shift/K dodges, and touch joystick/buttons. Use `?debug` to inspect walkable bounds. For animation changes, inspect idle, walking, all three combo attacks, and dodging.

## Asset Workflow

After editing hero parts or rig assembly settings, run `python3 tools/build_hero_rig.py art/hero_parts/images --preview preview.png` with Pillow available. Review the preview and corresponding `rig.png`/`rig.json` changes together. Keep generated build directories and the ignored preview image out of commits.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as “Fix doubled upper arms” and “Add dodge button.” Follow that pattern and keep commits focused. PRs should explain behavior changes, list validation performed, link relevant issues, and include screenshots or short recordings for visual or gameplay changes.
