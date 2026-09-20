const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  await page.goto('https://music.giatbh.io.vn/videos', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('img')).map(i => ({src: i.src.slice(0,60), loading: i.loading, alt: i.alt})));
  console.log(JSON.stringify(imgs, null, 2));
  await browser.close();
})();
