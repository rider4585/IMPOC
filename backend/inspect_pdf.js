import { generateBarcodePdf } from './src/modules/barcode/barcode.generator.js';
import fs from 'fs';

async function test() {
    const testBarcodes = Array.from({length: 15}, (_, i) => String(i+1).padStart(12, '0'));
    
    const pdfBuffer = await generateBarcodePdf(testBarcodes);
    const pdfStr = pdfBuffer.toString('latin1');
    
    // Look for stream content
    const streamMatches = pdfStr.match(/stream\n(.+?)\nendstream/gs);
    if (streamMatches) {
        console.log(`Found ${streamMatches.length} content streams`);
        streamMatches.slice(0, 3).forEach((match, i) => {
            const content = match.substring(7, Math.min(200, match.length - 11));
            console.log(`Stream ${i}: ${content.substring(0, 100)}...`);
        });
    }
    
    // Look for text objects
    const textMatches = pdfStr.match(/BT(.+?)ET/gs);
    if (textMatches) {
        console.log(`\nFound ${textMatches.length} text objects`);
    }
    
    // Look for image references
    const imageMatches = pdfStr.match(/\/XObject/g);
    if (imageMatches) {
        console.log(`Found ${imageMatches.length} image references`);
    }
    
    // Look for graphics operations
    const graphicsOps = pdfStr.match(/(re|m|l|c|S|s|f|F|B)\s/g);
    if (graphicsOps) {
        console.log(`Found ${graphicsOps.length} graphics operations`);
    }
}

test().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
