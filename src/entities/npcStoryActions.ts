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
import finnNightUrl from '../assets/characters/finn/night-watch.webp?url';
import finnNightData from '../assets/characters/finn/night-watch-frames.json';
import innRiverUrl from '../assets/characters/fog-innkeeper/river-wake.webp?url';
import innRiverData from '../assets/characters/fog-innkeeper/river-wake-frames.json';
import fisherDaughterUrl from '../assets/characters/fisher-daughter/testimony.webp?url';
import fisherDaughterData from '../assets/characters/fisher-daughter/testimony-frames.json';
import herbalistUrl from '../assets/characters/herbalist-elder/tend-patient.webp?url';
import herbalistData from '../assets/characters/herbalist-elder/tend-patient-frames.json';

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
  // 퀘스트 6 "밤의 종소리": 핀의 밤샘(솜 끼고 깨어 있기 → 시온 깨우기 → 아버지가 간 쪽 가리키기 → 아버지 끌어안기),
  // 물가에서 깨어나는 여관 주인(깨어남 → 발이 물에 빠짐 → 뒤로 물러섬 → 정신 차림). 한 자세씩 쓴다.
  // 몸 높이는 서 있는 자세(핀 warn-father, 여관 주인 river-awake)의 발바닥~머리끝 픽셀이다.
  // `-left`는 좌우를 뒤집은 그림이다(여관 안에서 왼쪽 아래 문으로 나가는 아버지를 가리킬 때).
  finn: Object.fromEntries(finnNightData.frames.flatMap(frame => [false, true].map(flipX => [`${frame.name}${flipX ? '-left' : ''}`, {
    key: 'npc-finn-night-watch', url: finnNightUrl, frames: [frame], fps: 0, bodyHeight: 346, onTalk: 'keep' as const, flipX,
  }]))),
  'fog-innkeeper': Object.fromEntries(innRiverData.frames.map(frame => [frame.name, {
    key: 'npc-fog-innkeeper-river-wake', url: innRiverUrl, frames: [frame], fps: 0, bodyHeight: 329, onTalk: 'keep' as const,
  }])),
  // 퀘스트 7 "사라진 다섯"의 증인: 어부의 딸(아버지의 찌를 쥐고 이야기한다), 약초 가게 할머니(찻잔을 준비한다).
  // 몸 높이는 서 있는 자세의 발바닥~머리끝 픽셀(350)이다.
  'fisher-daughter': Object.fromEntries(fisherDaughterData.frames.map(frame => [frame.name, {
    key: 'npc-fisher-daughter-testimony', url: fisherDaughterUrl, frames: [frame], fps: 0, bodyHeight: 350, onTalk: 'keep' as const,
  }])),
  'herbalist-elder': Object.fromEntries(herbalistData.frames.map(frame => [frame.name, {
    key: 'npc-herbalist-elder-tend', url: herbalistUrl, frames: [frame], fps: 0, bodyHeight: 350, onTalk: 'keep' as const,
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
