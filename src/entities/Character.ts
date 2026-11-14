import Phaser from 'phaser';
import { HeroRig } from './HeroRig';

export interface CharacterOptions {
  /** 텍스처/애니메이션 키 접두어. `${key}-idle`, `${key}-walk` 애니메이션이 있어야 한다. */
  key: string;
  name?: string;
  level?: number;
  /** 머리 위 이름표 높이(발 기준) */
  labelOffset?: number;
  shadowWidth?: number;
  maxHp?: number;
  /** 맞았을 때 머리 위에 체력 막대를 보여줄지 */
  showHpBar?: boolean;
  /** 그림을 화면에 그릴 때의 배율 */
  scale?: number;
  /** 스프라이트 대신 뼈대 캐릭터를 쓴다. 애니메이션 이름은 같은 규칙(`${key}-idle` 등)을 따른다. */
  rig?: boolean;
}

const HP_BAR_WIDTH = 70;

/**
 * 필드 위에 서 있는 모든 것(플레이어, NPC, 몬스터)의 공통 틀.
 *
 * 위치(x, y)는 "발"의 위치다. 깊이를 y로 맞추기 때문에
 * 화면 아래쪽에 있는 캐릭터가 자연스럽게 앞에 그려진다.
 *
 * 몸은 프레임 스프라이트(NPC, 몬스터)이거나 뼈대 캐릭터(주인공)다.
 * 어느 쪽이든 `${key}-idle`, `${key}-walk` 같은 이름으로 동작을 재생한다.
 */
export class Character extends Phaser.GameObjects.Container {
  /** 캐릭터의 몸. 프레임 스프라이트이거나 뼈대 캐릭터다. */
  readonly sprite: Phaser.GameObjects.Sprite | HeroRig;
  readonly maxHp: number;
  hp: number;
  alive = true;
  /** 1 = 오른쪽, -1 = 왼쪽 */
  facing: 1 | -1 = 1;
  /** 맞아서 밀려나는 속도(px/초). 씬이 매 프레임 적용하고 줄여 나간다. */
  readonly knockback = new Phaser.Math.Vector2();
  invulnerableUntil = 0;

  private readonly key: string;
  private readonly baseScale: number;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly hpBar?: Phaser.GameObjects.Graphics;
  private readonly hpBarY: number;
  private moving = false;
  private attacking = false;
  private dodging = false;
  private flashTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, options: CharacterOptions) {
    super(scene, x, y);
    this.key = options.key;
    this.baseScale = options.scale ?? 1;
    this.maxHp = options.maxHp ?? 1;
    this.hp = this.maxHp;

    this.shadow = scene.add.image(0, 0, 'shadow').setAlpha(0.45);
    this.shadow.setDisplaySize(options.shadowWidth ?? 90, (options.shadowWidth ?? 90) * 0.3);
    this.add(this.shadow);

    if (options.rig) {
      this.sprite = new HeroRig(scene).setScale(this.baseScale);
    } else {
      const first = scene.anims.get(`${options.key}-idle`)!.frames[0]!;
      this.sprite = scene.add
        .sprite(0, 0, first.textureKey, first.textureFrame)
        .setOrigin(0.5, 1)
        .setScale(this.baseScale);
    }
    this.sprite.play(`${options.key}-idle`);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.attacking) this.endAttack();
    });
    this.add(this.sprite);

    const top = -(options.labelOffset ?? this.sprite.displayHeight + 8);
    this.hpBarY = top;

    if (options.name) {
      const label = scene.add
        .text(0, top - 20, options.name, {
          fontFamily: 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#f5ead2',
          stroke: '#1a1008',
          strokeThickness: 5,
        })
        .setOrigin(0.5, 1)
        .setResolution(2);
      this.add(label);

      if (options.level !== undefined) {
        const level = scene.add
          .text(0, top, `Lv. ${options.level}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '17px',
            fontStyle: 'bold',
            color: '#f0b445',
            stroke: '#1a1008',
            strokeThickness: 4,
          })
          .setOrigin(0.5, 1)
          .setResolution(2);
        this.add(level);
      }
    }

    if (options.showHpBar) {
      this.hpBar = scene.add.graphics().setVisible(false);
      this.add(this.hpBar);
    }

    scene.add.existing(this);
    this.setDepth(y);
  }

  get isAttacking(): boolean {
    return this.attacking;
  }

  face(direction: number): void {
    if (direction > 0.05) this.facing = 1;
    else if (direction < -0.05) this.facing = -1;
    this.sprite.setFlipX(this.facing === -1);
  }

  /** 이동 여부와 바라보는 방향을 알려주면 애니메이션을 맞춰 준다. 공격 중에는 공격 동작이 우선한다. */
  setMotion(moving: boolean, directionX = 0, animSpeed = 1): void {
    if (this.attacking) {
      this.moving = moving;
      return;
    }
    this.face(directionX);
    if (moving !== this.moving) {
      this.moving = moving;
      this.sprite.play(`${this.key}-${moving ? 'walk' : 'idle'}`);
    }
    this.sprite.anims.timeScale = moving ? Phaser.Math.Clamp(animSpeed, 0, 1.2) : 1;
  }

  /** 공격 동작(콤보 단계 1~)을 한 번 재생하고, 끝나면 원래 동작으로 돌아간다. */
  playAttack(stage = 1): void {
    this.attacking = true;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(`${this.key}-attack${stage}`);
  }

  /** 공격 동작을 중간에 끊는다 (회피 등). */
  endAttack(): void {
    if (!this.attacking) return;
    this.attacking = false;
    this.sprite.play(`${this.key}-${this.moving ? 'walk' : 'idle'}`);
  }

  /** 회피 자세로 들어가거나 나온다. `${key}-dodge` 애니메이션이 있는 캐릭터에만 쓴다. */
  setDodging(dodging: boolean): void {
    if (dodging === this.dodging) return;
    this.dodging = dodging;
    this.sprite.setAlpha(dodging ? 0.85 : 1);
    this.sprite.play(`${this.key}-${dodging ? 'dodge' : this.moving ? 'walk' : 'idle'}`);
  }

  /** 발 위치를 옮기고 깊이(Y정렬)를 갱신한다. */
  placeAt(x: number, y: number): void {
    this.setPosition(x, y);
    this.setDepth(y);
  }

  /** 피해를 준다. 이번 타격으로 쓰러졌으면 true. */
  hurt(amount: number, flashColor = 0xffffff): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.flash(flashColor);
    this.drawHpBar();
    if (this.hp > 0) return false;
    this.alive = false;
    return true;
  }

  /** 쓰러지는 연출 */
  playDeath(): void {
    this.attacking = false;
    this.knockback.set(0, 0);
    this.hpBar?.setVisible(false);
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeIn',
    });
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: this.baseScale * 0.25,
      scaleX: this.baseScale * 1.3,
      duration: 380,
      ease: 'Quad.easeIn',
    });
  }

  revive(x: number, y: number): void {
    this.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.alive = true;
    this.hp = this.maxHp;
    this.attacking = false;
    this.dodging = false;
    this.moving = false;
    this.knockback.set(0, 0);
    this.sprite.setScale(this.baseScale).setAngle(0).setAlpha(1).setPosition(0, 0);
    this.sprite.play(`${this.key}-idle`);
    this.shadow.setAlpha(0.45);
    this.hpBar?.setVisible(false);
    this.placeAt(x, y);
  }

  private flash(color: number): void {
    this.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(90, () => {
      this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  private drawHpBar(): void {
    const bar = this.hpBar;
    if (!bar) return;
    const ratio = this.hp / this.maxHp;
    bar.setVisible(this.hp > 0);
    bar.clear();
    bar.fillStyle(0x1a1008, 0.9);
    bar.fillRoundedRect(-HP_BAR_WIDTH / 2 - 2, this.hpBarY - 12, HP_BAR_WIDTH + 4, 12, 4);
    bar.fillStyle(0xd9483b);
    bar.fillRoundedRect(-HP_BAR_WIDTH / 2, this.hpBarY - 10, Math.max(4, HP_BAR_WIDTH * ratio), 8, 3);
  }
}
