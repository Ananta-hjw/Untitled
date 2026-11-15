import Phaser from 'phaser';
import type { Interactable } from '../world/interactables';
import type { QuestMarker } from '../story/quests';
import type { WalkArea } from '../world/walkArea';
import {
  NPC_NOTICE_RADIUS, NPC_WALK_SPEED, direction8, pickWanderTarget, walkPose, wanderPauseMs,
  type Direction8, type NpcDef, type NpcId,
} from '../world/npcs';

interface WalkFrame {
  name: string; sheet: string; direction: string; pose: number;
  x: number; y: number; w: number; h: number; originX: number; originY: number; scale: number;
}
interface WalkData { fps: number; idlePose: number; walkPoses: number[]; referenceHeight: number; frames: WalkFrame[] }

// 인물마다 walk_cardinal-60.webp, walk_diagonal-60.webp(줄인 시트)와 walk_frames.json(원본 시트 좌표)이 있다.
const SHEET_URLS = import.meta.glob<string>('../assets/characters/*/walk_*-60.webp', { eager: true, query: '?url', import: 'default' });
const FRAME_DATA = import.meta.glob<WalkData>('../assets/characters/*/walk_frames.json', { eager: true, import: 'default' });

/** walk_*-60.webp는 원본 시트를 이 배율로 줄인 것이다 (tools/build_rowen_assets.py). */
const WALK_SHEET_SCALE = 0.6;
const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/** 머리 위 퀘스트 표시: 새 퀘스트 !, 완료 ? (메인 노란색, 서브 초록색), 진행 중 회색 ?, 말 걸 대상 하늘색 ! */
export const MARKER_STYLE: Record<QuestMarker, { text: string; color: string }> = {
  new: { text: '!', color: '#ffd23f' },
  ready: { text: '?', color: '#ffd23f' },
  'sub-new': { text: '!', color: '#6ee06a' },
  'sub-ready': { text: '?', color: '#6ee06a' },
  progress: { text: '?', color: '#b9b2a4' },
  target: { text: '!', color: '#8fd6ff' },
};

const sheetKey = (id: NpcId, sheet: string) => `npc-${id}-${sheet.startsWith('walk_cardinal') ? 'cardinal' : 'diagonal'}`;
const sheetUrl = (id: NpcId, sheet: string) => SHEET_URLS[`../assets/characters/${id}/${sheet}-60.webp`];
const walkData = (id: NpcId) => FRAME_DATA[`../assets/characters/${id}/walk_frames.json`];

export function preloadNpcs(scene: Phaser.Scene, npcs: readonly NpcDef[]): void {
  for (const npc of npcs) {
    for (const sheet of ['walk_cardinal', 'walk_diagonal']) {
      const key = sheetKey(npc.id, sheet);
      if (!scene.textures.exists(key)) scene.load.image(key, sheetUrl(npc.id, sheet));
    }
  }
}

/** 걷는 시트의 프레임을 텍스처에 등록한다. 원본 좌표를 줄인 시트 배율에 맞춘다. */
function registerWalkFrames(scene: Phaser.Scene, id: NpcId, data: WalkData): void {
  const s = WALK_SHEET_SCALE;
  for (const f of data.frames) {
    const texture = scene.textures.get(sheetKey(id, f.sheet));
    if (!texture.has(f.name)) texture.add(f.name, 0, Math.round(f.x * s), Math.round(f.y * s), Math.round(f.w * s), Math.round(f.h * s));
  }
}

/**
 * 마을 사람. 위치는 발이고 깊이는 y다(Character와 같은 규칙).
 * 모두 8방향 걷기 시트로 그린다. 플레이어가 가까이 오면 멈춰서 플레이어 쪽을 본다.
 * 돌아다니는 범위(wander)가 있는 사람만 자기 자리 주변을 걷고, 장사하는 사람은 제자리에 서 있다.
 * 시간은 씬의 게임 시계(now)를 따른다.
 */
export class Npc extends Phaser.GameObjects.Container {
  readonly def: NpcDef;
  /** 대화 대상. 걷는 동안 위치를 따라 옮긴다. */
  readonly spot: Interactable;
  private readonly figure: Phaser.GameObjects.Image;
  private readonly walk: WalkData;
  private readonly frames: Map<string, WalkFrame>;
  private readonly scale0: number;
  private direction: Direction8 = 'down';
  private target?: { x: number; y: number };
  private restUntil = 0;
  private walkStartedAt = 0;
  /** 이번에 걷기 시작한 뒤 실제로 걸은 거리. 걸음 그림을 이 거리에 맞춰 넘긴다. */
  private walked = 0;
  private readonly rand: () => number;
  private readonly step = new Phaser.Math.Vector2();
  private readonly marker: Phaser.GameObjects.Text;
  /** 지금 띄운 퀘스트 표시 (미니맵도 이 값을 쓴다) */
  questMarker?: QuestMarker;

  constructor(scene: Phaser.Scene, def: NpcDef, rand: () => number = Math.random) {
    super(scene, def.x, def.y);
    this.def = def;
    this.rand = rand;
    const shadow = scene.add.image(0, 0, 'shadow').setAlpha(0.4).setDisplaySize(def.height * 0.5, def.height * 0.15);
    this.add(shadow);

    this.walk = walkData(def.id);
    registerWalkFrames(scene, def.id, this.walk);
    this.frames = new Map(this.walk.frames.map((f) => [f.name, f]));
    this.scale0 = def.height / (this.walk.referenceHeight * WALK_SHEET_SCALE);
    this.figure = scene.add.image(0, 0, sheetKey(def.id, 'walk_cardinal'), 'down-0');
    this.showFrame(this.walk.idlePose);
    this.restUntil = rand() * 2000;
    this.add(this.figure);

    const label = scene.add.text(0, -def.height - 10, def.name, {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold',
      color: def.shop ? '#ffe09a' : '#f5ead2', stroke: '#1a1008', strokeThickness: 5,
    }).setOrigin(0.5, 1).setResolution(2);
    this.add(label);
    this.marker = scene.add.text(0, -def.height - 36, '', {
      fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#ffd23f', stroke: '#1a1008', strokeThickness: 7,
    }).setOrigin(0.5, 1).setResolution(2).setVisible(false);
    this.add(this.marker);

    // 카운터 뒤의 사람은 카운터 앞에서 말을 건다. 말풍선은 그래도 그 사람 머리 위에 뜬다.
    const offset = def.talkOffset ?? 0;
    this.spot = { id: `npc-${def.id}`, x: def.x, y: def.y + offset, radius: 110, markerHeight: def.height + 44 + offset, dialogue: def.dialogue };
    scene.add.existing(this);
    this.setDepth(def.y);
  }

  setQuestMarker(marker: QuestMarker | undefined): void {
    this.questMarker = marker;
    if (!marker) {
      this.marker.setVisible(false);
      return;
    }
    const style = MARKER_STYLE[marker];
    this.marker.setText(style.text).setColor(style.color).setVisible(true);
  }

  update(now: number, dt: number, player: { x: number; y: number }, area: WalkArea): void {
    // 퀘스트 표시는 위아래로 천천히 흔들려 눈에 띈다.
    if (this.questMarker) this.marker.setY(-this.def.height - 36 - Math.abs(Math.sin(now / 320)) * 8);
    const idle = this.walk.idlePose;
    if (Math.hypot(player.x - this.x, player.y - this.y) < NPC_NOTICE_RADIUS) {
      // 말을 걸 수 있게 멈추고 플레이어 쪽을 본다.
      this.direction = direction8(player.x - this.x, player.y - this.y, this.direction);
      this.showFrame(idle);
      return;
    }
    if (this.def.wander === undefined) {
      // 장사하는 사람은 손님이 떠나면 다시 앞을 본다.
      this.direction = 'down';
      this.showFrame(idle);
      return;
    }
    if (!this.target) {
      if (now < this.restUntil) {
        this.showFrame(idle);
        return;
      }
      this.target = pickWanderTarget(this.def, this.def.wander, this.rand,
        (x, y) => area.contains(x, y) && area.hasClearPath(this.x, this.y, x, y));
      this.walkStartedAt = now;
      this.walked = 0;
    }

    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const travel = NPC_WALK_SPEED * dt;
    if (distance <= travel || now - this.walkStartedAt > 8000) {
      this.target = undefined;
      this.restUntil = now + wanderPauseMs(this.rand);
      this.showFrame(idle);
      return;
    }
    area.move(this.x, this.y, (dx / distance) * travel, (dy / distance) * travel, this.step);
    this.direction = direction8(dx, dy, this.direction);
    this.walked += Math.hypot(this.step.x - this.x, this.step.y - this.y);
    this.setPosition(this.step.x, this.step.y).setDepth(this.step.y);
    this.spot.x = this.x;
    this.spot.y = this.y + (this.def.talkOffset ?? 0);
    this.showFrame(walkPose(this.walked, this.def.height, this.walk.walkPoses));
  }

  private showFrame(pose: number): void {
    const frame = this.frames.get(`${this.direction}-${pose}`)!;
    this.figure.setTexture(sheetKey(this.def.id, frame.sheet), frame.name)
      .setOrigin(frame.originX, frame.originY)
      .setScale(this.scale0 * frame.scale);
  }
}
