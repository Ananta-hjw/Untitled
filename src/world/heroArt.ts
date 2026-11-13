import Phaser from 'phaser';
// `?inline`: 이미지를 코드 안에 포함시켜서 어떤 방식으로 배포해도 별도 파일 요청이 없게 한다.
import walkSheet from '../assets/hero/walk.png?inline';

/**
 * 주인공 그림.
 *
 * `src/assets/hero/walk.png`는 `tools/cut_sprites.py`로 원본 시트에서 잘라낸
 * 오른쪽 보는 걷기 4프레임이다 (0: 서 있음, 1: 걸음, 2: 서 있음, 3: 걸음).
 *
 * 아직 없는 그림:
 *  - 공격 3종: 지금은 걸음 프레임을 세워 두고 Character가 몸을 기울여서 흉내 낸다.
 *  - 대기: 서 있는 프레임 한 장에 Character가 숨쉬는 움직임을 더한다.
 * 전용 프레임이 생기면 아래 애니메이션 정의만 바꾸면 된다.
 */
export const HERO = {
  key: 'hero',
  frameWidth: 256,
  frameHeight: 296,
  /** 원본 프레임을 화면에 그릴 때의 배율 */
  scale: 0.66,
};

export function preloadHero(scene: Phaser.Scene): void {
  scene.load.spritesheet(HERO.key, walkSheet, {
    frameWidth: HERO.frameWidth,
    frameHeight: HERO.frameHeight,
  });
}

export function registerHero(scene: Phaser.Scene): void {
  const frames = (indices: number[]) => indices.map((frame) => ({ key: HERO.key, frame }));

  scene.anims.create({ key: 'hero-idle', frames: frames([0]), frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'hero-walk', frames: frames([1, 0, 3, 2]), frameRate: 7, repeat: -1 });

  // 공격 프레임이 없어서 걸음 자세 한 장을 공격 시간만큼 보여 준다.
  const attackMs = [260, 260, 340];
  attackMs.forEach((duration, i) => {
    scene.anims.create({ key: `hero-attack${i + 1}`, frames: frames([1]), duration, repeat: 0 });
  });
}
