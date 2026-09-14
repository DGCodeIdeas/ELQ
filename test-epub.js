import fs from 'fs';
import JSZip from 'jszip';

(async () => {
  const data = fs.readFileSync('Isekaied_to_Save_the.epub');
  const zip = await JSZip.loadAsync(data);
  console.log('Files in epub:');
  zip.forEach((relativePath, file) => {
    console.log('-', relativePath);
  });
})();
