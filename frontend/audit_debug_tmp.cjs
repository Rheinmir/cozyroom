const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const url = 'https://music.giatbh.io.vn/debug';
  const results = {};

  // Desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push(`${msg.type()}: ${msg.text()}`));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => results.desktopNavError = e.message);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:\\Users\\olive\\.claude\\jobs\\02f5a3a2\\tmp\\debug_desktop_gate.png', fullPage: true });
    // Get gate HTML / text
    results.desktopGateText = await page.textContent('body').catch(() => null);
    results.desktopConsole = consoleMsgs;
    results.desktopErrors = errors;
    await ctx.close();
  }

  // Mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => results.mobileNavError = e.message);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:\\Users\\olive\\.claude\\jobs\\02f5a3a2\\tmp\\debug_mobile_gate.png', fullPage: true });
    results.mobileGateText = await page.textContent('body').catch(() => null);
    await ctx.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
