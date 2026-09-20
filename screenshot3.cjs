const { chromium } = require('/home/olive/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 800 },
    // disable cache entirely
  });
  const p = await ctx.newPage();
  // Route all requests to log cache status
  await p.route('**/*.css', async route => {
    const res = await route.fetch({ headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
    const headers = res.headers();
    const url = route.request().url();
    if (url.includes('.css')) console.log('CSS:', url.slice(-60), '| cf-cache:', headers['cf-cache-status'] || 'n/a');
    await route.fulfill({ response: res });
  });
  p.setDefaultTimeout(25000);
  await p.goto('https://music.giatbh.io.vn', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  // Check actual --bg value in page
  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  const green = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--green').trim());
  console.log('--bg:', bg, '| --green:', green);
  await p.screenshot({ path: '/tmp/live-nocache.png' });
  console.log('done');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
