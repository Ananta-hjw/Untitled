import Phaser from 'phaser';

export interface CharacterOptions {
  /** 텍스처/애니메이션 키 접두어. `${key}-idle`, `${key}-walk` 애니메이션이 있어야 한다. */
  key: string;
  name?: string;
  level?: number;
  /** 머리 위 이름표 높이(발 기준) */
  labelOffset?: number;
  shadowWidth?: number;
}

/**
 * 필드 위에 서 있는 모든 것(플레이어, NPC, 몬스터)의 공통 틀.
 *
 * 위치(x, y)는 "발"의 위치다. 매 프레임 깊이를 y로 맞추기 때문에
 * 화면 아래쪽에 있는 캐릭터가 자연스럽게 앞에 그려진다.
 *
 * 아트 교체 시: 옆모습(오른쪽 보는 방향) 한 벌만 준비하고
 * 같은 이름의 애니메이션(`idle`, `walk`)으로 등록하면 이 클래스는 그대로 쓸 수 있다.
 */
export class Character extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;
  private moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: CharacterOptions) {
    super(scene, x, y);
    this.key = options.key;

    const shadow = scene.add.image(0, 0, 'shadow').setAlpha(0.45);
    shadow.setDisplaySize(options.shadowWidth ?? 90, (options.shadowWidth ?? 90) * 0.3);
    this.add(shadow);

    this.sprite = scene.add.sprite(0, 0, `${options.key}-idle0`).setOrigin(0.5, 1);
    this.sprite.play(`${options.key}-idle`);
    this.add(this.sprite);

    if (options.name) {
      const top = -(options.labelOffset ?? this.sprite.height + 8);
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

    scene.add.existing(this);
    this.setDepth(y);
  }

  /** 이동 여부와 바라보는 방향을 알려주면 애니메이션을 맞춰 준다. */
  setMotion(moving: boolean, directionX = 0, animSpeed = 1): void {
    if (directionX > 0.05) this.sprite.setFlipX(false);
    else if (directionX < -0.05) this.sprite.setFlipX(true);

    if (moving !== this.moving) {
      this.moving = moving;
      this.sprite.play(`${this.key}-${moving ? 'walk' : 'idle'}`);
    }
    this.sprite.anims.timeScale = moving ? Phaser.Math.Clamp(animSpeed, 0.45, 1.2) : 1;
  }

  /** 발 위치를 옮기고 깊이(Y정렬)를 갱신한다. */
  placeAt(x: number, y: number): void {
    this.setPosition(x, y);
    this.setDepth(y);
  }
}
