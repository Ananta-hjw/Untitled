import Phaser from 'phaser';
import { MAX_ASPECT, MIN_ASPECT, VIEW_HEIGHT } from './config';
import { frameRate, shouldRunFrame } from './core/frameRate';
import { stabilizeTextureSampling } from './core/textureSampling';
import { GameScene } from './scenes/GameScene';
import { PrologueScene } from './scenes/PrologueScene';
import { TitleScene } from './scenes/TitleScene';

/** 화면 높이는 720으로 고정하고, 기기 비율에 맞춰 너비만 정한다. */
function viewWidth(): number {
  const aspect = Phaser.Math.Clamp(window.innerWidth / Math.max(1, window.innerHeight), MIN_ASPECT, MAX_ASPECT);
  return Math.round(VIEW_HEIGHT * aspect);
}

// 처음 화면(TitleScene)에서 시작한다. 개발 중 ?map=으로 특정 맵을 열면(브라우저 테스트 포함) 처음 화면을 건너뛴다.
// ?prologue로 열면 세계관 프롤로그 5컷 연출을 바로 재생한다.
const query = import.meta.env.DEV ? new URLSearchParams(window.location.search) : undefined;
const startPrologue = !!query?.has('prologue');
const skipTitle = !!query?.has('map');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0907',
  callbacks: { postBoot: stabilizeTextureSampling },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: viewWidth(),
    height: VIEW_HEIGHT,
  },
  // 동시에 누를 수 있는 터치 수: 조이스틱 + 공격 + 회피
  input: { activePointers: 3 },
  scene: startPrologue ? [PrologueScene, TitleScene, GameScene]
    : skipTitle ? [GameScene, TitleScene, PrologueScene]
      : [TitleScene, PrologueScene, GameScene],
});

// 화면 갱신(requestAnimationFrame)마다 그리지 않고 frameRate.fps만큼만 그린다(core/frameRate.ts).
// 건너뛴 갱신에서는 Phaser의 시계도 멈춰 있으므로, 다음에 그릴 때 지난 시간 전체가 한 번에 넘어간다.
// 간격은 Phaser의 lastTime이 아니라 우리가 마지막으로 그린 실제 시각(performance.now)으로 잰다.
// lastTime은 시작할 때 performance.now()로 잡히는데, 브라우저가 넘겨주는 프레임 시각은 그보다 뒤처질 수 있어서
// (헤드리스 브라우저 등) 그 차이로 재면 첫 프레임을 영영 건너뛰어 게임이 시작되지 않았다.
const loop = game.loop;
const loopStep = loop.step.bind(loop);
let lastDrawn = -Infinity;
loop.step = (time: number) => {
  const now = performance.now();
  if (!shouldRunFrame(now - lastDrawn, frameRate.fps)) return;
  lastDrawn = now;
  loopStep(time);
};

function resize(): void {
  const width = viewWidth();
  if (width !== game.scale.gameSize.width) game.scale.setGameSize(width, VIEW_HEIGHT);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// 길게 눌렀을 때 뜨는 메뉴가 조작을 방해하지 않게 막는다.
window.addEventListener('contextmenu', (event) => event.preventDefault());

if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
