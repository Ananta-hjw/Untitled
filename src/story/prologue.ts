/**
 * 세계관 프롤로그 시놉시스(5컷 스틸컷 연출 대본).
 * - 본편의 핵심 스포일러(시온의 정체, 시아·리네아의 운명, 계승자·배신 등)는 전혀 드러내지 않는다.
 * - `src/assets/prologue/cut1.png` ~ `cut5.png` 정지 이미지를 교체하면 코드 수정 없이 일러스트가 반영된다.
 * - 이 파일은 Phaser를 쓰지 않아 `tools/prologue.test.mjs`가 직접 검사한다.
 */

export interface PrologueCamera {
  startScale: number;
  endScale: number;
  /** 이미지 중앙 기준 가로/세로 이동 오프셋(화면 폭·높이 비율, -0.06 ~ 0.06 권장) */
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export interface PrologueSlide {
  id: 'cut1' | 'cut2' | 'cut3' | 'cut4' | 'cut5';
  caption: string;
  lines: readonly [string, string];
  durationMs: number;
  accentColor: number;
  camera: PrologueCamera;
}

export interface MythicGodBeast {
  god: string;
  faction: '유지' | '해체';
  authority: string;
  elements: string;
  beast: string;
}

/** 여섯 신의 우주 신수(神獸) 형상 기준 (`docs/story.md` 권능·원소 기준). */
export const MYTHIC_GOD_BEASTS: readonly MythicGodBeast[] = [
  { god: '아우레아', faction: '유지', authority: '창조', elements: '생명 · 물', beast: '천록 (세계수 뿔의 백록)' },
  { god: '세르딘', faction: '유지', authority: '질서', elements: '번개 · 중력', beast: '청룡 (궤도 고리와 뇌전의 용)' },
  { god: '바르덴', faction: '유지', authority: '수호', elements: '대지 · 얼음', beast: '현무 (산맥과 빙하 등껍질의 거북)' },
  { god: '드라칸', faction: '해체', authority: '파괴', elements: '불 · 금속', beast: '주작 (금속 깃털과 항성 불꽃의 불사조)' },
  { god: '자이레스', faction: '해체', authority: '혼돈', elements: '바람 · 환영', beast: '천호 (성운 안개와 폭풍의 구미호)' },
  { god: '네이룬', faction: '해체', authority: '소멸', elements: '그림자 · 부식', beast: '흑봉 (별빛을 꺼뜨리는 심연의 까마귀)' },
];

export const PROLOGUE_SLIDES: readonly PrologueSlide[] = [
  {
    id: 'cut1',
    caption: 'I. 태초의 분화',
    lines: [
      '태초에 빛과 허무를 품은 근원이 조화를 바라며',
      '권능을 여섯으로 나누어 신들을 빚고, 힘을 다해 잠들었다.',
    ],
    durationMs: 7000,
    accentColor: 0xffe4a8,
    camera: { startScale: 1.02, endScale: 1.12, startX: 0, endX: 0, startY: 0.01, endY: -0.01 },
  },
  {
    id: 'cut2',
    caption: 'II. 마지막 눈물',
    lines: [
      '잠들기 직전 떨어진 마지막 눈물 한 방울이 에르다인에 내려앉아',
      '바깥으로부터 세계를 감추는 결계를 펼쳤고, 그 안에서 인간이 태어났다.',
    ],
    durationMs: 7200,
    accentColor: 0x9ce2ff,
    camera: { startScale: 1.08, endScale: 1.01, startX: -0.025, endX: 0.02, startY: -0.015, endY: 0.01 },
  },
  {
    id: 'cut3',
    caption: 'III. 오천 년의 전쟁',
    lines: [
      '결계 너머 아득한 우주에서는 서로의 권능을 용납 못 한 여섯 신이',
      '유지와 해체로 갈라져 오천 년 동안 우주를 황폐하게 만드는 전쟁을 벌였다.',
    ],
    durationMs: 7800,
    accentColor: 0xffb67a,
    camera: { startScale: 1.0, endScale: 1.11, startX: -0.01, endX: 0.01, startY: 0.01, endY: -0.01 },
  },
  {
    id: 'cut4',
    caption: 'IV. 파국과 닫힌 시공',
    lines: [
      '정면으로 충돌한 여섯 권능은 여섯 개의 닫힌 시공을 만들어 신들을 끌어들였고',
      '그 거대한 여파가 에르다인을 감싸던 결계를 산산이 무너뜨렸다.',
    ],
    durationMs: 7800,
    accentColor: 0xd9c2ff,
    camera: { startScale: 1.08, endScale: 1.0, startX: -0.025, endX: 0.025, startY: 0, endY: 0.01 },
  },
  {
    id: 'cut5',
    caption: 'V. 남겨진 잔해와 현재',
    lines: [
      '결계가 사라진 땅에 전쟁의 잔해와 권속, 신들이 보낸 여섯 유산이 내려앉은 뒤',
      '오랜 세월이 흘렀다. — 이제 변방의 작은 마을에, 평화로운 아침이 밝아 온다.',
    ],
    durationMs: 7800,
    accentColor: 0xffd79a,
    camera: { startScale: 1.06, endScale: 1.0, startX: 0, endX: 0, startY: -0.025, endY: 0.02 },
  },
];

export const PROLOGUE_SAVE_KEY = 'untitled-rpg.prologue';

export function shouldPlayPrologue(options: { hasProgress: boolean; seen: boolean; forced?: boolean }): boolean {
  if (options.forced) return true;
  return !options.hasProgress && !options.seen;
}

export function prologueTotalMs(): number {
  return PROLOGUE_SLIDES.reduce((sum, slide) => sum + slide.durationMs, 0);
}
