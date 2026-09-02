import bwipjs from 'bwip-js';
import PDFDocument from 'pdfkit';

import {
    BARCODE_TEST_CONFIG,
} from './barcode.constants.js';

const MM_TO_POINTS = 72 / 25.4;

const mmToPoints = (mm) => mm * MM_TO_POINTS;

const generateBarcodeImage = async (value) => {
    return bwipjs.toBuffer({
        bcid: 'code128',
        text: value,
        scale: BARCODE_TEST_CONFIG.barcode.scale,
        height: BARCODE_TEST_CONFIG.barcode.sourceHeight,
        includetext: false,
    });
};

const createTestCases = () => {
    const tests = [];
    let testNumber = 1;

    for (const heightMm of BARCODE_TEST_CONFIG.heightsMm) {
        for (const widthMm of BARCODE_TEST_CONFIG.widthsMm) {
            tests.push({
                id: `T${String(testNumber).padStart(2, '0')}`,
                widthMm,
                heightMm,
                value: BARCODE_TEST_CONFIG.testValue,
            });

            testNumber += 1;
        }
    }

    return tests;
};

const calculateGrid = (doc) => {
    const {
        grid,
        marginMm,
        gapMm,
    } = BARCODE_TEST_CONFIG;

    const marginLeft = mmToPoints(marginMm.left);
    const marginRight = mmToPoints(marginMm.right);
    const marginTop = mmToPoints(marginMm.top);
    const marginBottom = mmToPoints(marginMm.bottom);

    const horizontalGap = mmToPoints(gapMm.horizontal);
    const verticalGap = mmToPoints(gapMm.vertical);

    const availableWidth =
        doc.page.width -
        marginLeft -
        marginRight -
        horizontalGap * (grid.columns - 1);

    const availableHeight =
        doc.page.height -
        marginTop -
        marginBottom -
        verticalGap * (grid.rows - 1);

    return {
        columns: grid.columns,
        rows: grid.rows,
        marginLeft,
        marginTop,
        horizontalGap,
        verticalGap,
        cellWidth: availableWidth / grid.columns,
        cellHeight: availableHeight / grid.rows,
    };
};

const drawTestLabel = (
    doc,
    test,
    barcodeImage,
    x,
    y,
    cellWidth,
    cellHeight,
) => {
    const { label } = BARCODE_TEST_CONFIG;

    const padding = mmToPoints(label.paddingMm);
    const barcodeWidth = mmToPoints(test.widthMm);
    const barcodeHeight = mmToPoints(test.heightMm);

    doc
        .lineWidth(label.borderWidth)
        .roundedRect(
            x,
            y,
            cellWidth,
            cellHeight,
            label.borderRadius,
        )
        .stroke();

    doc
        .fontSize(label.titleFontSize)
        .text(
            test.id,
            x + padding,
            y + padding,
            {
                width: cellWidth - padding * 2,
                align: 'left',
                lineBreak: false,
            },
        );

    const titleHeight = label.titleFontSize + 2;

    const barcodeY =
        y +
        padding +
        titleHeight +
        mmToPoints(label.titleGapMm);

    const barcodeX =
        x +
        (cellWidth - barcodeWidth) / 2;

    doc.image(
        barcodeImage,
        barcodeX,
        barcodeY,
        {
            width: barcodeWidth,
            height: barcodeHeight,
        },
    );

    const valueY =
        barcodeY +
        barcodeHeight +
        mmToPoints(label.valueGapMm);

    doc
        .fontSize(label.valueFontSize)
        .text(
            test.value,
            x + padding,
            valueY,
            {
                width: cellWidth - padding * 2,
                align: 'center',
                lineBreak: false,
            },
        );

    const dimensionY =
        valueY +
        label.valueFontSize +
        mmToPoints(1);

    doc
        .fontSize(label.valueFontSize)
        .text(
            `${test.widthMm}mm × ${test.heightMm}mm`,
            x + padding,
            dimensionY,
            {
                width: cellWidth - padding * 2,
                align: 'center',
                lineBreak: false,
            },
        );
};

export const generateBarcodeTestPdf = async () => {
    const { page } = BARCODE_TEST_CONFIG;
    const tests = createTestCases();

    const doc = new PDFDocument({
        size: page.size,
        layout: page.layout,
        margin: 0,
        autoFirstPage: true,
        info: {
            Title: 'Code 128 Barcode Size Test Sheet',
            Author: 'Shop Management System',
        },
    });

    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    const barcodeImage = await generateBarcodeImage(
        BARCODE_TEST_CONFIG.testValue,
    );

    const grid = calculateGrid(doc);
    const testsPerPage = grid.columns * grid.rows;

    for (let index = 0; index < tests.length; index += 1) {
        if (index > 0 && index % testsPerPage === 0) {
            doc.addPage({
                size: page.size,
                layout: page.layout,
                margin: 0,
            });
        }

        const pageIndex = index % testsPerPage;
        const row = Math.floor(pageIndex / grid.columns);
        const column = pageIndex % grid.columns;

        const x =
            grid.marginLeft +
            column * (grid.cellWidth + grid.horizontalGap);

        const y =
            grid.marginTop +
            row * (grid.cellHeight + grid.verticalGap);

        drawTestLabel(
            doc,
            tests[index],
            barcodeImage,
            x,
            y,
            grid.cellWidth,
            grid.cellHeight,
        );
    }

    doc.end();

    return pdfPromise;
};
