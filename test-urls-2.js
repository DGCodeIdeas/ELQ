import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('BAD RESPONSE:', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  await browser.close();
})();
