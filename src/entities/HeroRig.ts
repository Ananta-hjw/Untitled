import Phaser from 'phaser';
import type { Blade } from '../combat/blade';
import rigData from '../assets/hero/rig.json';
// `?inline`: 이미지를 코드 안에 포함시켜서 어떤 방식으로 배포해도 별도 파일 요청이 없게 한다.
import rigSheet from '../assets/hero/rig.png?inline';
import { HERO_ANIMATIONS, REST, type Pose } from './heroAnimations';

/**
 * 뼈대 애니메이션 캐릭터.
 *
 * 부위별 그림(`rig.png`)을 뼈대(`rig.json`)에 붙이고, 매 프레임 뼈의 회전값만 바꿔서 움직인다.
 * 그림과 뼈대 데이터는 `tools/build_hero_rig.py`가 만들고, 동작은 `heroAnimations.ts`에 있다.
 *
 * Character가 스프라이트와 같은 방식으로 다룰 수 있도록
 * `play`, `setFlipX`, `setTint` 등 필요한 만큼만 같은 이름으로 맞춰 두었다.
 */

const TEXTURE = 'hero-rig';
/** 생성된 SD 리그의 발 원점부터 머리끝까지 높이. 이름표 위치에 사용한다. */
export const HERO_RIG_HEIGHT = rigData.height;

interface Bone {
  name: string;
  parent: Bone | null;
  /** 부모 관절에서 본 위치 (쉬는 자세) */
  x: number;
  y: number;
  /** 현재 회전(도). 쉬는 자세는 0 */
  rotation: number;
  worldX: number;
  worldY: number;
  worldRotation: number;
}

interface Slot {
  image: Phaser.GameObjects.Image;
  bone: Bone;
  /** 쉬는 자세에서의 그림 각도(도) */
  rotation: number;
}

export function preloadHeroRig(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE)) scene.load.image(TEXTURE, rigSheet);
}

function ensureFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(TEXTURE);
  for (const [name, f] of Object.entries(rigData.frames)) {
    if (!texture.has(name)) texture.add(name, 0, f.x, f.y, f.w, f.h);
  }
}

const DEG = Math.PI / 180;

export class HeroRig extends Phaser.GameObjects.Container {
  /** 스프라이트의 `anims.timeScale`과 같은 역할: 걷기 등 반복 동작의 재생 속도 */
  readonly anims = { timeScale: 1 };
  flipX = false;

  private readonly inner: Phaser.GameObjects.Container;
  private readonly bones: Bone[] = [];
  private readonly boneByName = new Map<string, Bone>();
  private readonly slots: Slot[] = [];
  private readonly hip: Bone;
  private readonly hipRest: { x: number; y: number };

  private animation = 'idle';
  private time = 0;
  private finished = false;
  private transitionFrom: Pose = {};
  /** 동작이 바뀔 때 뚝 끊기지 않도록, 목표 자세를 향해 부드럽게 따라간다. */
  private readonly current: Record<string, number> = {};
  private offsetX = 0;
  private offsetY = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    ensureFrames(scene);

    this.inner = scene.add.container(0, 0);
    this.add(this.inner);

    for (const b of rigData.bones) {
      const bone: Bone = {
        name: b.name,
        parent: b.parent ? this.boneByName.get(b.parent)! : null,
        x: b.x,
        y: b.y,
        rotation: 0,
        worldX: 0,
        worldY: 0,
        worldRotation: 0,
      };
      this.bones.push(bone);
      this.boneByName.set(bone.name, bone);
      this.current[bone.name] = 0;
    }
    this.hip = this.boneByName.get('hip')!;
    this.hipRest = { x: this.hip.x, y: this.hip.y };

    for (const s of rigData.slots) {
      const image = scene.add.image(0, 0, TEXTURE, s.part).setOrigin(s.originX, s.originY);
      this.inner.add(image);
      this.slots.push({ image, bone: this.boneByName.get(s.bone)!, rotation: s.rotation });
    }

    this.applyPose();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
    });
  }

  /** `hero-walk`처럼 접두어가 붙은 이름도 받는다. */
  play(key: string): this {
    const name = key.includes('-') ? key.slice(key.lastIndexOf('-') + 1) : key;
    if (!HERO_ANIMATIONS[name]) return this;
    // 한 바퀴 돌린 팔(360도)이 반대로 풀리지 않도록 각도를 가까운 값으로 정리한다.
    for (const bone of this.bones) {
      this.current[bone.name] = Phaser.Math.Angle.WrapDegrees(this.current[bone.name]);
    }
    // 공격 연결 시 현재 자세에서 출발해 기본 자세를 거치지 않는다.
    this.transitionFrom = { ...this.current, x: this.offsetX, y: this.offsetY };
    this.animation = name;
    this.time = 0;
    this.finished = false;
    return this;
  }

  setFlipX(flip: boolean): this {
    this.flipX = flip;
    this.inner.setScale(flip ? -1 : 1, 1);
    return this;
  }

  setTint(color: number): this {
    for (const slot of this.slots) slot.image.setTint(color);
    return this;
  }

  setTintMode(mode: Phaser.TintModes): this {
    for (const slot of this.slots) slot.image.setTintMode(mode);
    return this;
  }

  clearTint(): this {
    for (const slot of this.slots) slot.image.clearTint();
    return this;
  }

  /** 검 이미지의 가드와 끝을 실제 컨테이너 배율·좌우 반전까지 적용한 월드 좌표로 반환한다. */
  getBlade(): Blade {
    const image = this.slots.find((slot) => slot.bone.name === 'sword')!.image;
    const matrix = image.getWorldTransformMatrix();
    const point = (x: number, y: number) => matrix.transformPoint(
      (x - image.originX) * image.width, (y - image.originY) * image.height,
    );
    return { base: point(0.5, 0.32), tip: point(0.5, 0.98) };
  }

  /** 지금 자세 그대로 멈춘 잔상을 만든다 (회피 연출용). */
  spawnGhost(x: number, y: number, depth: number, tint: number, alpha: number,
    reuse?: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const ghost = reuse ?? this.scene.add.container(x, y);
    ghost.setPosition(x, y).setDepth(depth).setAlpha(alpha).setActive(true).setVisible(true);
    ghost.setScale(this.scaleX * (this.flipX ? -1 : 1), this.scaleY).setAngle(this.angle);
    for (let i = 0; i < this.slots.length; i++) {
      const source = this.slots[i].image;
      const copy = reuse ? ghost.getAt(i) as Phaser.GameObjects.Image
        : this.scene.add.image(0, 0, TEXTURE, source.frame.name);
      copy.setPosition(source.x, source.y).setOrigin(source.originX, source.originY)
        .setAngle(source.angle).setTint(tint);
      if (!reuse) ghost.add(copy);
    }
    return ghost;
  }

  private onSceneUpdate(_time: number, delta: number): void {
    if (!this.active) return;
    const dt = Math.min(delta, 50) / 1000;
    const animation = HERO_ANIMATIONS[this.animation];
    this.time += dt * (animation.loop ? this.anims.timeScale : 1);

    let phase = this.time / animation.duration;
    let complete = false;
    if (animation.loop) {
      phase %= 1;
    } else if (phase >= 1) {
      phase = 1;
      if (!this.finished) {
        this.finished = true;
        complete = true;
      }
    }

    const target = animation.pose(phase);
    const attack = this.animation.startsWith('attack');
    // 공격 키프레임에는 이미 가감속이 있다. 추가 추종 지연 없이 타격 자세를 맞춘다.
    const follow = attack ? 1 : Math.min(1, dt * animation.follow);
    const blend = attack ? Math.min(1, this.time / 0.06) : 1;
    for (const bone of this.bones) {
      const name = bone.name as keyof Pose;
      const value = target[name] ?? REST[name] ?? 0;
      const from = this.transitionFrom[name] ?? REST[name] ?? 0;
      const goal = from + (value - from) * blend;
      this.current[bone.name] += ((goal as number) - this.current[bone.name]) * follow;
    }
    const x = (this.transitionFrom.x ?? 0) * (1 - blend) + (target.x ?? 0) * blend;
    const y = (this.transitionFrom.y ?? 0) * (1 - blend) + (target.y ?? 0) * blend;
    this.offsetX += (x - this.offsetX) * follow;
    this.offsetY += (y - this.offsetY) * follow;
    this.applyPose();
    // 콜백이 다음 동작을 시작해도 이전 동작의 자세로 덮어쓰지 않는다.
    if (complete) this.emit(Phaser.Animations.Events.ANIMATION_COMPLETE);
  }

  /** 뼈의 회전값을 부모에서 자식 순서로 누적해서 각 그림의 위치와 각도를 정한다. */
  private applyPose(): void {
    this.hip.x = this.hipRest.x + this.offsetX;
    this.hip.y = this.hipRest.y + this.offsetY;

    for (const bone of this.bones) {
      bone.rotation = this.current[bone.name];
      const parent = bone.parent;
      if (!parent) {
        bone.worldX = bone.x;
        bone.worldY = bone.y;
        bone.worldRotation = bone.rotation;
        continue;
      }
      const angle = parent.worldRotation * DEG;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      bone.worldX = parent.worldX + bone.x * cos - bone.y * sin;
      bone.worldY = parent.worldY + bone.x * sin + bone.y * cos;
      bone.worldRotation = parent.worldRotation + bone.rotation;
    }

    for (const slot of this.slots) {
      slot.image.setPosition(slot.bone.worldX, slot.bone.worldY);
      slot.image.setAngle(slot.rotation + slot.bone.worldRotation);
    }
  }
}
