import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const chromePath = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const siteUrl = process.env.SITE_URL || 'http://127.0.0.1:4321/';
const port = 9237;
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=/private/tmp/keepmedark-smoke-chrome',
  '--window-size=1440,1000',
  siteUrl,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;

try {
  let target;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = targets.find((item) => item.type === 'page');
      if (target) break;
    } catch {}
    await sleep(100);
  }
  if (!target) throw new Error('Chrome DevTools target was not available.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitForReady = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await evaluate('document.readyState') === 'complete') return;
      await sleep(100);
    }
    throw new Error('Page did not reach complete state.');
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await waitForReady();
  await sleep(500);

  const directRoute = await evaluate(`fetch('/tools/tor-browser/').then(async response => ({ status: response.status, hasTitle: (await response.text()).includes('Tor Browser') }))`);
  assert(directRoute.status === 200 && directRoute.hasTitle, 'Direct tool route failed.');

  const slashFocus = await evaluate(`(() => { document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })); return document.activeElement?.id; })()`);
  assert(slashFocus === 'tool-search', 'Slash shortcut did not focus search.');

  await evaluate(`document.querySelector('.skip-link').focus()`);
  const keyboardOrder = [];
  for (let step = 0; step < 4; step += 1) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    keyboardOrder.push(await evaluate(`(() => { const el = document.activeElement; return el.id || el.getAttribute('aria-label') || el.textContent.trim(); })()`));
  }
  assert(keyboardOrder[0] === 'KeepMeDark home' && keyboardOrder[1] === 'Directory' && keyboardOrder[2] === 'Selection criteria' && keyboardOrder[3] === 'tool-search', `Unexpected keyboard order: ${keyboardOrder.join(' / ')}`);

  const searchResult = await evaluate(`(() => {
    const input = document.querySelector('#tool-search');
    input.value = 'private messaging';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return [...document.querySelectorAll('[data-tool]')].filter(row => !row.hidden).map(row => row.querySelector('h3').textContent.trim());
  })()`);
  assert(searchResult.length === 1 && searchResult[0] === 'Signal', 'Private messaging search did not isolate Signal.');

  const combinedResult = await evaluate(`(() => {
    const input = document.querySelector('#tool-search');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-category="Messaging"]').click();
    const linux = [...document.querySelectorAll('[data-platform]')].find(item => item.value === 'Linux');
    linux.checked = true;
    linux.dispatchEvent(new Event('change', { bubbles: true }));
    return [...document.querySelectorAll('[data-tool]')].filter(row => !row.hidden).map(row => row.dataset.tool);
  })()`);
  assert(combinedResult.length === 1 && combinedResult[0] === 'signal', 'Combined category/platform filter failed.');

  const emptyState = await evaluate(`(() => {
    const input = document.querySelector('#tool-search');
    input.value = 'zzzz-not-a-tool';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const state = { shown: !document.querySelector('[data-empty-state]').hidden, text: document.querySelector('[data-empty-description]').textContent };
    document.querySelector('[data-empty-state] [data-clear-filters]').click();
    state.restored = [...document.querySelectorAll('[data-tool]')].filter(row => !row.hidden).length;
    state.query = input.value;
    return state;
  })()`);
  assert(emptyState.shown && emptyState.text.includes('Active filters'), 'Empty state did not expose active filters.');
  assert(emptyState.restored === 4 && emptyState.query === '', 'Clear filters did not restore the catalog.');

  const hoodRect = await evaluate(`(() => { const r = document.querySelector('[data-hood-canvas]').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const sampleExpression = `(() => {
    const canvas = document.querySelector('[data-hood-canvas]');
    const ctx = canvas.getContext('2d');
    const cx = Math.round(canvas.width * .55);
    const cy = Math.round(canvas.height * .42);
    const radius = Math.round(canvas.width * .045);
    const data = ctx.getImageData(cx - radius, cy - radius, radius * 2, radius * 2).data;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 2] > 70 && data[i + 1] > 45) blue += 1;
    return blue;
  })()`;
  const blueBefore = await evaluate(sampleExpression);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoodRect.x + hoodRect.width * 0.55, y: hoodRect.y + hoodRect.height * 0.42 });
  await sleep(550);
  const blueHover = await evaluate(sampleExpression);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await sleep(750);
  const blueAfter = await evaluate(sampleExpression);
  assert(blueBefore > 0 && blueHover !== blueBefore, 'Hood canvas did not visibly respond to pointer movement.');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  const mobile = await evaluate(`(() => {
    const search = document.querySelector('.search').getBoundingClientRect();
    const title = document.querySelector('#hero-title').getBoundingClientRect();
    const nav = document.querySelector('.site-nav a:last-child').getBoundingClientRect();
    const directory = document.querySelector('#directory').getBoundingClientRect();
    return {
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      searchLeft: search.left,
      searchRight: search.right,
      titleRight: title.right,
      navLeft: nav.left,
      navRight: nav.right,
      directoryTop: directory.top,
      hoodTouchAction: getComputedStyle(document.querySelector('[data-hood-canvas]')).touchAction
    };
  })()`);
  assert(mobile.scrollWidth <= mobile.innerWidth, `Mobile layout overflows: ${JSON.stringify(mobile)}`);
  assert(mobile.searchLeft >= 0 && mobile.searchRight <= mobile.innerWidth, 'Mobile search is clipped.');
  assert(mobile.navLeft >= 0 && mobile.navRight <= mobile.innerWidth, 'Mobile header navigation is clipped.');
  assert(mobile.hoodTouchAction === 'pan-y', 'Hood canvas does not preserve vertical touch scrolling.');

  if (process.env.SMOKE_SCREENSHOT) {
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(process.env.SMOKE_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  }

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(100);
  const reducedMotion = await evaluate(`(() => ({
    canvas: getComputedStyle(document.querySelector('[data-hood-canvas]')).display,
    fallback: getComputedStyle(document.querySelector('[data-hood-fallback]')).display
  }))()`);
  assert(reducedMotion.canvas === 'none' && reducedMotion.fallback !== 'none', 'Reduced-motion fallback is not active.');

  await send('Page.navigate', { url: new URL('/tools/tor-browser/', siteUrl).href });
  await waitForReady();
  const profileTitle = await evaluate(`document.querySelector('h1')?.textContent.trim()`);
  assert(profileTitle === 'Tor Browser', 'Direct profile navigation did not render its page.');

  console.log(JSON.stringify({
    directRoute,
    slashFocus,
    keyboardOrder,
    searchResult,
    combinedResult,
    emptyState,
    hood: { blueBefore, blueHover, blueAfter },
    mobile,
    reducedMotion,
    profileTitle,
  }, null, 2));
} finally {
  socket?.close();
  chrome.kill('SIGTERM');
}
