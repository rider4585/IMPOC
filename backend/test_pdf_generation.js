import { generateBarcodeTestPdf } from './src/modules/barcode/barcode.test-generator.js';
import fs from 'fs';

async function test() {
    try {
        console.log('Generating test PDF...');
        const pdfBuffer = await generateBarcodeTestPdf();
        console.log(`PDF generated: ${pdfBuffer.length} bytes`);
        
        fs.writeFileSync('/tmp/test_output.pdf', pdfBuffer);
        console.log('PDF saved to /tmp/test_output.pdf');
        
        // Verify PDF header
        const header = pdfBuffer.toString('ascii', 0, 4);
        console.log(`PDF header: ${header}`);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
