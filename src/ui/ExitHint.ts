import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import { MAPS, type GameMap, type Point } from '../world/maps';
import { CARDINAL, exitDirection, exitPoint, nearbyExit } from '../world/mapNavigation';

/** A compact destination notice appears only near an actual outdoor passage. */
export class ExitHint {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private last = '';
  private width = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly map: GameMap) {
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 7).setVisible(false);
    const style = { fontFamily: 'system-ui, "Noto Sans KR", sans-serif', fontStyle: 'bold' };
    this.title = scene.add.text(0, 0, '', { ...style, fontSize: '22px', color: '#f6dfaa' }).setOrigin(.5).setResolution(2).setScrollFactor(0).setDepth(DEPTH_UI + 8).setVisible(false);
    this.detail = scene.add.text(0, 0, '', { ...style, fontSize: '15px', color: '#d0d5c7' }).setOrigin(.5).setResolution(2).setScrollFactor(0).setDepth(DEPTH_UI + 8).setVisible(false);
  }
  layout(width: number): void { this.width = width; this.last = '!'; }
  update(player: Point, hidden: boolean, blocked: boolean): void {
    const exit = hidden ? undefined : nearbyExit(this.map, player);
    const id = exit ? `${exit.to}:${blocked}:${this.width}` : '';
    if (id === this.last) return;
    this.last = id;
    for (const object of [this.panel, this.title, this.detail]) object.setVisible(!!exit);
    if (!exit) return;
    const direction = CARDINAL[exitDirection(this.map, exitPoint(this.map, exit))];
    this.title.setText(`${direction.arrow} ${direction.name} · ${MAPS[exit.to].name}`);
    this.detail.setText(blocked ? '습격을 막은 뒤 이동할 수 있습니다' : '길 끝으로 이동하면 지역이 바뀝니다');
    const cx = (this.width || this.scene.scale.gameSize.width) / 2;
    const w = Math.max(330, this.title.width + 48, this.detail.width + 40);
    this.panel.clear().fillStyle(0x17241d, .95).fillRoundedRect(cx - w / 2, 139, w, 76, 12)
      .lineStyle(1.5, 0xc7ab70, .85).strokeRoundedRect(cx - w / 2, 139, w, 76, 12);
    this.title.setPosition(cx, 162); this.detail.setPosition(cx, 192);
  }
}
