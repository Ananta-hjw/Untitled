import type Phaser from 'phaser';
import type { NpcSkin } from '../world/npcs';
import type { DialogueId } from '../story/dialogues';
import ringUrl from '../assets/characters/bell-ringer/ring.webp?url';
import ringData from '../assets/characters/bell-ringer/ring-frames.json';
import bellowsUrl from '../assets/characters/toby/bellows.webp?url';
import bellowsData from '../assets/characters/toby/bellows-frames.json';
import cocoonUrl from '../assets/characters/toby/cocoon-512.webp?url';

export interface StoryFrame { name: string; x: number; y: number; w: number; h: number; originX: number; originY: number }
export interface StoryAction {
  key: string; url: string; frames: StoryFrame[]; fps: number; bodyHeight: number;
  onTalk: 'stop' | 'pause' | 'keep'; dialogue?: DialogueId;
}
const ACTIONS: Partial<Record<NpcSkin, Record<string, StoryAction>>> = {
  'bell-ringer': {
    ring: { key: 'npc-bell-ringer-ring', url: ringUrl, frames: ringData.frames, fps: ringData.fps, bodyHeight: 296, onTalk: 'stop' },
  },
  toby: {
    bellows: { key: 'npc-toby-bellows', url: bellowsUrl, frames: bellowsData.frames, fps: 3, bodyHeight: 430, onTalk: 'pause' },
    cocoon: { key: 'npc-toby-cocoon', url: cocoonUrl, frames: [{ name: 'cocoon', x: 0, y: 0, w: 283, h: 512, originX: 0.5, originY: 0.99 }],
      fps: 0, bodyHeight: 430, onTalk: 'keep', dialogue: 'toby-cocoon' },
  },
};
export function npcStoryAction(skin: NpcSkin, name: string): StoryAction | undefined {
  const actions = ACTIONS[skin];
  return actions && Object.hasOwn(actions, name) ? actions[name] : undefined;
}
export function preloadNpcStoryActions(scene: Phaser.Scene, skin: NpcSkin): void {
  for (const action of Object.values(ACTIONS[skin] ?? {})) {
    if (!scene.textures.exists(action.key)) scene.load.image(action.key, action.url);
  }
}
export function registerNpcStoryActions(scene: Phaser.Scene, skin: NpcSkin): void {
  for (const action of Object.values(ACTIONS[skin] ?? {})) {
    const texture = scene.textures.get(action.key);
    for (const f of action.frames) if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
}
