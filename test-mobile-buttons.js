import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.setViewport({ width: 450, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  const buttons = await page.$$eval('button', btns => btns.map((b, i) => ({
    index: i,
    text: b.innerText.trim().replace(/\n/g, ' '),
    title: b.getAttribute('title') || '',
    visible: b.offsetWidth > 0 && b.offsetHeight > 0 && window.getComputedStyle(b).display !== 'none' && window.getComputedStyle(b).visibility !== 'hidden'
  })));
  
  console.log(`Visible buttons on mobile:`);
  const visibleButtons = buttons.filter(b => b.visible);
  for (const b of visibleButtons) {
    console.log(`[${b.index}] text="${b.text}" title="${b.title}"`);
  }
  
  // Try clicking the hamburger menu button [0]
  console.log('Clicking hamburger button [0]...');
  const btn0 = (await page.$$('button'))[0];
  await btn0.click();
  await new Promise(r => setTimeout(r, 400));
  
  const drawerOpen = await page.$('.slide-in-from-left');
  console.log('Mobile drawer opened?', !!drawerOpen);

  // Try clicking tools menu button [3]
  console.log('Clicking tools menu [3]...');
  const btn3 = (await page.$$('button'))[3];
  await btn3.click();
  await new Promise(r => setTimeout(r, 400));
  const toolsMenuOpen = await page.$('.animate-in');
  console.log('Tools menu opened?', !!toolsMenuOpen);

  await browser.close();
})();
