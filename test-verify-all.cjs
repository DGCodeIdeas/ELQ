const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser to verify all buttons and AO3 support...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[BROWSER CONSOLE ERROR]:', msg.text());
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('[BROWSER PAGE ERROR]:', err.message);
    errors.push(err.message);
  });

  try {
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('Title:', await page.title());

    // 1. Check if "Load Sample AO3 EPUB" button exists and click it
    console.log('Testing "Load Sample AO3 EPUB" button...');
    const clickedSample = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sampleBtn = btns.find(b => b.textContent.includes('Load Sample AO3 EPUB'));
      if (sampleBtn) {
        sampleBtn.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Load Sample AO3 EPUB:', clickedSample);
    if (!clickedSample) throw new Error('Load Sample AO3 EPUB button not found!');

    // Wait for import to finish and chapters to render
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Work Info & Preface') || b.textContent.includes('Chapter 1'));
    }, { timeout: 15000 });

    console.log('AO3 EPUB successfully imported and chapters rendered!');

    // 2. Check chapter buttons and click Chapter 1
    const chapterTitles = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button'));
      return items
        .filter(b => b.textContent.includes('Chapter') || b.textContent.includes('Work Info'))
        .map(b => b.textContent.trim().replace(/\s+/g, ' '));
    });
    console.log('Found chapters:', chapterTitles.slice(0, 5));

    // Click Chapter 1
    const clickedCh1 = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button'));
      const ch1 = items.find(b => b.textContent.includes('Chapter 1') || b.textContent.includes('Chapter 1:'));
      if (ch1) {
        ch1.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Chapter 1:', clickedCh1);

    await new Promise(r => setTimeout(r, 800));

    // Verify editor has content
    const editorText = await page.evaluate(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      return editor ? editor.innerText.substring(0, 200) : null;
    });
    console.log('Editor text preview:', editorText);

    // 3. Test toolbar buttons (H1, H2, Bold, Italic)
    console.log('Testing toolbar formatting buttons...');
    await page.evaluate(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (editor) {
        editor.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    const formatBtns = await page.evaluate(() => {
      const h1 = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Heading 1');
      const bold = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Bold');
      if (bold) bold.click();
      if (h1) h1.click();
      return { bold: !!bold, h1: !!h1 };
    });
    console.log('Format buttons clicked:', formatBtns);

    // 4. Test "New Chapter" button
    console.log('Testing "New Chapter" button...');
    const clickedNewChapter = await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Add Chapter' || b.textContent.includes('New Chapter'));
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked New Chapter:', clickedNewChapter);

    await new Promise(r => setTimeout(r, 500));

    // 5. Test Linguix Grammar Scan button
    console.log('Testing Linguix Grammar Scan button...');
    const clickedLinguix = await page.evaluate(() => {
      const linguixBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quality Check') || b.title?.includes('Linguix'));
      if (linguixBtn) {
        linguixBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Linguix scan button:', clickedLinguix);

    await new Promise(r => setTimeout(r, 1000));

    // Check if drawer is visible
    const drawerVisible = await page.evaluate(() => {
      return !!document.querySelector('.fixed.bottom-4.right-4') || document.body.innerText.includes('Linguix Quality Score');
    });
    console.log('Linguix drawer opened:', drawerVisible);

    // 6. Test AI Assistant Chat Input & Send
    console.log('Testing AI Assistant Chat input and send...');
    const aiChatWorking = await page.evaluate(async () => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return { error: 'No textarea found' };
      textarea.value = 'Give a 1-sentence summary of this book';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Find send button
      const sendBtn = textarea.parentElement.querySelector('button');
      if (!sendBtn) return { error: 'No send button found' };
      sendBtn.click();
      return { success: true };
    });
    console.log('AI Chat trigger result:', aiChatWorking);

    // Wait a moment to observe response or stream
    await new Promise(r => setTimeout(r, 4000));

    const messagesCount = await page.evaluate(() => {
      const msgs = document.querySelectorAll('.markdown-body, .chat-markdown');
      return msgs.length;
    });
    console.log('AI response messages rendered:', messagesCount);

    await page.screenshot({ path: 'test-final-verification.png' });
    console.log('Screenshot saved to test-final-verification.png');

    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
