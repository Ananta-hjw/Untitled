/**
 * 대사 모음.
 *
 * 스토리가 정해지기 전까지 쓰는 임시 대사다. 문장만 바꾸면 게임에 바로 반영된다.
 * 대화할 수 있는 대상과 위치는 src/world/interactables.ts에서 정한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/dialogue.test.mjs가 직접 불러 검사한다.
 */

/** 대화창 왼쪽에 크게 나오는 그림. 그림이 없는 화자(표지판 등)는 비워 둔다. */
export type Portrait = 'hero-neutral';

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: Portrait;
}

export const HERO_NAME = '용사';

export const DIALOGUES = {
  'home-door': [
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '우리 집이다. 문 앞 돌계단은 오늘도 반질반질하네.' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '요즘 들판에 슬라임이 늘었다고 했지. 한 바퀴 둘러보고 오자.' },
  ],
  'village-sign': [
    { speaker: '표지판', text: '로웬 마을\n남쪽: 들판 · 서쪽: 숲길 · 동쪽: 개울가' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '들판 쪽에 슬라임이 늘었다고 했지. 검은 제대로 챙겼고.' },
  ],
  'south-field-sign': [
    { speaker: '표지판', text: '남쪽 들판\n북쪽: 로웬 마을 (슬라임 출몰 주의)' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '풀이 무릎까지 자랐네. 슬라임이 숨어 있기 딱 좋겠어.' },
  ],
  'west-forest-sign': [
    { speaker: '표지판', text: '서쪽 숲길\n동쪽: 로웬 마을' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '나무가 빽빽해서 낮인데도 어둑하다. 길을 잃지 않게 조심하자.' },
  ],
  'east-stream-sign': [
    { speaker: '표지판', text: '동쪽 개울가\n서쪽: 로웬 마을' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '물소리가 시원하다. 발을 헛디디지 않게 조심하자.' },
  ],
} satisfies Record<string, DialogueLine[]>;

export type DialogueId = keyof typeof DIALOGUES;
