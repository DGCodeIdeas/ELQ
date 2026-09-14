import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', error => {
    console.log('PAGE EXCEPTION:', error.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      await btn.click().catch(() => {});
      await new Promise(r => setTimeout(r, 100));
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  await browser.close();
})();
