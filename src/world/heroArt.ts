import Phaser from 'phaser';
// `?inline`: 이미지를 코드 안에 포함시켜서 어떤 방식으로 배포해도 별도 파일 요청이 없게 한다.
import attackSheet from '../assets/hero/attack.png?inline';
import walkSheet from '../assets/hero/walk.png?inline';

/**
 * 주인공 그림. 두 시트 모두 `tools/cut_sprites.py`로 원본에서 잘라냈고,
 * 캐릭터 키가 같아지도록 맞춰져 있다 (발이 칸의 가로 가운데·맨 아래).
 *
 *  - walk.png   오른쪽 보는 걷기 4프레임 (0: 서 있음, 1: 걸음, 2: 서 있음, 3: 걸음)
 *  - attack.png 내려베기 5프레임 (0: 치켜듦, 1: 휘두름, 2: 타격, 3: 마무리, 4: 복귀)
 *
 * 아직 없는 그림:
 *  - 대기: 서 있는 프레임 한 장에 Character가 숨쉬는 움직임을 더한다.
 *  - 콤보 2·3타 전용 동작: 세 번 모두 같은 내려베기를 속도만 바꿔 쓴다.
 * 전용 프레임이 생기면 아래 애니메이션 정의만 바꾸면 된다.
 */
export const HERO = {
  key: 'hero',
  /** 원본 프레임을 화면에 그릴 때의 배율 */
  scale: 0.66,
};

const WALK = { key: 'hero', frameWidth: 256, frameHeight: 296 };
const ATTACK = { key: 'hero-attack', frameWidth: 190, frameHeight: 322 };

export function preloadHero(scene: Phaser.Scene): void {
  scene.load.spritesheet(WALK.key, walkSheet, WALK);
  scene.load.spritesheet(ATTACK.key, attackSheet, ATTACK);
}

export function registerHero(scene: Phaser.Scene): void {
  const frames = (key: string, indices: number[]) => indices.map((frame) => ({ key, frame }));

  scene.anims.create({ key: 'hero-idle', frames: frames(WALK.key, [0]), frameRate: 1, repeat: -1 });
  scene.anims.create({ key: 'hero-walk', frames: frames(WALK.key, [1, 0, 3, 2]), frameRate: 7, repeat: -1 });

  // 타격 프레임(2번)이 config.ts의 콤보 hitDelayMs와 맞도록 속도를 정했다.
  // 18fps → 2번 프레임이 약 0.11초에, 13fps → 약 0.15초에 나온다.
  const attackFps = [18, 18, 13];
  attackFps.forEach((frameRate, i) => {
    scene.anims.create({
      key: `hero-attack${i + 1}`,
      frames: frames(ATTACK.key, [0, 1, 2, 3, 4]),
      frameRate,
      repeat: 0,
    });
  });
}
