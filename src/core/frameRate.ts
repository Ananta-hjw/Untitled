/**
 * 화면을 그리는 횟수 제한. 120Hz·144Hz 화면의 휴대폰은 제한이 없으면 1초에 120번 넘게 그려
 * 같은 장면에 두 배 이상의 계산과 전력을 쓰고 금방 뜨거워진다.
 * 플레이 중에는 1초에 60번, 메뉴·대화·창이 열려 게임이 멈춰 있을 때는 30번만 그린다.
 * Phaser를 쓰지 않아 tools/frame-rate.test.mjs가 직접 불러 검사한다.
 */

export const PLAY_FPS = 60;
export const IDLE_FPS = 30;
/**
 * 목표 간격보다 이만큼(비율) 일찍 와도 그린다. 60Hz 화면의 프레임 간격은 조금씩 흔들려
 * 16.67ms보다 살짝 짧게 오기도 하는데, 그때 건너뛰면 한 프레임씩 끊긴다.
 */
export const FRAME_SLACK = 0.2;

/** 지난번에 그린 뒤 elapsedMs가 지났을 때 이번 화면 갱신에서 그릴지 */
export function shouldRunFrame(elapsedMs: number, fps: number): boolean {
  return elapsedMs >= (1000 / fps) * (1 - FRAME_SLACK);
}

/** 지금 목표 횟수. 게임 장면이 매 프레임 정한다. */
export const frameRate = { fps: PLAY_FPS };
