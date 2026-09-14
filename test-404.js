import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`HTTP ${res.status()}: ${res.url()}`);
    }
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await browser.close();
})();
