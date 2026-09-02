import { generateBarcodePdf } from './src/modules/barcode/barcode.generator.js';
import fs from 'fs';

async function test() {
    try {
        console.log('Generating barcode PDF with 2 pages...');
        
        // Generate test barcode values (same format as the real endpoint)
        const testBarcodes = [
            '000000000001',
            '000000000002',
            '000000000003',
            '000000000004',
            '000000000005',
            '000000000006',
            '000000000007',
            '000000000008',
            '000000000009',
            '000000000010',
            '000000000011',
            '000000000012',
            '000000000013',
            '000000000014',
            '000000000015',
            '000000000016',
            '000000000017',
            '000000000018',
            '000000000019',
            '000000000020',
            '000000000021',
            '000000000022',
            '000000000023',
            '000000000024',
            '000000000025',
            '000000000026',
            '000000000027',
            '000000000028',
            '000000000029',
            '000000000030',
        ];
        
        const pdfBuffer = await generateBarcodePdf(testBarcodes);
        console.log(`✓ PDF generated: ${pdfBuffer.length} bytes`);
        
        // Check PDF header
        const header = pdfBuffer.toString('ascii', 0, 4);
        console.log(`✓ PDF header: ${header}`);
        
        // Save to file
        fs.writeFileSync('/tmp/barcode_test.pdf', pdfBuffer);
        console.log('✓ Saved to /tmp/barcode_test.pdf');
        
        // Check PDF structure
        const pdfStr = pdfBuffer.toString('ascii');
        const pageCount = (pdfStr.match(/\/Type\s*\/Page[^s]/g) || []).length;
        console.log(`✓ Detected pages: ${pageCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

test();
