const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.join('scripts', '_refs');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:4200/stadium/cairo', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(4500);
  const shot = path.join(outDir, 'cairo-live.png');
  await page.screenshot({ path: shot, fullPage: false });

  const state = await page.evaluate(() => {
    const loader = document.getElementById('loader');
    const canvas = document.getElementById('c');
    return {
      url: location.href,
      loaderHidden: loader?.classList.contains('hide') ?? null,
      loaderText: document.getElementById('loader-text')?.textContent ?? null,
      brand: document.querySelector('.brand-name')?.textContent ?? null,
      canvasW: canvas?.width ?? null,
      canvasH: canvas?.height ?? null,
      bodyStadium: document.body.dataset.stadium ?? null,
      noseats: document.body.classList.contains('stadium-noseats'),
    };
  });

  fs.writeFileSync(
    path.join(outDir, 'cairo-live.json'),
    JSON.stringify({ state, logs: logs.slice(-40) }, null, 2),
  );
  console.log(JSON.stringify({ shot, state, logs: logs.slice(-20) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
