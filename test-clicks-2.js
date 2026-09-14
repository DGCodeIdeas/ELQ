import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Click the Tools menu button
  const toolsMenuButton = await page.$('header button[title="Tools & Settings"]');
  if (toolsMenuButton) {
      console.log("Found Tools Menu Button, clicking...");
      await toolsMenuButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      const html = await page.content();
      if (html.includes('Models & Inference')) {
          console.log("Tools menu OPENED!");
      } else {
          console.log("Tools menu NOT OPENED!");
      }
  } else {
      console.log("Could not find Tools Menu Button");
  }

  await browser.close();
})();
