import { DataTypes } from 'sequelize';

/**
 * Single-row label-sheet layout (R-50). All lengths in mm except *Pt fields.
 * DECIMAL comes back from pg as a string; the service coerces to Number.
 */
export default (sequelize) => {
    const mm = (field, defaultValue) => ({
        type: DataTypes.DECIMAL(6, 2),
        field,
        allowNull: false,
        defaultValue,
    });

    const BarcodeLayout = sequelize.define(
        'BarcodeLayout',
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
            pageSize: { type: DataTypes.STRING(10), field: 'page_size', allowNull: false, defaultValue: 'A4' },
            orientation: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'portrait' },
            // R-56: only used when pageSize === 'CUSTOM'
            pageCustomWidthMm: { type: DataTypes.DECIMAL(7, 2), field: 'page_custom_width_mm', allowNull: false, defaultValue: 101.6 },
            pageCustomHeightMm: { type: DataTypes.DECIMAL(7, 2), field: 'page_custom_height_mm', allowNull: false, defaultValue: 152.4 },
            columns: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
            rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
            marginTopMm: mm('margin_top_mm', 8),
            marginRightMm: mm('margin_right_mm', 8),
            marginBottomMm: mm('margin_bottom_mm', 8),
            marginLeftMm: mm('margin_left_mm', 8),
            gapHorizontalMm: mm('gap_horizontal_mm', 5),
            gapVerticalMm: mm('gap_vertical_mm', 6),
            barcodeWidthMm: mm('barcode_width_mm', 35),
            barcodeHeightMm: mm('barcode_height_mm', 8),
            textFontSizePt: mm('text_font_size_pt', 5),
            textMarginTopMm: mm('text_margin_top_mm', 1.4),
            showText: { type: DataTypes.BOOLEAN, field: 'show_text', allowNull: false, defaultValue: true },
            labelPaddingTopMm: mm('label_padding_top_mm', 2.8),
            labelPaddingBottomMm: mm('label_padding_bottom_mm', 2.1),
            labelPaddingXMm: mm('label_padding_x_mm', 3.5),
            borderWidthPt: mm('border_width_pt', 1),
            borderRadiusMm: mm('border_radius_mm', 0),
            showDivider: { type: DataTypes.BOOLEAN, field: 'show_divider', allowNull: false, defaultValue: true },
            infoBoxMinHeightMm: mm('info_box_min_height_mm', 5),
            updatedBy: { type: DataTypes.INTEGER, field: 'updated_by', allowNull: true },
            createdAt: { type: DataTypes.DATE, field: 'created_at' },
            updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
        },
        {
            tableName: 'barcode_layouts',
            timestamps: true,
            underscored: true,
        }
    );

    return BarcodeLayout;
};
