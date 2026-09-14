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
  
  // Click the Tools menu button (the visible one)
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const isVisible = await btn.evaluate(b => {
          const style = window.getComputedStyle(b);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      if (!isVisible) continue;
      const html = await btn.evaluate(b => b.outerHTML);
      if (html.includes('Models & Inference') || html.includes('toggleToolsMenu')) {
          console.log("Clicking button...");
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          const pageHtml = await page.content();
          if (pageHtml.includes('Models & Inference')) {
             console.log("SUCCESS!");
          } else {
             console.log("FAILED TO OPEN");
          }
          break;
      }
  }

  await browser.close();
})();
