const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('requestfailed', request => {
    console.log('[REQ FAILED]:', request.url(), request.failure().errorText);
  });

  page.on('response', async response => {
    if (response.status() >= 400) {
      let body = '';
      try {
        body = await response.text();
      } catch (e) {
        body = '<unable to read body>';
      }
      console.log(`[HTTP ${response.status()}]: ${response.url()}\nBODY: ${body.substring(0, 500)}`);
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Click Linguix scan
  await page.evaluate(() => {
    const linguixBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quality Check') || b.title?.includes('Linguix'));
    if (linguixBtn) linguixBtn.click();
  });

  await new Promise(r => setTimeout(r, 4000));

  await browser.close();
})();
