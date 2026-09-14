import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('[PAGE ERROR EXCEPTION]', err.stack || err.message);
  });
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  console.log('--- Page loaded ---');
  
  // Let's get all buttons
  const buttons = await page.$$('button');
  console.log(`Found ${buttons.length} buttons.`);
  
  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const btn = buttons[i];
    const text = await page.evaluate(el => el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || el.className, btn);
    console.log(`Clicking button ${i}: "${text.trim().replace(/\n/g, ' ')}"`);
    try {
      await btn.click();
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.log(`Error clicking button ${i}:`, e.message);
    }
  }
  
  await browser.close();
})();
