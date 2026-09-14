import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const isVisible = await btn.evaluate(b => {
          const style = window.getComputedStyle(b);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      if (!isVisible) continue;
      const html = await btn.evaluate(b => b.outerHTML);
      if (html.includes('Tools')) {
          console.log("Found Tools Button");
          const box = await btn.boundingBox();
          console.log("Bounding box:", box);
          if (box) {
              const x = box.x + box.width / 2;
              const y = box.y + box.height / 2;
              console.log(`Checking point: ${x}, ${y}`);
              const topElement = await page.evaluate(({x, y}) => {
                  const el = document.elementFromPoint(x, y);
                  return el ? el.tagName + '#' + el.id + '.' + el.className : 'NULL';
              }, {x, y});
              console.log("Element on top is:", topElement);
              
              // Also check pointer-events
              const css = await btn.evaluate(b => window.getComputedStyle(b).pointerEvents);
              console.log("Button pointer-events:", css);
          }
          break;
      }
  }

  await browser.close();
})();
