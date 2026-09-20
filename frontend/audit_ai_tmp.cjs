const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const results = {};

  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => consoleMsgs.push(`[pageerror] ${err.message}`));
    const failedReqs = [];
    page.on('requestfailed', req => failedReqs.push(`${req.url()} - ${req.failure()?.errorText}`));

    const respPromise = page.goto('https://music.giatbh.io.vn/ai', { waitUntil: 'networkidle', timeout: 30000 }).catch(e => ({ error: e.message }));
    const resp = await respPromise;

    await page.waitForTimeout(1500);

    const shot = `C:/Users/olive/.claude/jobs/02f5a3a2/tmp/ai_${label}.png`;
    await page.screenshot({ path: shot, fullPage: false });

    // Check computed styles / a11y basics
    const info = await page.evaluate(() => {
      const out = {};
      out.title = document.title;
      out.htmlLang = document.documentElement.lang;
      // headings
      out.headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({ tag: h.tagName, text: h.textContent?.slice(0,40) }));
      // buttons without aria-label/text
      const btns = Array.from(document.querySelectorAll('button'));
      out.buttonCount = btns.length;
      out.buttonsNoLabel = btns.filter(b => {
        const txt = (b.textContent || '').trim();
        const aria = b.getAttribute('aria-label');
        const title = b.getAttribute('title');
        return !txt && !aria && !title;
      }).map(b => b.className).slice(0, 20);
      // inputs without labels
      const inputs = Array.from(document.querySelectorAll('input,textarea'));
      out.inputsNoLabel = inputs.filter(i => {
        const id = i.id;
        const aria = i.getAttribute('aria-label');
        const placeholder = i.getAttribute('placeholder');
        const labelFor = id ? document.querySelector(`label[for="${id}"]`) : null;
        return !aria && !labelFor && !placeholder;
      }).length;
      // touch target sizes for key interactive elements
      const targets = Array.from(document.querySelectorAll('button, a, .ai-media-card-btn, .ai-lb-row'));
      out.smallTargets = targets.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      }).map(el => ({ cls: el.className, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), text: (el.textContent||'').slice(0,20) })).slice(0, 30);
      // horizontal scroll
      out.scrollWidth = document.documentElement.scrollWidth;
      out.clientWidth = document.documentElement.clientWidth;
      out.hasHorizScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      // focus outline check on send button
      const sendBtn = document.querySelector('.ai-send-btn');
      if (sendBtn) {
        sendBtn.focus();
        const cs = getComputedStyle(sendBtn);
        out.sendBtnFocusOutline = cs.outlineStyle + ' ' + cs.outlineWidth;
      }
      // check hardcoded colors vs var()
      const styleSheets = Array.from(document.styleSheets);
      out.svgFillBlackCount = document.querySelectorAll('svg[fill="#000"], svg path[fill="#000"]').length;
      return out;
    });

    results[label] = { url: page.url(), status: resp && resp.status ? resp.status() : 'nav-error', consoleMsgs: consoleMsgs.slice(0,20), failedReqs, info, screenshot: shot };
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
