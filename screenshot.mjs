import { chromium } from '/home/olive/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';

const b = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 800 });
p.setDefaultTimeout(20000);
await p.goto('https://music.giatbh.io.vn', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/cozyroom-live.png' });
console.log('screenshot saved');
await b.close();
