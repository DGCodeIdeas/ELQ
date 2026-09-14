const fs = require('fs');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

async function testEpub() {
    try {
        const file = fs.readFileSync('Isekaied_to_Save_the.epub');
        const zip = await JSZip.loadAsync(file);
        
        const containerXml = await zip.file('META-INF/container.xml')?.async('string');
        if (!containerXml) throw new Error('Invalid EPUB: missing container.xml');
        
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'application/xml');
        const rootPath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
        
        if (!rootPath) throw new Error('Invalid EPUB: no rootfile');
        console.log("Root path: " + rootPath);
        
        const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : '';
        
        const opfContent = await zip.file(rootPath)?.async('string');
        if (!opfContent) throw new Error('Invalid EPUB: OPF file missing');
        
        const opfDoc = parser.parseFromString(opfContent, 'application/xml');
        
        // Find title
        const titles = opfDoc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title');
        let title = '';
        if (titles.length) title = titles[0].textContent;
        console.log("Title: " + title);
        
        const manifest = new Map();
        const items = opfDoc.getElementsByTagName('item');
        for (let i = 0; i < items.length; i++) {
            manifest.set(items[i].getAttribute('id'), items[i].getAttribute('href'));
        }
        
        const spineRefs = [];
        const itemrefs = opfDoc.getElementsByTagName('itemref');
        for (let i = 0; i < itemrefs.length; i++) {
            const id = itemrefs[i].getAttribute('idref');
            const href = manifest.get(id);
            if (href) spineRefs.push(href);
        }
        
        console.log("Spine refs count: " + spineRefs.length);
        
        for (let i = 0; i < spineRefs.length; i++) {
            const href = spineRefs[i];
            const fullPath = rootDir + href; 
            const htmlContent = await zip.file(fullPath)?.async('string');
            if (htmlContent) {
                console.log("Found htmlContent for: " + href);
            } else {
                console.log("Error finding: " + fullPath);
            }
        }
        
    } catch (e) {
        console.error(e);
    }
}
testEpub();
