import { parryPitchRatio } from '../combat/parry';

/**
 * 외부 음원 파일 없이 Web Audio API로 합성하는 전투 효과음 + 모바일 진동(햅틱).
 *
 * - 정밀 패링: 3레이어(날카로운 금속 충돌 클릭 + 가슴을 울리는 서브 베이스 + 길게 울리는 검날 배음).
 *   연속 패링(chain)이 이어질수록 음정이 올라가고 화음이 더해진다.
 * - 불완전 막기: 저역 중심의 둔탁한 "텅!" 소리로 정밀 패링("채앵!")과 뚜렷한 대비를 만든다.
 * - 오디오가 막힌 환경(헤드리스 테스트, 자동재생 잠금)에서는 조용히 무시한다.
 */
export class CombatAudio {
  private ctx?: AudioContext;
  private noise?: AudioBuffer;

  /** 사용자 입력 시 잠긴 AudioContext를 미리 깨운다. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  /** 정밀 패링("채앵!" + 묵직한 저음) 또는 불완전 막기("텅!") + 모바일 진동 */
  playParry(grade: 'perfect' | 'imperfect', chain = 1): void {
    this.vibrate(grade === 'perfect' ? (chain >= 2 ? [14, 22, 26] : 18) : 10);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (grade === 'imperfect') {
      // 둔탁한 불완전 막기: 낮은 노이즈 + 짧은 철/나무 타격음
      this.playNoise(ctx, now, 0.055, 520, 'bandpass', 1.4, 0.22);
      this.playTone(ctx, now, 'triangle', 320, 190, 0.12, 0.18);
      this.playTone(ctx, now, 'sine', 110, 48, 0.13, 0.24);
      return;
    }

    const pitch = parryPitchRatio(chain);
    // 1) 어택: 날카로운 금속 스파크 클릭("딱!")
    this.playNoise(ctx, now, 0.028, 2800 * Math.min(1.25, pitch), 'highpass', 0.9, 0.22);
    // 2) 바디: 묵직한 서브 베이스 펀치("쿵!")
    this.playTone(ctx, now, 'sine', 155, 44, 0.125, 0.3);
    // 3) 공명: 어긋난 금속 배음이 길게 울리는 검날 잔향("채애앵—!")
    const partials: readonly [number, number, number][] = [
      [1680 * pitch, 0.36, 0.16],
      [2540 * pitch, 0.42, 0.13],
      [3520 * pitch, 0.3, 0.08],
    ];
    for (const [freq, dur, gain] of partials) {
      this.playTone(ctx, now, 'triangle', freq, freq * 0.992, dur, gain);
    }
    if (chain >= 2) {
      // 연속 패링 시 밝은 5도/옥타브 화음 잔향 추가
      this.playTone(ctx, now + 0.012, 'sine', 2520 * pitch * 1.25, 2500 * pitch * 1.25, 0.45, 0.1);
    }
  }

  /** 적 공격 직전 예고 안광 소리(흰빛 = 패링 가능, 붉은빛 = 회피 전용 강공격) */
  playGlint(unblockable = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (unblockable) {
      this.playTone(ctx, now, 'sawtooth', 520, 290, 0.16, 0.07);
      this.playTone(ctx, now, 'sine', 260, 170, 0.18, 0.09);
      return;
    }
    this.playTone(ctx, now, 'sine', 1320, 2240, 0.095, 0.075);
  }

  /** 공명 조각이 구슬에 빨려 들어갔을 때 맑은 종소리(가득 차면 화음) */
  playOrbAbsorb(full: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, now, 'sine', 988, 1318, 0.15, 0.09);
    if (full) {
      this.playTone(ctx, now + 0.04, 'triangle', 1480, 1480, 0.34, 0.11);
      this.playTone(ctx, now + 0.08, 'sine', 1976, 1976, 0.4, 0.1);
    }
  }

  /** 패링 뒤 반격 일격을 꽂았을 때의 묵직한 베기음 */
  playCounterHit(): void {
    this.vibrate(22);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoise(ctx, now, 0.045, 1900, 'bandpass', 1.2, 0.22);
    this.playTone(ctx, now, 'sine', 180, 52, 0.15, 0.28);
    this.playTone(ctx, now, 'triangle', 920, 420, 0.14, 0.11);
  }

  /** 보스 연속 패링 파훼: 마지막 타를 튕겨내며 터지는 웅장한 금속 화음 + 파열음 */
  playChainBreak(): void {
    this.vibrate([16, 22, 36]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoise(ctx, now, 0.045, 2400, 'highpass', 0.9, 0.26);
    this.playTone(ctx, now, 'sine', 165, 38, 0.2, 0.34);
    for (const [freq, dur, gain] of [[1976, 0.5, 0.17], [2960, 0.56, 0.14], [3951, 0.45, 0.1], [2489, 0.52, 0.11]] as const) {
      this.playTone(ctx, now, 'triangle', freq, freq * 0.99, dur, gain);
    }
  }

  /** 차지 패링(무량반격) 충전 완료 알림: 검날에 기가 응축되는 짧고 맑은 공명음 */
  playChargeReady(): void {
    this.vibrate(12);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, now, 'sine', 660, 1320, 0.14, 0.1);
    this.playTone(ctx, now + 0.03, 'triangle', 1320, 1760, 0.18, 0.08);
  }

  /** 차지 패링 버튼을 떼어 무량반격을 전개할 때의 짧은 기류 방출음 */
  playUnboundRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoise(ctx, now, 0.06, 1500, 'bandpass', 1.1, 0.14);
    this.playTone(ctx, now, 'sine', 420, 880, 0.09, 0.1);
  }

  /** 차지 패링(무량반격) 파훼 성공: 종소리 공명 + 묵직한 충격파 베이스 + 찬란한 화음 */
  playUnboundCounter(): void {
    this.vibrate([20, 26, 46]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoise(ctx, now, 0.065, 2100, 'highpass', 0.8, 0.28);
    this.playTone(ctx, now, 'sine', 140, 32, 0.28, 0.38);
    this.playTone(ctx, now + 0.01, 'triangle', 440, 220, 0.32, 0.18);
    for (const [freq, delay, dur, gain] of [
      [1318, 0, 0.65, 0.16],
      [1976, 0.012, 0.72, 0.15],
      [2637, 0.025, 0.68, 0.13],
      [3951, 0.04, 0.55, 0.09],
    ] as const) {
      this.playTone(ctx, now + delay, 'triangle', freq, freq * 0.988, dur, gain);
    }
  }

  private vibrate(pattern: number | number[]): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // 진동을 지원하지 않는 기기는 무시한다.
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return undefined;
      try {
        this.ctx = new Ctor();
      } catch {
        return undefined;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureNoise(ctx: AudioContext): AudioBuffer {
    if (this.noise && this.noise.sampleRate === ctx.sampleRate) return this.noise;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.12));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  private playTone(
    ctx: AudioContext,
    start: number,
    type: OscillatorType,
    freq0: number,
    freq1: number,
    duration: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq0), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private playNoise(
    ctx: AudioContext,
    start: number,
    duration: number,
    frequency: number,
    filterType: BiquadFilterType,
    q: number,
    peakGain: number,
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.ensureNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.setValueAtTime(q, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(start);
    src.stop(start + duration + 0.02);
  }
}
