import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('requestfailed', req => {
    console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
  });
  
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Click Linguix Check
  console.log('Clicking Linguix Check...');
  const linguix = await page.$('button[title*="Linguix"]');
  if (linguix) await linguix.click();
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
