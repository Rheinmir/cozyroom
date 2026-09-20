const { chromium } = require('/home/olive/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  p.setDefaultTimeout(20000);
  // Load trending, switch to grid mode via localStorage then reload
  await p.goto('https://music.giatbh.io.vn/trending', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('trending-view-mode', 'grid'));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/trending-grid.png', fullPage: false });
  console.log('done');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
