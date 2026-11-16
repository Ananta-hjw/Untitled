import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import type { DialogueLine } from '../story/dialogues';
import type { OpeningStep } from '../story/opening';
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
}

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const BAR = 54;
/** 시온이 한 지점에 이만큼 가까워지면 다음 지점으로 간다 */
const ARRIVE = 14;
/** 막혀서 이만큼(게임 시간) 거의 움직이지 못하면 그 지점으로 옮긴다 */
const STUCK_MS = 1500;

/**
 * 오프닝 대본(story/opening.ts)을 차례로 실행한다: 자막, 시온과 마을 사람의 이동, 대화.
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
        case 'face': {
          const hero = this.host.hero();
          this.host.npc(step.id)?.faceTowards(hero.x, hero.y);
          continue;
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
          this.host.npc(step.id)?.walkTo(step.path);
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
    this.host.finish(skipped);
  }

  private fade(target: Phaser.GameObjects.GameObject, alpha: number, duration: number): void {
    this.host.scene.tweens.add({ targets: target, alpha, duration, ease: 'Sine.easeInOut' });
  }

  private get objects(): Phaser.GameObjects.GameObject[] {
    return [this.shade, this.caption, ...this.bars, this.skipButton];
  }
}
