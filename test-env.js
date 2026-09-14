import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  const evalResult = await page.evaluate(() => {
     return {
       typeofProcess: typeof process,
       hasEnv: typeof process !== 'undefined' ? !!process.env : false
     };
  });
  console.log("EVAL RESULT:", evalResult);
  await browser.close();
})();
