const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [];
  page.on('requestfinished', async req => {
    const timing = req.timing();
    const res = await req.response();
    requests.push({
      url: req.url().replace('https://music.giatbh.io.vn', ''),
      method: req.method(),
      status: res ? res.status() : null,
      duration: Math.round(timing.responseEnd - timing.startTime),
    });
  });
  const t0 = Date.now();
  await page.goto('https://music.giatbh.io.vn/debug', { waitUntil: 'load', timeout: 30000 }).catch(e => console.log('goto error:', e.message));
  const loadTime = Date.now() - t0;
  await page.waitForTimeout(500);
  console.log('Total load event time:', loadTime, 'ms');
  console.log('Requests sorted by duration:');
  requests.sort((a, b) => b.duration - a.duration);
  for (const r of requests.slice(0, 20)) {
    console.log(`${r.duration}ms  [${r.status}]  ${r.method}  ${r.url}`);
  }
  await browser.close();
})();
