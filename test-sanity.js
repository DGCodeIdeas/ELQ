import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const htmlBefore = await page.content();
  console.log("Has Library:", htmlBefore.includes('Hide'));
  
  // Find desktop sidebar toggle
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const box = await btn.boundingBox();
      if (!box) continue;
      const text = await btn.evaluate(b => b.textContent);
      if (text && text.includes('Hide')) { // "Hide" is the text when sidebar is visible
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await new Promise(r => setTimeout(r, 500));
          const htmlAfter = await page.content();
          console.log("After click, has Library text instead of Hide:", htmlAfter.includes('Library') && !htmlAfter.includes('Hide'));
          break;
      }
  }

  await browser.close();
})();
