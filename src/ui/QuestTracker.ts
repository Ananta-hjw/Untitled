import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import { trackedQuests, type QuestState } from '../story/quests';
import { NPCS } from '../world/npcs';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const NAMES = Object.fromEntries(NPCS.map((n) => [n.id, n.name]));
/** 한 번에 보여 주는 퀘스트 수 (화면을 가리지 않게) */
const MAX_LINES = 3;

/**
 * 미니맵 아래의 퀘스트 목록. 진행 중이면 "제목 3/5", 목표를 채웠으면 "누구에게 보고"를 보여 준다.
 * 퀘스트 상태가 바뀔 때만 글을 다시 쓴다.
 */
export class QuestTracker {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#f5ead2', align: 'right',
      stroke: '#1a1008', strokeThickness: 4, lineSpacing: 6,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH_UI + 5).setResolution(2);
  }

  refresh(state: QuestState): void {
    const lines = trackedQuests(state).slice(0, MAX_LINES).map(({ quest, progress }) => {
      const tag = quest.main ? '◆ ' : '◇ ';
      if (progress.status === 'ready') return `${tag}${quest.title} · ${NAMES[quest.giver]}에게 보고`;
      return `${tag}${quest.title} · ${quest.objective.label} ${progress.count}/${quest.objective.need}`;
    });
    this.text.setText(lines).setVisible(lines.length > 0);
  }

  layout(right: number, top: number): void {
    this.text.setPosition(right, top);
  }
}
