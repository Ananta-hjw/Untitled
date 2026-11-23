import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { MYTHIC_GOD_BEASTS, PROLOGUE_SLIDES, prologueTotalMs, shouldPlayPrologue } from '../src/story/prologue.ts';

test('프롤로그는 새 게임 처음 시작할 때만 자동 재생되고 강제 옵션으로 언제든 볼 수 있다', () => {
  assert.equal(shouldPlayPrologue({ hasProgress: false, seen: false }), true);
  assert.equal(shouldPlayPrologue({ hasProgress: true, seen: false }), false);
  assert.equal(shouldPlayPrologue({ hasProgress: false, seen: true }), false);
  assert.equal(shouldPlayPrologue({ hasProgress: true, seen: true, forced: true }), true);
});

test('프롤로그 5컷 이미지가 고화질 JPEG로 존재하고 자막이 설정과 일치하며 스포일러가 없다', () => {
  assert.equal(PROLOGUE_SLIDES.length, 5);
  assert.ok(prologueTotalMs() >= 25000 && prologueTotalMs() <= 45000);
  const spoilers = ['시온', '시아', '리네아', '계승자', '미렐', '브람', '카이렌', '벨카', '라젠', '노크투르', '오르웬', '부식', '배신'];
  for (const slide of PROLOGUE_SLIDES) {
    const url = new URL(`../src/assets/prologue/${slide.id}.jpg`, import.meta.url);
    assert.equal(existsSync(url), true, `${slide.id}.jpg 존재`);
    const jpg = readFileSync(url);
    assert.equal(jpg[0], 0xff, `${slide.id} JPEG SOI`);
    assert.equal(jpg[1], 0xd8, `${slide.id} JPEG SOI`);
    assert.ok(jpg.length > 100_000, `${slide.id} 고화질 이미지 크기`);
    const joined = `${slide.caption} ${slide.lines.join(' ')}`;
    for (const word of spoilers) {
      assert.equal(joined.includes(word), false, `${slide.id}에 스포일러(${word}) 금지`);
    }
  }
  assert.ok(PROLOGUE_SLIDES[3].lines.join(' ').includes('닫힌 시공'), '4컷은 충돌로 닫힌 시공이 만들어져 끌려 들어갔음을 명시한다');
  assert.equal(PROLOGUE_SLIDES[3].lines.join(' ').includes('스스로 봉인'), false);
});

test('여섯 신의 우주 신수 설정은 유지 3신·해체 3신으로 완비되어 있다', () => {
  assert.equal(MYTHIC_GOD_BEASTS.length, 6);
  assert.equal(MYTHIC_GOD_BEASTS.filter((b) => b.faction === '유지').length, 3);
  assert.equal(MYTHIC_GOD_BEASTS.filter((b) => b.faction === '해체').length, 3);
});
