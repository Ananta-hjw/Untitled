/**
 * 대사 모음.
 *
 * 스토리가 정해지기 전까지 쓰는 임시 대사다. 문장만 바꾸면 게임에 바로 반영된다.
 * 대화할 수 있는 대상과 위치는 src/world/interactables.ts에서 정한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/dialogue.test.mjs가 직접 불러 검사한다.
 */

import type { NpcId } from '../world/npcs.ts';

/** 대화창 왼쪽에 크게 나오는 그림. 마을 사람은 자기 id를 쓴다. 그림이 없는 화자(표지판 등)는 비워 둔다. */
export type Portrait = 'hero-neutral' | NpcId;

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: Portrait;
}

export const HERO_NAME = '시온';

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });

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

  // 로웬 마을 사람들의 첫날 대사 (docs/story-chapter1.md: 수확제 전날, 평화로운 하루)
  'npc-serena': [
    { speaker: '세레나', portrait: 'serena', text: '시온, 나가니? 오늘 저녁은 축제 전야니까 해 지기 전에 들어오렴.' },
    { speaker: '세레나', portrait: 'serena', text: '시아가 아침부터 뭘 그렇게 몰래 만드는지 모르겠구나. 너는 알고 있지?' },
    hero('글쎄요. 저도 비밀이라고 들었어요.'),
  ],
  'npc-sia': [
    { speaker: '시아', portrait: 'sia', text: '오빠! 리네아 언니 생일 선물, 엄마한테도 비밀이야. 알지?' },
    { speaker: '시아', portrait: 'sia', text: '요즘 밤마다 이상한 꿈을 꿔. 누가 멀리서 부르는 것 같은…' },
    { speaker: '시아', portrait: 'sia', text: '…아냐, 별거 아니야. 축제 때 같이 등불 띄우는 거 잊지 마!' },
  ],
  'npc-linea': [
    { speaker: '리네아', portrait: 'linea', text: '시온! 축제 장식은 거의 다 됐어. 너는 오늘도 수련이지?' },
    { speaker: '리네아', portrait: 'linea', text: '루안 아저씨가 너 찾던데. 늦으면 또 잔소리 들을걸?' },
    hero('알았어, 지금 갈게.'),
  ],
  'npc-ruan': [
    { speaker: '루안', portrait: 'ruan', text: '왔구나. 축제 전 마지막 수련이다. 대충 할 생각은 말아라.' },
    { speaker: '루안', portrait: 'ruan', text: '검은 힘으로 휘두르는 게 아니다. 상대를 보고, 물러설 때를 아는 거지.' },
    hero('네, 스승님.'),
  ],
  'npc-herman': [
    { speaker: '헤르만', portrait: 'herman', text: '축제 준비는 순조롭네. 올해는 수확도 넉넉하고.' },
    { speaker: '헤르만', portrait: 'herman', text: '…요즘 밤이 유난히 조용하구나. 괜한 걱정이겠지만.' },
  ],
  'npc-eila': [
    { speaker: '에일라', portrait: 'eila', text: '다친 데는 없지? 수련하다 다치면 참지 말고 바로 오렴.' },
    { speaker: '에일라', portrait: 'eila', text: '약초는 늘 넉넉히 말려 두니까. 축제 날엔 꼭 다치는 사람이 나오거든.' },
  ],
  'npc-merina': [
    { speaker: '메리나', portrait: 'merina', text: '어서 와! 축제 전이라 물약이 잘 나가. 하나 챙겨 둘래?' },
    { speaker: '메리나', portrait: 'merina', text: '장부를 보면 마을 사정이 다 보여. 올해는 다들 웃는 얼굴이야.' },
  ],
  'npc-doran': [
    { speaker: '도란', portrait: 'doran', text: '오, 시온! 그 나무칼 들고 또 수련 가냐?' },
    { speaker: '도란', portrait: 'doran', text: '언젠가 진짜 검 한 자루 두들겨 주마. 그때까지 손목 아껴 두라고!' },
  ],
  'npc-rosetta': [
    { speaker: '로제타', portrait: 'rosetta', text: '어머, 시온! 오늘 밤 여관에서 축제 전야 잔치 하는 거 알지?' },
    { speaker: '로제타', portrait: 'rosetta', text: '배고프면 언제든 들러. 국은 늘 끓고 있으니까.' },
  ],
  'npc-vernel': [
    { speaker: '베르넬', portrait: 'vernel', text: '아, 미안. 이 석판 조각에 정신이 팔려서 못 봤네.' },
    { speaker: '베르넬', portrait: 'vernel', text: '이 표식… 북쪽 유적에서 본 것과 비슷한데. 어디였더라.' },
  ],
  'npc-teon': [
    { speaker: '테온', portrait: 'teon', text: '시온! 오늘도 들판 나가? 슬라임 조심하고.' },
    { speaker: '테온', portrait: 'teon', text: '요즘 숲길 쪽에 마물이 늘었다더라. 그래도 내가 지키는 동안엔 걱정 마!' },
  ],
} satisfies Record<string, DialogueLine[]>;

export type DialogueId = keyof typeof DIALOGUES;
