/**
 * 대사 모음.
 *
 * 스토리가 정해지기 전까지 쓰는 임시 대사다. 문장만 바꾸면 게임에 바로 반영된다.
 * 대화할 수 있는 대상과 위치는 src/world/interactables.ts에서 정한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/dialogue.test.mjs가 직접 불러 검사한다.
 */

import type { NpcSkin } from '../world/npcs.ts';

/** 대화창 왼쪽에 크게 나오는 그림. 마을 사람은 자기 id를 쓴다. 그림이 없는 화자(표지판 등)는 비워 둔다. */
export type Portrait = 'hero-neutral' | NpcSkin;

export interface DialogueLine {
  speaker: string;
  text: string;
  portrait?: Portrait;
}

export const HERO_NAME = '시온';

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });

export const DIALOGUES = {
  'toby-cocoon': [{ speaker: '시온', portrait: 'hero-neutral', text: '토비가 안에서 잠들어 있어. 숨은 쉬고 있어… 서둘러야 해.' }],
  'npc-toby': [{ speaker: '토비', portrait: 'toby', text: '풀무는 제가 맡을게요. 불이 약해지면 마르타 선생님이 바로 아시거든요.' }],
  'npc-bell-ringer': [{ speaker: '종을 울리던 사내', portrait: 'bell-ringer', text: '…시키는 대로 했을 뿐이야. 더는 묻지 마.' }],
  'npc-bell-ringer-mother': [{ speaker: '사내의 어머니', portrait: 'bell-ringer-mother', text: '우리 아들이 자꾸 늦게 오는구나. 내 약 때문에 무리하는 건 아닌지….' }],
  'npc-mill-apprentice': [{ speaker: '방앗간 젊은이', portrait: 'mill-apprentice', text: '형이… 군대에서 돌아오지 못한 친구 이름을 불렀어요.' }],
  'npc-fisher-daughter': [{ speaker: '어부의 딸', portrait: 'fisher-daughter', text: '아빠가 강에서 잃은 형 이름을 불렀어.' }],
  'npc-herbalist-elder': [{ speaker: '약초 가게 할머니', portrait: 'herbalist-elder', text: '영감이 먼저 간 딸아이를 찾는다고 문을 열었지.' }],
  'npc-bram': [{ speaker: '브람', portrait: 'bram', text: '앞서 가라. 뒤에 남은 사람은 내가 챙기겠다.' }],
  'npc-mirel': [{ speaker: '미렐', portrait: 'mirel', text: '잠깐 쉬어 가세요. 상처부터 살펴볼게요.' }],
  'npc-kairen': [{ speaker: '카이렌', portrait: 'kairen', text: '길을 지키는 것이 우리의 임무다. 목적지를 말해라.' }],
  'npc-velka': [{ speaker: '벨카', portrait: 'velka', text: '내 앞길은 내가 정해. 너도 남의 말만 듣고 걷지는 마.' }],
  'npc-razen': [{ speaker: '라젠', portrait: 'razen', text: '어떤 소식을 찾나? 듣고 싶은 말과 필요한 말은 다를 수 있지.' }],
  'east-pass-sign': [{ speaker: '이정표', text: '동쪽 고갯길 · 서쪽: 동쪽 개울가 · 동쪽: 물안개 나루\n고개 쉼터에서 쉬어 가세요. 안개 까마귀 무리를 조심하세요.' }],
  'npc-fog-innkeeper': [{ speaker: '여관 주인', portrait: 'fog-innkeeper', text: '방은 남아돌아. 묵어 갈 거면 밤엔 귀를 꼭 막고, 문 밖으로는 한 발짝도 나가지 말게.' }],
  'village-sign': [
    { speaker: '표지판', text: '로웬 마을 광장\n북쪽: 집들 · 남쪽: 들판 · 서쪽: 숲길 · 동쪽: 개울가' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '표지판에 누가 수확제 리본을 묶어 놨네. 리네아 솜씨다.' },
  ],
  'south-field-sign': [
    { speaker: '표지판', text: '남쪽 들판\n북쪽: 로웬 마을 (슬라임·물방울 버섯 출몰 주의)' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '풀이 무릎까지 자랐네. 슬라임이 숨어 있기 딱 좋겠어.' },
  ],
  'west-forest-sign': [
    { speaker: '표지판', text: '서쪽 숲길\n동쪽: 로웬 마을\n물방울 버섯·쇠비늘 도마뱀 출몰 주의' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '나무가 빽빽해서 낮인데도 어둑하다. 길을 잃지 않게 조심하자.' },
  ],
  'east-stream-sign': [
    { speaker: '표지판', text: '동쪽 개울가\n서쪽: 로웬 마을 · 동쪽: 동쪽 고갯길' },
    { speaker: HERO_NAME, portrait: 'hero-neutral', text: '물소리가 시원하다. 발을 헛디디지 않게 조심하자.' },
  ],

  'guard-west': [{ speaker: '서문 병사', portrait: 'soldier', text: '이 문을 나가면 서쪽 숲길입니다. 숲 안에서는 길을 따라 움직이고, 날이 어두워지기 전에 돌아오세요.' }],
  'guard-east': [{ speaker: '동문 병사', portrait: 'soldier', text: '동쪽 개울가로 가시나요? 젖은 바위가 미끄러우니 물가에서는 발밑을 잘 살피세요.' }],
  'guard-south': [{ speaker: '남문 병사', portrait: 'soldier', text: '남쪽 들판은 마을 밖입니다. 물약은 챙기셨죠? 무리하지 말고 위험하면 바로 돌아오세요.' }],
  'guard-patrol': [{ speaker: '순찰 병사', portrait: 'soldier', text: '마을을 순찰하고 있습니다. 도움이 필요하거나 수상한 것을 발견하면 저희에게 알려 주세요.' }],

  // 2장 인물의 기본 대사. 조안은 구출 뒤의 대사이며, 본편에서는 구출 단계에 맞춰 배치한다.
  'npc-evan': [
    { speaker: '에반', portrait: 'evan', text: '지금은 배를 띄우지 않아. 밤에 종이 울리거든… 귀를 막고 있어.' },
  ],
  'npc-joan': [
    { speaker: '조안', portrait: 'joan', text: '여울 너머까지는 내가 안내할게. 강가에서는 발밑부터 살펴.' },
  ],
  'npc-marta': [
    { speaker: '마르타', portrait: 'marta', text: '쇠도 청동도 서두르면 못 써. 어디, 고칠 물건이 있느냐?' },
  ],
  'npc-morgan': [
    { speaker: '모르간', portrait: 'morgan', text: '나루에 오신 걸 환영합니다. 곤란한 일이 있으면 말씀하시지요.' },
  ],
  'npc-finn': [
    { speaker: '핀', portrait: 'finn', text: '어른들은 내 말을 잘 안 믿어. 하지만 난 봤어. 밤에 강가에서.' },
  ],
  'npc-fern': [
    { speaker: '페른', portrait: 'fern', text: '어서 와. 길 떠나는 사람한테 필요한 건 다 있어. 천천히 골라 봐.' },
  ],
  'npc-dor': [
    { speaker: '도르', portrait: 'dor', text: '고개를 넘을 참인가? 물부터 한 모금 마시게. 산길에서는 쉬어 가는 것도 일이야.' },
  ],

  // 로웬 마을 사람들의 첫날 대사 (docs/story-chapter1.md: 수확제 전날, 평화로운 하루. 아주 작은 복선만 둔다)
  'npc-serena': [
    { speaker: '세레나', portrait: 'serena', text: '시온, 나가니? 오늘 저녁은 축제 전야니까 해 지기 전에 들어오렴.' },
    { speaker: '세레나', portrait: 'serena', text: '시아가 아침부터 뭘 그렇게 몰래 만드는지 모르겠구나. 너는 알고 있지?' },
    hero('글쎄요. 저도 비밀이라고 들었어요.'),
    { speaker: '세레나', portrait: 'serena', text: '너희 둘 다 비밀이 많아졌어. …다 컸다는 거겠지.' },
  ],
  'npc-sia': [
    { speaker: '시아', portrait: 'sia', text: '오빠! 리네아 언니 생일 선물, 엄마한테도 비밀이야. 알지?' },
    { speaker: '시아', portrait: 'sia', text: '아, 언니네 창문 끈이 또 헐거워졌대. 이따 내가 가서 묶어 줘야지. 내가 묶으면 안 풀리거든!' },
    { speaker: '시아', portrait: 'sia', text: '…요즘 밤마다 이상한 꿈을 꿔. 누가 멀리서 부르는 것 같은.' },
    { speaker: '시아', portrait: 'sia', text: '아냐, 별거 아니야. 축제 때 같이 등불 띄우는 거 잊지 마!' },
  ],
  'npc-linea': [
    { speaker: '리네아', portrait: 'linea', text: '시온! 축제 장식은 거의 다 됐어. 남은 들꽃은 우리 집 창가에 꽂아 뒀고.' },
    { speaker: '리네아', portrait: 'linea', text: '루안 아저씨가 너 찾던데. 광장 수련소에서 기다리신대. 늦으면 또 잔소리 들을걸?' },
    hero('알았어, 지금 갈게.'),
    { speaker: '리네아', portrait: 'linea', text: '오늘 밤 잔치 끝나면 시아랑 셋이서 등불 띄우자. 약속이야.' },
  ],
  'npc-ruan': [
    { speaker: '루안', portrait: 'ruan', text: '왔구나. 축제 전 마지막 수련이다. 대충 할 생각은 말아라.' },
    { speaker: '루안', portrait: 'ruan', text: '검은 힘으로 휘두르는 게 아니다. 상대를 보고, 물러설 때를 아는 거지.' },
    { speaker: '루안', portrait: 'ruan', text: '…그리고 등 뒤에 누가 있는지 잊지 않는 것. 나는 그걸 늦게 배웠다.' },
    hero('네, 스승님.'),
  ],
  'npc-herman': [
    { speaker: '헤르만', portrait: 'herman', text: '축제 준비는 순조롭네. 올해는 수확도 넉넉하고.' },
    { speaker: '헤르만', portrait: 'herman', text: '…요즘 밤이 유난히 조용하구나. 괜한 걱정이겠지만.' },
    { speaker: '헤르만', portrait: 'herman', text: '허허, 늙으면 걱정만 는다네. 오늘은 다들 마음껏 즐기게.' },
  ],
  'npc-eila': [
    { speaker: '에일라', portrait: 'eila', text: '다친 데는 없지? 수련하다 다치면 참지 말고 바로 오렴.' },
    { speaker: '에일라', portrait: 'eila', text: '축제 날엔 꼭 다치는 사람이 나오거든. 약초를 넉넉히 말려 둬야겠다.' },
    hero('작년엔 도란 아저씨가 등불 매달다 떨어지셨죠.'),
    { speaker: '에일라', portrait: 'eila', text: '그래, 올해는 사다리부터 내가 붙잡고 있어야겠어.' },
  ],
  'npc-merina': [
    { speaker: '메리나', portrait: 'merina', text: '어서 와! 축제 전이라 물약이 잘 나가. 하나 챙겨 둘래?' },
    { speaker: '메리나', portrait: 'merina', text: '장부를 보면 마을 사정이 다 보여. 올해는 다들 웃는 얼굴이야. 테온은 외상값만 빼고.' },
  ],
  'npc-doran': [
    { speaker: '도란', portrait: 'doran', text: '오, 시온! 그 나무검 들고 또 수련 가냐?' },
    { speaker: '도란', portrait: 'doran', text: '언젠가 진짜 검 한 자루 두들겨 주마. 그때까지 손목 아껴 두라고!' },
    { speaker: '도란', portrait: 'doran', text: '요즘 숲에서 잡혔다는 도마뱀 비늘을 하나 봤는데, 쇠처럼 단단하더라. 마물 주제에 웬 쇠비늘인지.' },
  ],
  'npc-rosetta': [
    { speaker: '로제타', portrait: 'rosetta', text: '어머, 시온! 오늘 밤 광장에서 축제 전야 잔치 하는 거 알지? 음식은 우리 여관에서 다 차려 내갈 거야.' },
    { speaker: '로제타', portrait: 'rosetta', text: '마을 사람이 다 모여도 국은 넉넉해. 냄비째 들고 나갈 거니까 그릇만 챙겨 와.' },
    { speaker: '로제타', portrait: 'rosetta', text: '배고프면 언제든 들러. 국은 늘 끓고 있으니까.' },
  ],
  'npc-vernel': [
    { speaker: '베르넬', portrait: 'vernel', text: '아, 미안. 이 석판 조각에 정신이 팔려서 못 봤네.' },
    { speaker: '베르넬', portrait: 'vernel', text: '이 표식… 북쪽 유적 입구 쪽에서 본 것과 비슷한데. 안쪽은 무너져서 들어가 보질 못했지.' },
    { speaker: '베르넬', portrait: 'vernel', text: '축제가 끝나면 다시 가 볼 생각이야. 그때 같이 가겠나? 하하, 농담일세.' },
  ],
  'npc-teon': [
    { speaker: '테온', portrait: 'teon', text: '시온! 오늘도 들판 나가? 슬라임 조심하고.' },
    { speaker: '테온', portrait: 'teon', text: '요즘 숲길 쪽에 마물이 늘었대. 루안 선생님께도 말씀드려 놨어.' },
    { speaker: '테온', portrait: 'teon', text: '그래도 남쪽 입구는 내가 지키니까 걱정 마! 오늘 밤 잔치 때도 자리 안 비울 거야.' },
  ],
} satisfies Record<string, DialogueLine[]>;

export type DialogueId = keyof typeof DIALOGUES;
