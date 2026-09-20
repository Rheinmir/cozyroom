const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('https://music.giatbh.io.vn/ai', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const z = await page.evaluate(() => {
    const bubble = document.querySelector('.radial-bubble');
    const send = document.querySelector('.ai-send-btn');
    const bcs = getComputedStyle(bubble);
    const scs = getComputedStyle(send);
    // elementFromPoint at overlap coordinate
    const el = document.elementFromPoint(340, 735);
    return {
      bubbleZ: bcs.zIndex, bubblePos: bcs.position,
      sendZ: scs.zIndex, sendPos: scs.position,
      topElementAtOverlap: el ? (el.className + ' <' + el.tagName + '>') : null
    };
  });
  console.log(JSON.stringify(z, null, 2));
  await browser.close();
})();
