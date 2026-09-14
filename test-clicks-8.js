import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const box = await btn.boundingBox();
      if (!box) continue; // Skip hidden
      const text = await btn.evaluate(b => b.textContent);
      console.log(`Button text: "${text ? text.trim() : ''}"`);
  }

  await browser.close();
})();
