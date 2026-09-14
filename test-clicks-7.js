import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const box = await btn.boundingBox();
      if (!box) continue; // Skip hidden
      const text = await btn.evaluate(b => b.textContent);
      if (text && text.includes('Tools')) {
          console.log("Found Desktop Tools Button!");
          console.log("Clicking...");
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          const pageHtml = await page.content();
          if (pageHtml.includes('Models & Inference')) {
             console.log("SUCCESS! Menu opened.");
          } else {
             console.log("FAILED TO OPEN");
          }
          break;
      }
  }

  await browser.close();
})();
