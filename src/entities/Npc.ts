import Phaser from 'phaser';
import { NPC_COMBAT } from '../config';
import { isFighterSkin, NpcFighter, type NpcCombatPose, type NpcCombatTarget } from './npcCombat';
import type { Interactable } from '../world/interactables';
import type { QuestMarker } from '../story/quests';
import type { WalkArea } from '../world/walkArea';
import {
  NPC_TALK_PAUSE_MS, NPC_WALK_SPEED, dutyPauseMs, npcSkin, direction8, pickRoamTarget, pickWanderTarget, roamsFreely, walkPose, wanderPauseMs,
  type Direction8, type DutyPoint, type NpcDef, type NpcSkin,
} from '../world/npcs';

interface WalkFrame {
  name: string; sheet: string; direction: string; pose: number;
  x: number; y: number; w: number; h: number; originX: number; originY: number; scale: number;
}
interface WalkData { fps: number; idlePose: number; walkPoses: number[]; referenceHeight: number; frames: WalkFrame[] }

// 인물마다 walk_cardinal-60.webp, walk_diagonal-60.webp(줄인 시트)와 walk_frames.json(원본 시트 좌표)이 있다.
const SHEET_URLS = import.meta.glob<string>('../assets/characters/*/walk_*-60.webp', { eager: true, query: '?url', import: 'default' });
const FRAME_DATA = import.meta.glob<WalkData>('../assets/characters/*/walk_frames.json', { eager: true, import: 'default' });
const COMBAT_URLS = import.meta.glob<string>('../assets/characters/*/combat.webp', { eager: true, query: '?url', import: 'default' });
interface CombatFrame { name: string; x: number; y: number; w: number; h: number; originX: number; originY: number }
const COMBAT_DATA = import.meta.glob<{ frames: CombatFrame[] }>('../assets/characters/*/combat-frames.json', { eager: true, import: 'default' });

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

const sheetKey = (id: NpcSkin, sheet: string) => `npc-${id}-${sheet.startsWith('walk_cardinal') ? 'cardinal' : 'diagonal'}`;
const sheetUrl = (id: NpcSkin, sheet: string) => SHEET_URLS[`../assets/characters/${id}/${sheet}-60.webp`];
const walkData = (id: NpcSkin) => FRAME_DATA[`../assets/characters/${id}/walk_frames.json`];

export function preloadNpcs(scene: Phaser.Scene, npcs: readonly NpcDef[]): void {
  for (const id of new Set(npcs.map(npcSkin))) {
    if (isFighterSkin(id) && !scene.textures.exists(`npc-${id}-combat`)) {
      scene.load.image(`npc-${id}-combat`, COMBAT_URLS[`../assets/characters/${id}/combat.webp`]);
    }
    for (const sheet of ['walk_cardinal', 'walk_diagonal']) {
      const key = sheetKey(id, sheet);
      if (!scene.textures.exists(key)) scene.load.image(key, sheetUrl(id, sheet));
    }
  }
}

/** 걷는 시트의 프레임을 텍스처에 등록한다. 원본 좌표를 줄인 시트 배율에 맞춘다. */
function registerWalkFrames(scene: Phaser.Scene, id: NpcSkin, data: WalkData): void {
  const s = WALK_SHEET_SCALE;
  for (const f of data.frames) {
    const texture = scene.textures.get(sheetKey(id, f.sheet));
    if (!texture.has(f.name)) texture.add(f.name, 0, Math.round(f.x * s), Math.round(f.y * s), Math.round(f.w * s), Math.round(f.h * s));
  }
}

/**
 * 마을 사람. 위치는 발이고 깊이는 y다(Character와 같은 규칙).
 * 모두 8방향 걷기 시트로 그린다. 플레이어가 가까이 와도 하던 대로 걷고, 말을 걸 때만(talkedTo) 멈춰서 돌아본다.
 * 마을 사람은 맵 안을 넓게 돌아다니고(roamsFreely), 순찰 병사는 자기 자리 주변(wander)만, 장사하는 사람은 제자리에 서 있다.
 * 시간은 씬의 게임 시계(now)를 따른다.
 */
export class Npc extends Phaser.GameObjects.Container {
  readonly def: NpcDef;
  /** 대화 대상. 걷는 동안 위치를 따라 옮긴다. */
  readonly spot: Interactable;
  private readonly skin: NpcSkin;
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
  /** 맡은 일(def.duty) 자리에 멈춰 있을 때 머리 위에 띄우는 하는 일 */
  private readonly activity: Phaser.GameObjects.Text;
  private dutyIndex = 0;
  /** 맡은 일 자리에 와 있는지(가는 길이 아니라) */
  private atDuty = true;
  /** 지금 띄운 퀘스트 표시 (미니맵도 이 값을 쓴다) */
  questMarker?: QuestMarker;
  /** 말을 건 뒤 이 시각(게임 시계)까지는 서서 플레이어 쪽을 본다. */
  private talkUntil = 0;
  /** 연출(오프닝) 중: 정해진 경로만 걷고, 돌아다니거나 플레이어를 돌아보지 않는다. */
  private scripted = false;
  /** 연출에서 걷는 빠르기 배율 (뛰기 등) */
  private scriptSpeed = 1;
  private scriptPath: { x: number; y: number }[] = [];
  private fighter?: NpcFighter;
  private battle = false;
  private storyInjured = false;

  constructor(scene: Phaser.Scene, def: NpcDef, rand: () => number = Math.random) {
    super(scene, def.x, def.y);
    this.def = def;
    this.rand = rand;
    const shadow = scene.add.image(0, 0, 'shadow').setAlpha(0.4).setDisplaySize(def.height * 0.5, def.height * 0.15);
    this.add(shadow);

    this.skin = npcSkin(def);
    if (isFighterSkin(this.skin)) {
      this.fighter = new NpcFighter(this.skin);
      const texture = scene.textures.get(`npc-${this.skin}-combat`);
      for (const f of COMBAT_DATA[`../assets/characters/${this.skin}/combat-frames.json`].frames) {
        if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
      }
    }
    this.direction = def.facing ?? 'down';
    this.walk = walkData(this.skin);
    registerWalkFrames(scene, this.skin, this.walk);
    this.frames = new Map(this.walk.frames.map((f) => [f.name, f]));
    this.scale0 = def.height / (this.walk.referenceHeight * WALK_SHEET_SCALE);
    this.figure = scene.add.image(0, 0, sheetKey(this.skin, 'walk_cardinal'), 'down-0');
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
    this.activity = scene.add.text(0, -def.height - 38, def.duty?.[0].label ?? '', {
      fontFamily: FONT, fontSize: '17px', color: '#d9f0c8', stroke: '#1a1008', strokeThickness: 4,
    }).setOrigin(0.5, 1).setResolution(2).setVisible(!!def.duty);
    this.add(this.activity);

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
    this.activity.setVisible(false);
  }

  /** 연출: 그 자리로 옮겨 세운다. */
  placeAt(x: number, y: number): void {
    this.scripted = true;
    this.scriptPath = [];
    this.target = undefined;
    this.setPosition(x, y).setDepth(y);
    this.spot.x = x;
    this.spot.y = y + (this.def.talkOffset ?? 0);
    this.showFrame(this.walk.idlePose);
  }

  /** 연출: 경로를 따라 걷는다. 다 걸으면 그 자리에 선다(release 전까지). */
  walkTo(path: { x: number; y: number }[], speed = 1): void {
    this.scripted = true;
    this.scriptSpeed = speed;
    this.scriptPath = path.map((p) => ({ ...p }));
    this.target = undefined;
    this.walked = 0;
  }

  /** 연출: (x, y) 쪽을 본다. */
  faceTowards(x: number, y: number): void {
    this.direction = direction8(x - this.x, y - this.y, this.direction);
    this.showFrame(this.walk.idlePose);
  }

  /** 플레이어가 말을 걸었다: 걷던 것을 멈추고 플레이어 쪽을 본다. 대화가 끝나도 잠깐 그대로 있다가 다시 걷는다. */
  talkedTo(now: number, player: { x: number; y: number }): void {
    if (this.scripted) return;
    // 일하러 가던 길이면 대화 뒤에 같은 자리로 다시 간다.
    const points = this.def.duty;
    if (points && this.target && !this.atDuty) this.dutyIndex = (this.dutyIndex - 1 + points.length) % points.length;
    this.target = undefined;
    this.talkUntil = now + NPC_TALK_PAUSE_MS;
    this.restUntil = Math.max(this.restUntil, this.talkUntil);
    this.faceTowards(player.x, player.y);
  }

  /** 연출에서 정한 경로를 아직 걷는 중인지 */
  get walking(): boolean {
    return this.scriptPath.length > 0;
  }

  /** 전투 동작이 있는 사람(병사·테온·루안): 보스전 결계 동안 물러난다 */
  get isFighter(): boolean { return !!this.fighter; }
  get combatPose(): NpcCombatPose | undefined { return this.combatControlled ? this.fighter?.pose : undefined; }
  get combatControlled(): boolean { return !!this.fighter && (this.battle || this.storyInjured); }
  get canFight(): boolean { return this.battle && !!this.fighter && this.fighter.hp > 0; }

  setBattle(enabled: boolean, injured = false): void {
    if (!this.fighter) return;
    if (enabled && !this.battle) this.fighter = new NpcFighter(this.fighter.skin);
    const changed = enabled !== this.battle || injured !== this.storyInjured;
    this.battle = enabled;
    this.storyInjured = injured;
    if (injured) this.fighter.injure();
    if (changed) {
      this.target = undefined;
      this.scriptPath = [];
      this.showFrame(this.walk.idlePose);
    }
  }

  updateCombat(now: number, dt: number, targets: readonly NpcCombatTarget[], area: WalkArea,
    canStand: (x: number, y: number) => boolean, strike: (id: number, damage: number) => void): void {
    if (!this.combatControlled || !this.fighter) return;
    const plan = this.fighter.step(now, this, targets, target => area.hasClearPath(this.x, this.y, target.x, target.y));
    if (plan.moveX || plan.moveY) {
      const distance = NPC_COMBAT.speed * dt;
      const next = area.move(this.x, this.y, plan.moveX * distance, plan.moveY * distance, this.step);
      const moved = Math.hypot(next.x-this.x, next.y-this.y);
      if (canStand(next.x, next.y)) {
        this.setPosition(next.x, next.y).setDepth(next.y);
        this.walked += moved;
      }
      this.direction = direction8(plan.moveX, plan.moveY);
      this.showFrame(walkPose(this.walked, this.def.height, this.walk.walkPoses), true);
      this.spot.x = this.x; this.spot.y = this.y + (this.def.talkOffset ?? 0);
    } else this.showCombat(plan.pose);
    if (plan.strike !== undefined) strike(plan.strike, NPC_COMBAT.profiles[this.fighter.skin].damage);
  }

  receiveCombatHit(now: number, source: { x: number; y: number }, damage: number): 'miss' | 'blocked' | 'hit' | 'injured' {
    if (!this.canFight || !this.fighter) return 'miss';
    const result = this.fighter.hit(now, this, source, damage);
    this.showCombat(this.fighter.pose);
    return result;
  }

  /** 연출을 마치고 평소처럼 돌아다니게 한다. */
  release(): void {
    this.scripted = false;
    this.scriptPath = [];
    this.target = undefined;
  }

  /** canStand: 목적지로 고를 수 있는 곳인지(맵 출구 같은 곳은 씬이 뺀다) */
  update(now: number, dt: number, player: { x: number; y: number }, area: WalkArea,
    canStand: (x: number, y: number) => boolean = () => true): void {
    // 퀘스트 표시는 위아래로 천천히 흔들려 눈에 띈다.
    if (this.questMarker) this.marker.setY(-this.def.height - 36 - Math.abs(Math.sin(now / 320)) * 8);
    if (this.combatControlled) return;
    const idle = this.walk.idlePose;
    if (this.scripted) {
      const next = this.scriptPath[0];
      if (!next) return;
      const dx = next.x - this.x, dy = next.y - this.y;
      const distance = Math.hypot(dx, dy);
      const travel = NPC_WALK_SPEED * this.scriptSpeed * dt;
      if (distance <= travel) {
        this.setPosition(next.x, next.y).setDepth(next.y);
        this.scriptPath.shift();
        if (this.scriptPath.length === 0) this.showFrame(idle);
      } else {
        area.move(this.x, this.y, (dx / distance) * travel, (dy / distance) * travel, this.step);
        // 벽에 막혀 거의 못 움직이면 그 지점을 건너뛴다(연출이 멈추지 않게).
        if (Math.hypot(this.step.x - this.x, this.step.y - this.y) < travel * 0.2) this.scriptPath.shift();
        this.direction = direction8(dx, dy, this.direction);
        this.walked += Math.hypot(this.step.x - this.x, this.step.y - this.y);
        this.setPosition(this.step.x, this.step.y).setDepth(this.step.y);
        this.showFrame(walkPose(this.walked, this.def.height, this.walk.walkPoses));
      }
      this.spot.x = this.x;
      this.spot.y = this.y + (this.def.talkOffset ?? 0);
      return;
    }
    if (now < this.talkUntil) {
      // 방금 말을 걸었다: 서서 플레이어 쪽을 본다.
      this.direction = direction8(player.x - this.x, player.y - this.y, this.direction);
      this.showFrame(idle);
      return;
    }
    if (this.def.duty) {
      this.updateDuty(now, dt, area, this.def.duty);
      return;
    }
    if (this.def.wander === undefined) {
      // 장사하는 사람은 손님이 떠나면 다시 앞을 본다.
      this.direction = this.def.facing ?? 'down';
      this.showFrame(idle);
      return;
    }
    if (!this.target) {
      if (now < this.restUntil) {
        this.showFrame(idle);
        return;
      }
      const canGo = (x: number, y: number) => area.contains(x, y) && canStand(x, y) && area.hasClearPath(this.x, this.y, x, y);
      this.target = roamsFreely(this.def)
        ? pickRoamTarget(this, this.rand, canGo)
        : pickWanderTarget(this.def, this.def.wander, this.rand, canGo);
      if (!this.target) {
        this.restUntil = now + wanderPauseMs(this.rand);
        this.showFrame(idle);
        return;
      }
      this.walkStartedAt = now;
      this.walked = 0;
    }

    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const travel = NPC_WALK_SPEED * dt;
    // 멀리 가는 길이라 넉넉히 기다리되, 무언가에 막혀 오래 걸리면 포기하고 쉰다.
    if (distance <= travel || now - this.walkStartedAt > 14000) {
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

  /** 맡은 일: 자리들을 차례로 오가고, 자리에 멈춘 동안 하는 일을 띄운다. 막혀 오래 걸리면 그 자리를 건너뛴다. */
  private updateDuty(now: number, dt: number, area: WalkArea, points: readonly DutyPoint[]): void {
    const idle = this.walk.idlePose;
    if (!this.target) {
      if (now < this.restUntil) {
        this.activity.setVisible(this.atDuty && !this.questMarker);
        this.showFrame(idle);
        return;
      }
      this.dutyIndex = (this.dutyIndex + 1) % points.length;
      this.target = points[this.dutyIndex];
      this.walkStartedAt = now;
      this.walked = 0;
      this.atDuty = false;
      this.activity.setVisible(false);
    }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const travel = NPC_WALK_SPEED * dt;
    if (distance <= travel || now - this.walkStartedAt > 14000) {
      const point = points[this.dutyIndex];
      this.target = undefined;
      this.restUntil = now + dutyPauseMs(this.rand);
      this.atDuty = true;
      if (point.facing) this.direction = point.facing;
      this.activity.setText(point.label);
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

  private showFrame(pose: number, combatWalk = false): void {
    if (this.combatControlled && !combatWalk) { this.showCombat(this.fighter!.pose); return; }
    const frame = this.frames.get(`${this.direction}-${pose}`)!;
    this.figure.setTexture(sheetKey(this.skin, frame.sheet), frame.name)
      .setFlipX(false)
      .setOrigin(frame.originX, frame.originY)
      .setScale(this.scale0 * frame.scale);
  }

  private showCombat(pose: NpcCombatPose): void {
    const frame = COMBAT_DATA[`../assets/characters/${this.skin}/combat-frames.json`].frames.find(f => f.name === pose)!;
    this.figure.setTexture(`npc-${this.skin}-combat`, pose).setFlipX(this.fighter!.facingX < 0)
      .setOrigin(frame.originX, frame.originY).setScale(this.def.height / NPC_COMBAT.artHeight);
  }
}
