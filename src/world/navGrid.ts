/**
 * 장애물을 돌아가는 길 찾기용 격자.
 *
 * 바닥을 일정한 크기의 칸으로 나누고, 목표 칸에서부터 "몇 칸 떨어져 있는지"를 모든 칸에 적어 둔다.
 * 그러면 어느 칸에 있든 숫자가 더 작은 이웃 칸으로 가기만 하면 목표에 도착한다.
 * 목표가 같은 칸에 머무는 동안은 다시 계산하지 않고, 추격하는 적이 몇 마리든 이 한 장을 같이 쓴다.
 *
 * Phaser에 의존하지 않아서 단위 테스트에서 그대로 불러 쓸 수 있다.
 */

export interface NavPoint {
  x: number;
  y: number;
}

const UNREACHABLE = -1;

// 이웃 8칸. 앞의 4개가 상하좌우, 뒤의 4개가 대각선이다.
const NEIGHBOR_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class NavGrid {
  readonly cols: number;
  readonly rows: number;

  private readonly left: number;
  private readonly top: number;
  private readonly cell: number;
  private readonly walkable: Uint8Array;
  private readonly distance: Int16Array;
  private readonly queue: Int32Array;
  private targetCell = -1;

  constructor(
    left: number,
    top: number,
    right: number,
    bottom: number,
    cell: number,
    contains: (x: number, y: number) => boolean,
  ) {
    this.left = left;
    this.top = top;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((right - left) / cell));
    this.rows = Math.max(1, Math.ceil((bottom - top) / cell));
    const count = this.cols * this.rows;
    this.walkable = new Uint8Array(count);
    this.distance = new Int16Array(count).fill(UNREACHABLE);
    this.queue = new Int32Array(count);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const x = left + (col + 0.5) * cell;
        const y = top + (row + 0.5) * cell;
        this.walkable[row * this.cols + col] = contains(x, y) ? 1 : 0;
      }
    }
  }

  /** 목표 위치를 알린다. 목표가 다른 칸으로 옮겨 갔을 때만 다시 계산한다. */
  setTarget(x: number, y: number): void {
    const target = this.nearestWalkable(x, y);
    if (target === this.targetCell) return;
    this.targetCell = target;
    this.distance.fill(UNREACHABLE);
    if (target < 0) return;

    // 목표 칸에서 바깥으로 퍼져 나가며 거리를 적는다 (너비 우선 탐색).
    let head = 0;
    let tail = 0;
    this.distance[target] = 0;
    this.queue[tail++] = target;
    while (head < tail) {
      const current = this.queue[head++];
      const col = current % this.cols;
      const row = (current - col) / this.cols;
      for (let n = 0; n < 8; n++) {
        const next = this.neighbor(col, row, n);
        if (next < 0 || this.distance[next] !== UNREACHABLE) continue;
        this.distance[next] = this.distance[current] + 1;
        this.queue[tail++] = next;
      }
    }
  }

  /**
   * (x, y)에서 목표로 가려면 다음에 향해야 할 지점을 out에 담는다.
   * 이미 목표 칸에 있거나 갈 수 있는 길이 없으면 false.
   */
  next(x: number, y: number, out: NavPoint): boolean {
    const from = this.nearestWalkable(x, y);
    if (from < 0 || from === this.targetCell) return false;
    const here = this.distance[from];
    if (here === UNREACHABLE) return false;

    const col = from % this.cols;
    const row = (from - col) / this.cols;
    let best = -1;
    let bestDistance = here;
    for (let n = 0; n < 8; n++) {
      const candidate = this.neighbor(col, row, n);
      if (candidate < 0) continue;
      const d = this.distance[candidate];
      if (d !== UNREACHABLE && d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    if (best < 0) return false;

    const bestCol = best % this.cols;
    out.x = this.left + (bestCol + 0.5) * this.cell;
    out.y = this.top + ((best - bestCol) / this.cols + 0.5) * this.cell;
    return true;
  }

  /** n번째 이웃 칸. 격자 밖이거나 막혔으면 -1. 대각선은 양옆이 모두 뚫려 있을 때만 지나간다. */
  private neighbor(col: number, row: number, n: number): number {
    const c = col + NEIGHBOR_DX[n];
    const r = row + NEIGHBOR_DY[n];
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    const index = r * this.cols + c;
    if (!this.walkable[index]) return -1;
    if (n >= 4) {
      // 모서리를 비스듬히 가로지르지 않게 한다.
      if (!this.walkable[row * this.cols + c] || !this.walkable[r * this.cols + col]) return -1;
    }
    return index;
  }

  /** 좌표가 속한 칸. 그 칸이 막혀 있으면 바로 주변에서 걸을 수 있는 칸을 찾는다. */
  private nearestWalkable(x: number, y: number): number {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.left) / this.cell)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.top) / this.cell)));
    const index = row * this.cols + col;
    if (this.walkable[index]) return index;
    for (let radius = 1; radius <= 2; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          if (this.walkable[r * this.cols + c]) return r * this.cols + c;
        }
      }
    }
    return -1;
  }
}
