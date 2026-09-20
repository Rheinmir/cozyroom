const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('https://music.giatbh.io.vn/ai', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const rects = await page.evaluate(() => {
    const sel = ['.radial-bubble', '.ai-send-btn', '.ai-input-wrap', '.ai-model-input', '.ai-controls-row'];
    const out = {};
    for (const s of sel) {
      const el = document.querySelector(s);
      if (el) { const r = el.getBoundingClientRect(); out[s] = { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom, right: r.right, left: r.left }; }
      else out[s] = null;
    }
    return out;
  });
  console.log(JSON.stringify(rects, null, 2));
  await browser.close();
})();
