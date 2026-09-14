import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const buttons = await page.$$eval('button', btns => btns.map((b, i) => ({
    index: i,
    text: b.innerText.trim().replace(/\n/g, ' '),
    title: b.getAttribute('title') || '',
    aria: b.getAttribute('aria-label') || '',
    visible: b.offsetWidth > 0 && b.offsetHeight > 0 && window.getComputedStyle(b).display !== 'none' && window.getComputedStyle(b).visibility !== 'hidden'
  })));
  
  console.log(`Total buttons: ${buttons.length}`);
  const visibleButtons = buttons.filter(b => b.visible);
  console.log(`Visible buttons on desktop: ${visibleButtons.length}`);
  for (const b of visibleButtons) {
    console.log(`[${b.index}] text="${b.text}" title="${b.title}"`);
  }
  
  await browser.close();
})();
