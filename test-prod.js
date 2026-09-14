import puppeteer from 'puppeteer';
import { exec } from 'child_process';

const server = exec('npx serve dist -p 3001');

setTimeout(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PROD CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('PROD EXCEPTION:', error.message));
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
  await browser.close();
  server.kill();
  process.exit(0);
}, 3000);
