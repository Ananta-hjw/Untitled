import fs from 'node:fs/promises';

// 이미 실행 중인 Chrome의 별도 탭만 사용한다. CPU 제한은 휴대폰 성능을 재현하지 않는다.
const endpoint = process.env.CDP_URL || 'http://127.0.0.1:9222';
const base = process.env.NPC_STRESS_URL || 'http://127.0.0.1:5173/tools/npc-stress.html';
const out = process.env.NPC_STRESS_OUTPUT || '/tmp/npc-stress-results';
await fs.mkdir(out, { recursive: true });
const results = [];
for (const [count, throttle] of [[0, 1], [25, 1], [50, 1], [100, 1], [0, 4], [100, 4]]) {
  const tab = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(`${base}?count=${count}`)}`, { method: 'PUT' })).json();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timeout = setTimeout(() => { pending.delete(key); reject(new Error(`${method} 시간 초과`)); }, 15000);
    pending.set(key, message => { clearTimeout(timeout); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  try {
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 854, height: 480, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setCPUThrottlingRate', { rate: throttle });
    // 초기 로드가 제한 설정 전에 시작될 수 있으므로 조건 설정 후 새로 시작한다.
    await send('Page.navigate', { url: `${base}?count=${count}&rate=${throttle}&run=${Date.now()}` });
    const deadline = Date.now() + 100000;
    let result;
    while (Date.now() < deadline) {
      result = await evaluate('window.NPC_STRESS_RESULT');
      if (result) break;
      if (errors.length) throw new Error(JSON.stringify(errors));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!result) throw new Error('측정 시간 초과');
    if (result.visibleMin !== count) throw new Error(`화면 내 NPC 부족: ${result.visibleMin}/${count}`);
    results.push({ ...result, cpuThrottle: throttle });
    await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n');
    if (count === 100) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(`${out}/100-npcs-cpu-${throttle}.png`, Buffer.from(shot.data, 'base64'));
    }
    console.log(JSON.stringify({ count, throttle, fps: result.fps, p95: result.p95Ms, updateMs: result.npcUpdateMeanMs, moving: result.movingMean, renderer: result.renderer }));
  } finally {
    try { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); } finally {
      socket.close();
      await fetch(`${endpoint}/json/close/${tab.id}`);
    }
  }
}
