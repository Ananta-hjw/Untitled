import Phaser from 'phaser';
import { MAX_ASPECT, MIN_ASPECT, VIEW_HEIGHT } from './config';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';

/** 화면 높이는 720으로 고정하고, 기기 비율에 맞춰 너비만 정한다. */
function viewWidth(): number {
  const aspect = Phaser.Math.Clamp(window.innerWidth / Math.max(1, window.innerHeight), MIN_ASPECT, MAX_ASPECT);
  return Math.round(VIEW_HEIGHT * aspect);
}

// 처음 화면(TitleScene)에서 시작한다. 개발 중 ?map=으로 특정 맵을 열면(브라우저 테스트 포함) 처음 화면을 건너뛴다.
const skipTitle = import.meta.env.DEV && new URLSearchParams(window.location.search).has('map');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0907',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: viewWidth(),
    height: VIEW_HEIGHT,
  },
  // 동시에 누를 수 있는 터치 수: 조이스틱 + 공격 + 회피
  input: { activePointers: 3 },
  scene: skipTitle ? [GameScene, TitleScene] : [TitleScene, GameScene],
});

function resize(): void {
  const width = viewWidth();
  if (width !== game.scale.gameSize.width) game.scale.setGameSize(width, VIEW_HEIGHT);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// 길게 눌렀을 때 뜨는 메뉴가 조작을 방해하지 않게 막는다.
window.addEventListener('contextmenu', (event) => event.preventDefault());

if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
