import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Click the mobile sidebar toggle button
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const box = await btn.boundingBox();
      if (!box) continue;
      const html = await btn.evaluate(b => b.outerHTML);
      if (html.includes('toggleLeftSidebar')) {
          console.log("Found Left Sidebar Toggle Button!");
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          const pageHtml = await page.content();
          if (pageHtml.includes('bg-black/30 backdrop-blur-xs')) {
             console.log("SUCCESS! Sidebar opened.");
          } else {
             console.log("FAILED TO OPEN");
          }
          break;
      }
  }

  await browser.close();
})();
