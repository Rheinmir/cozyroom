const { chromium } = require('/home/olive/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const pages = [
  { url: 'https://music.giatbh.io.vn/ai', file: '/tmp/ss-ai.png', selector: '.ai-messages', timeout: 8000 },
  { url: 'https://music.giatbh.io.vn/', file: '/tmp/ss-artists.png', selector: '.artist-grid', timeout: 8000 },
  { url: 'https://music.giatbh.io.vn/ebooks', file: '/tmp/ss-ebooks.png', selector: '.ebooks-grid,.loading', timeout: 12000 },
];
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  for (const pg of pages) {
    const p = await b.newPage();
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(pg.url, { waitUntil: 'domcontentloaded' });
    try { await p.waitForSelector(pg.selector, { timeout: pg.timeout }); } catch(e) {}
    await p.waitForTimeout(2000);
    await p.screenshot({ path: pg.file });
    await p.close();
    console.log('done', pg.file);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
