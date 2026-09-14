import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // 1. Click "Models"
  const modelsBtn = await page.$('button[title*="Models"]');
  if (modelsBtn) {
    console.log('Found Models button, clicking...');
    await modelsBtn.click();
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.$('app-models-modal');
    console.log('Models modal open?', !!modalVisible);
    
    // Close modal if open
    const closeBtn = await page.$('app-models-modal button');
    if (closeBtn) await closeBtn.click();
  } else {
    console.log('Models button not found!');
  }

  // 2. Click "New Document"
  const newDocBtn = await page.$('button[title*="New Document"], button:has-text("New Document")');
  console.log('New Doc button found?', !!newDocBtn);
  
  // 3. Click "Add Chapter"
  const addChapterBtn = await page.$('button[title*="Add Chapter"], button:has-text("Add Chapter")');
  console.log('Add Chapter button found?', !!addChapterBtn);

  // 4. Test editor buttons:
  // Is editor rendered?
  const editor = await page.$('app-editor');
  console.log('Editor rendered?', !!editor);

  await browser.close();
})();
