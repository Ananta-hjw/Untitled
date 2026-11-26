import type Phaser from 'phaser';
import type { NpcSkin } from '../world/npcs';
import type { DialogueId } from '../story/dialogues';
import ringUrl from '../assets/characters/bell-ringer/ring.webp?url';
import ringData from '../assets/characters/bell-ringer/ring-frames.json';
import bellowsUrl from '../assets/characters/toby/bellows.webp?url';
import bellowsData from '../assets/characters/toby/bellows-frames.json';
import cocoonUrl from '../assets/characters/toby/cocoon-512.webp?url';
import lineaRecoveryUrl from '../assets/characters/linea/recovery.webp?url';
import lineaRecoveryData from '../assets/characters/linea/recovery-frames.json';
import eilaTreatmentUrl from '../assets/characters/eila/treatment.webp?url';
import eilaTreatmentData from '../assets/characters/eila/treatment-frames.json';
import serenaNursingUrl from '../assets/characters/serena/nursing.webp?url';
import serenaNursingData from '../assets/characters/serena/nursing-frames.json';
import defenderRecoveryUrl from '../assets/characters/defender-recovery/recovery.webp?url';
import defenderRecoveryData from '../assets/characters/defender-recovery/recovery-frames.json';
import reliefUrl from '../assets/characters/village-relief/work.webp?url';
import reliefData from '../assets/characters/village-relief/work-frames.json';
import joanCocoonUrl from '../assets/characters/joan/cocoon-awaken.webp?url';
import joanCocoonData from '../assets/characters/joan/cocoon-awaken-frames.json';
import doranHammerUrl from '../assets/characters/doran/hammer.webp?url';
import doranHammerData from '../assets/characters/doran/hammer-frames.json';

export interface StoryFrame { name: string; x: number; y: number; w: number; h: number; originX: number; originY: number }
export interface StoryAction {
  key: string; url: string; frames: StoryFrame[]; fps: number; bodyHeight: number;
  onTalk: 'stop' | 'pause' | 'keep'; dialogue?: DialogueId;
  flipX?: boolean;
  labelOffset?: number;
  activity?: string;
  loop?: boolean;
}
const ACTIONS: Partial<Record<NpcSkin, Record<string, StoryAction>>> = {
  ...Object.fromEntries(([
    ['herman', 'record', '피해 상황 기록 중'],
    ['merina', 'supplies', '구호 물품 정리 중'], ['rosetta', 'blankets', '담요 준비 중'],
    ['vernel', 'inspect', '권속 흔적 조사 중'],
  ] as const).map(([skin, name, activity]) => [skin, { [name]: {
    key: 'npc-village-relief', url: reliefUrl,
    frames: reliefData.frames.filter(f => f.name.startsWith(`${skin}-${name}-`)),
    fps: 1, bodyHeight: skin === 'vernel' ? 380 : 304,
    labelOffset: skin === 'vernel' ? 125 : undefined, onTalk: 'pause' as const, activity,
  } }])),
  ...Object.fromEntries((['ruan', 'teon', 'soldier'] as const).map(skin => [skin,
    Object.fromEntries((skin === 'teon' ? ['sentry'] : skin === 'soldier' ? ['rest', 'repair'] : ['rest']).map(name => [name, {
      key: 'npc-defender-recovery', url: defenderRecoveryUrl,
      frames: defenderRecoveryData.frames.filter(f => f.name.startsWith(`${skin}-${name}-`)),
      fps: name === 'repair' ? 2 : 1, bodyHeight: skin === 'teon' ? 304 : 380,
      labelOffset: skin === 'teon' ? undefined : 125, onTalk: 'pause' as const,
    }]))])),
  doran: {
    hammer: { key: 'npc-doran-hammer', url: doranHammerUrl, frames: doranHammerData.frames,
      fps: doranHammerData.fps, bodyHeight: doranHammerData.bodyHeight, onTalk: 'pause' },
  },
  serena: Object.fromEntries(['nurse-left', 'nurse-right', 'wring-cloth'].map(name => [name, {
    key: 'npc-serena-nursing', url: serenaNursingUrl,
    frames: serenaNursingData.frames.filter(f => f.name.startsWith(name === 'wring-cloth' ? 'cloth-' : 'nurse-')),
    fps: 2, bodyHeight: name === 'wring-cloth' ? 304 : 380, onTalk: 'pause' as const,
    flipX: name === 'nurse-right', labelOffset: name === 'wring-cloth' ? undefined : 125,
  }])),
  eila: Object.fromEntries(['treat-left', 'treat-right', 'mix-herbs'].map(name => [name, {
    key: 'npc-eila-treatment', url: eilaTreatmentUrl,
    frames: eilaTreatmentData.frames.filter(f => f.name.startsWith(name === 'mix-herbs' ? 'mix-' : 'treat-')),
    fps: 2, bodyHeight: 304, onTalk: 'pause' as const, flipX: name === 'treat-right',
  }])),
  linea: Object.fromEntries(lineaRecoveryData.frames.map(frame => [frame.name, {
    key: 'npc-linea-recovery', url: lineaRecoveryUrl, frames: [frame], fps: 0,
    bodyHeight: frame.name === 'journal' ? 480 : 370, onTalk: 'keep' as const,
  }])),
  'bell-ringer': {
    ring: { key: 'npc-bell-ringer-ring', url: ringUrl, frames: ringData.frames, fps: ringData.fps, bodyHeight: 296, onTalk: 'stop' },
  },
  joan: {
    cocoon: { key: 'npc-joan-cocoon-awaken', url: joanCocoonUrl, frames: joanCocoonData.frames.slice(0, 1),
      fps: 0, bodyHeight: 286, labelOffset: 172, onTalk: 'keep' },
    awaken: { key: 'npc-joan-cocoon-awaken', url: joanCocoonUrl, frames: joanCocoonData.frames,
      fps: 3, bodyHeight: 286, labelOffset: 172, onTalk: 'keep', loop: false },
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
  for (const action of new Map(Object.values(ACTIONS[skin] ?? {}).map(a => [a.key, a])).values()) {
    if (!scene.textures.exists(action.key)) scene.load.image(action.key, action.url);
  }
}
export function registerNpcStoryActions(scene: Phaser.Scene, skin: NpcSkin): void {
  for (const action of Object.values(ACTIONS[skin] ?? {})) {
    const texture = scene.textures.get(action.key);
    for (const f of action.frames) if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
}
