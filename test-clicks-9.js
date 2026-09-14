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
      if (!box) continue;
      const text = await btn.evaluate(b => b.textContent);
      if (text && text.trim() === 'Models') {
          console.log("Found Models Button!");
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          const pageHtml = await page.content();
          if (pageHtml.includes('app-models-modal') || pageHtml.includes('Models & Inference')) {
             console.log("SUCCESS! Modal opened.");
          } else {
             console.log("FAILED TO OPEN");
          }
          break;
      }
  }

  await browser.close();
})();
