import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  async function testClick(selector, desc) {
    try {
      const el = await page.$(selector);
      if (!el) {
        console.log(`[FAIL] ${desc}: element not found with ${selector}`);
        return false;
      }
      await el.click();
      await new Promise(r => setTimeout(r, 200));
      console.log(`[OK] ${desc}`);
      return true;
    } catch (e) {
      console.log(`[ERR] ${desc}: ${e.message}`);
      return false;
    }
  }

  console.log('--- Testing Sidebar Buttons ---');
  await testClick('button[title="Add Chapter"]', 'Add Chapter');
  await testClick('button[title="New Document"]', 'New Document');
  
  console.log('--- Testing Toolbar Buttons ---');
  await testClick('button[title="Heading 1"]', 'Toolbar H1');
  await testClick('button[title="Heading 2"]', 'Toolbar H2');
  await testClick('button[title="Bold"]', 'Toolbar Bold');
  await testClick('button[title="Italic"]', 'Toolbar Italic');
  await testClick('button[title="Underline"]', 'Toolbar Underline');
  await testClick('button[title*="Linguix"]', 'Toolbar Linguix');
  await testClick('button:has-text("Focus Mode")', 'Toolbar Focus Mode');
  // Exit focus mode
  await testClick('button:has-text("Exit Focus")', 'Exit Focus Mode');
  
  console.log('--- Testing Navigation Buttons ---');
  await testClick('button:has-text("Previous")', 'Previous Chapter');
  await testClick('button:has-text("Next")', 'Next Chapter');

  console.log('--- Testing Header Modals ---');
  await testClick('button[title*="Models"]', 'Open Models Modal');
  await testClick('app-models-modal button', 'Close Models Modal');
  
  await testClick('button[title*="BYOK"]', 'Open BYOK Modal');
  await testClick('app-byok-modal button', 'Close BYOK Modal');
  
  await testClick('button[title*="Privacy"]', 'Open Privacy Modal');
  await testClick('app-privacy-modal button', 'Close Privacy Modal');
  
  await testClick('button[title*="Writing Progress"]', 'Open Metrics Modal');
  await testClick('app-metrics-modal button', 'Close Metrics Modal');
  
  await testClick('button[title*="User Profile"]', 'Open Auth Modal');
  await testClick('app-auth-modal button', 'Close Auth Modal');

  console.log('--- Testing Chat Buttons ---');
  await testClick('button:has-text("Deep Book")', 'Chat Deep Book Mode');
  await testClick('button:has-text("Unfiltered")', 'Chat Unfiltered Mode');
  await testClick('button:has-text("Dictionary")', 'Chat Dictionary Mode');
  await testClick('button:has-text("Chapter")', 'Chat Chapter Mode');

  console.log('Page Errors encountered:', pageErrors);

  await browser.close();
})();
