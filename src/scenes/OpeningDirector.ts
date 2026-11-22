import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import type { DialogueLine } from '../story/dialogues';
import type { CutsceneTarget, OpeningStep, Point } from '../story/opening';
import type { Npc } from '../entities/Npc';
import type { NamedNpcId } from '../world/npcs';

/** 오프닝을 보여 주는 장면이 감독에게 빌려주는 것들 */
export interface OpeningHost {
  readonly scene: Phaser.Scene;
  hero(): { x: number; y: number };
  /** 시온이 걸을 방향(조이스틱 대신). (0, 0)이면 선다. */
  setHeroInput(x: number, y: number): void;
  /** 시온을 그 자리로 옮긴다(막혀서 못 가는 경우). */
  placeHero(x: number, y: number): void;
  npc(id: NamedNpcId): Npc | undefined;
  say(lines: DialogueLine[], done: () => void): void;
  closeDialogue(): void;
  finish(skipped: boolean): void;
  /** 카메라가 시온을 따라갈 때 화면 가운데에 오는 지점 */
  heroCamera(): { x: number; y: number };
  /** 카메라가 다시 시온을 따라가게 한다. */
  followHero(): void;
  /** 대본의 효과 신호(cue 단계). 장면마다 다르다. */
  cue?(name: string): void;
}

/** 머리 위 짧은 표시가 떠 있는 시간(게임 시계 ms) */
const EMOTE_MS = 1600;

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const BAR = 54;
/** 시온이 한 지점에 이만큼 가까워지면 다음 지점으로 간다 */
const ARRIVE = 14;
/** 막혀서 이만큼(게임 시간) 거의 움직이지 못하면 그 지점으로 옮긴다 */
const STUCK_MS = 1500;

/**
 * 연출 대본(오프닝 story/opening.ts, 수확제 story/festival.ts)을 차례로 실행한다:
 * 자막, 시온과 마을 사람의 이동, 카메라 이동, 머리 위 표시, 대화, 장면의 효과 신호(cue).
 * 시간은 장면의 게임 시계를 따르고(대화 중에는 장면이 멈추므로 같이 멈춘다), 화면 효과만 실제 시간 tween을 쓴다.
 * 위아래 검은 띠와 오른쪽 위 건너뛰기 버튼을 그린다.
 */
export class OpeningDirector {
  private readonly host: OpeningHost;
  private readonly steps: OpeningStep[];
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly bars: Phaser.GameObjects.Rectangle[];
  private readonly skipButton: Phaser.GameObjects.Text;
  private index = -1;
  private startedAt = 0;
  private waiting = false;
  private ended = false;
  private pathIndex = 0;
  private lastMoveAt = 0;
  private lastPos = { x: 0, y: 0 };
  /** 마지막으로 받은 게임 시각 (대화가 닫힐 때 다음 단계를 이 시각에 시작한다) */
  private clock = 0;
  private cameraFrom = { x: 0, y: 0 };
  private emotes: Array<{ text: Phaser.GameObjects.Text; who: NamedNpcId | 'hero'; until: number }> = [];

  constructor(host: OpeningHost, steps: OpeningStep[]) {
    this.host = host;
    this.steps = steps;
    const scene = host.scene;
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 5);
    this.caption = scene.add.text(0, VIEW_HEIGHT / 2, '', {
      fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#f5ead2', align: 'center', lineSpacing: 14,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 6).setResolution(2).setAlpha(0);
    this.bars = [0, 1].map(() => scene.add.rectangle(0, 0, 10, BAR, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 4));
    this.skipButton = scene.add.text(0, 27, '건너뛰기 ▶▶', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#f5ead2', backgroundColor: '#00000088', padding: { x: 16, y: 8 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH_UI + 70).setResolution(2)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => this.skip());
    for (const object of this.objects) object.setData('opening', true);
    this.layout(scene.scale.gameSize.width);
  }

  get active(): boolean { return !this.ended; }
  /** 지금 몇 번째 단계인지 (테스트용) */
  get step(): number { return this.index; }
  /** 지금 단계 (테스트용) */
  get current(): OpeningStep | undefined { return this.steps[this.index]; }

  layout(width: number): void {
    this.shade.setSize(width, VIEW_HEIGHT);
    this.caption.setX(width / 2);
    this.bars[0].setPosition(0, 0).setSize(width, BAR);
    this.bars[1].setPosition(0, VIEW_HEIGHT - BAR).setSize(width, BAR);
    this.skipButton.setX(width - 24);
  }

  /** 게임 시계로 한 걸음 진행한다. 대화가 열려 있는 동안 장면이 부르지 않는다. */
  update(now: number): void {
    if (this.ended) return;
    this.clock = now;
    this.updateEmotes(now);
    if (this.index < 0) this.next(now);
    if (this.waiting || this.ended) return;
    const step = this.steps[this.index];
    if (!step) return;
    const elapsed = now - this.startedAt;
    switch (step.type) {
      case 'caption':
        if (elapsed >= step.ms) {
          this.fade(this.caption, 0, 400);
          this.fade(this.shade, 0, 900);
          this.next(now);
        }
        break;
      case 'outro':
        if (elapsed >= step.ms) this.finish(false);
        break;
      case 'wait':
        if (elapsed >= step.ms) this.next(now);
        break;
      case 'hero':
        this.walkHero(step.path, now);
        break;
      case 'npc':
        if (!this.host.npc(step.id)?.walking) this.next(now);
        break;
      case 'camera': {
        const t = Math.min(1, elapsed / step.ms);
        const to = step.to === 'hero' ? this.host.heroCamera() : step.to;
        const e = t * t * (3 - 2 * t);
        this.host.scene.cameras.main.centerOn(this.cameraFrom.x + (to.x - this.cameraFrom.x) * e, this.cameraFrom.y + (to.y - this.cameraFrom.y) * e);
        if (t >= 1) {
          if (step.to === 'hero') this.host.followHero();
          this.next(now);
        }
        break;
      }
      default:
        this.next(now);
    }
  }

  /** 건너뛰기: 대화를 닫고 바로 끝낸다. */
  skip(): void {
    if (this.ended) return;
    this.finish(true);
  }

  private next(now: number): void {
    // 즉시 끝나는 단계(옮기기, 바라보기)는 한꺼번에 처리한다.
    for (;;) {
      this.index++;
      this.startedAt = now;
      const step = this.steps[this.index];
      if (!step) { this.finish(false); return; }
      switch (step.type) {
        case 'place':
          this.host.npc(step.id)?.placeAt(step.at.x, step.at.y);
          continue;
        case 'placeHero':
          this.host.placeHero(step.at.x, step.at.y);
          continue;
        case 'face': {
          const to = this.where(step.to ?? 'hero');
          if (to) this.host.npc(step.id)?.faceTowards(to.x, to.y);
          continue;
        }
        case 'emote':
          this.showEmote(step.who, step.text, now);
          continue;
        case 'cue':
          this.host.cue?.(step.cue);
          continue;
        case 'camera': {
          const camera = this.host.scene.cameras.main;
          camera.stopFollow();
          this.cameraFrom = { x: camera.midPoint.x, y: camera.midPoint.y };
          return;
        }
        case 'caption':
          this.shade.setAlpha(1);
          this.caption.setText(step.text);
          this.fade(this.caption, 1, 500);
          return;
        case 'outro':
          this.host.setHeroInput(0, 0);
          this.caption.setText(step.text).setAlpha(0);
          this.fade(this.shade, 1, 700);
          this.fade(this.caption, 1, 900);
          return;
        case 'hero':
          this.pathIndex = 0;
          this.lastMoveAt = now;
          this.lastPos = { ...this.host.hero() };
          return;
        case 'npc':
          this.host.npc(step.id)?.walkTo(step.path, step.speed);
          if (step.wait) return;
          continue;
        case 'say':
          this.waiting = true;
          this.host.setHeroInput(0, 0);
          this.host.say(step.lines, () => {
            if (this.ended) return;
            this.waiting = false;
            this.next(this.clock);
          });
          return;
        default:
          return;
      }
    }
  }

  private walkHero(path: { x: number; y: number }[], now: number): void {
    const hero = this.host.hero();
    const target = path[this.pathIndex];
    if (!target) {
      this.host.setHeroInput(0, 0);
      this.next(now);
      return;
    }
    const dx = target.x - hero.x, dy = target.y - hero.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= ARRIVE) {
      this.pathIndex++;
      return;
    }
    if (Math.hypot(hero.x - this.lastPos.x, hero.y - this.lastPos.y) > 4) {
      this.lastPos = { ...hero };
      this.lastMoveAt = now;
    } else if (now - this.lastMoveAt > STUCK_MS) {
      // 무언가에 막혔다: 그 지점으로 옮기고 계속한다.
      this.host.placeHero(target.x, target.y);
      this.lastMoveAt = now;
      this.pathIndex++;
      return;
    }
    this.host.setHeroInput(dx / distance, dy / distance);
  }

  private finish(skipped: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.host.setHeroInput(0, 0);
    if (skipped) this.host.closeDialogue();
    const scene = this.host.scene;
    for (const object of this.objects) scene.tweens.killTweensOf(object);
    for (const object of this.objects) object.destroy();
    for (const emote of this.emotes) emote.text.destroy();
    this.emotes = [];
    this.host.followHero();
    this.host.finish(skipped);
  }

  /** 대상의 지금 위치 */
  private where(target: CutsceneTarget): Point | undefined {
    if (target === 'hero') return this.host.hero();
    if (typeof target === 'string') {
      const npc = this.host.npc(target);
      return npc ? { x: npc.x, y: npc.y } : undefined;
    }
    return target;
  }

  /** 머리 위 높이(발에서) */
  private headOf(who: NamedNpcId | 'hero'): Point | undefined {
    if (who === 'hero') {
      const hero = this.host.hero();
      return { x: hero.x, y: hero.y - 200 };
    }
    const npc = this.host.npc(who);
    return npc ? { x: npc.x, y: npc.y - npc.def.height - 34 } : undefined;
  }

  private showEmote(who: NamedNpcId | 'hero', text: string, now: number): void {
    const head = this.headOf(who);
    if (!head) return;
    const label = this.host.scene.add.text(head.x, head.y, text, {
      fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#1a1008', backgroundColor: '#fff6e0', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 1).setDepth(DEPTH_UI - 10).setResolution(2);
    this.emotes.push({ text: label, who, until: now + EMOTE_MS });
  }

  /** 표시는 머리를 따라다니며 살짝 떠오르고, 시간이 지나면 사라진다. */
  private updateEmotes(now: number): void {
    this.emotes = this.emotes.filter((emote) => {
      const left = emote.until - now;
      if (left <= 0) {
        emote.text.destroy();
        return false;
      }
      const head = this.headOf(emote.who);
      const rise = (1 - left / EMOTE_MS) * 18;
      if (head) emote.text.setPosition(head.x, head.y - rise);
      emote.text.setAlpha(Math.min(1, left / 300));
      return true;
    });
  }

  private fade(target: Phaser.GameObjects.GameObject, alpha: number, duration: number): void {
    this.host.scene.tweens.add({ targets: target, alpha, duration, ease: 'Sine.easeInOut' });
  }

  private get objects(): Phaser.GameObjects.GameObject[] {
    return [this.shade, this.caption, ...this.bars, this.skipButton];
  }
}
