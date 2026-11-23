# Chapter 1 harvest festival art

Original transparent PNGs generated for this project with OpenAI image generation.
Hand-painted medieval RPG props share oak, ivory linen/parchment, burgundy trim,
aged brass and warm amber light:

- `feast-table-source.png`: food, crockery and embroidered linen on an oak table.
- `bonfire-base-source.png`: stone fire ring, split logs and embers, without flames.
- `bonfire-flames-source.png`: four flame poses in a 2×2 sheet.
- `festival-pole-source.png`: carved oak post with wheat and ribbon details.
- `hanging-lantern-source.png`: framed parchment lantern with wheat motifs.
- `sky-lantern-source.png`: parchment lantern with visible bamboo ring and flame.

Run `python3 tools/build_festival_assets.py` to regenerate `props.webp` and
`props.json`. Packaging trims transparent margins, downsizes the art and aligns
flame poses to a shared baseline. Original PNGs remain intact.

`FestivalStage.ts` loads the atlas only for the festival scene. Rope curves,
light, embers, wind and alarm remain game-clock effects; the story cue timing
and NPC placements are unchanged. The 28 sky lantern images are allocated once
and hidden after their rise finishes.
