const { chromium } = require('/home/olive/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  p.setDefaultTimeout(30000);

  // Screenshot standalone HTML
  const standaloneFile = 'file:///mnt/c/Users/olive/orca/cozyroom/Cozyroom%20(standalone).html';
  await p.goto(standaloneFile);
  // Wait for the bundler to finish unpacking
  await p.waitForFunction(() => !document.getElementById('__bundler_loading') || document.getElementById('__bundler_loading').textContent !== 'Unpacking...', { timeout: 25000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/standalone-new.png' });
  console.log('standalone screenshot done');

  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
