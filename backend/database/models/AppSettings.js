import { DataTypes } from 'sequelize';

export default function(sequelize) {
    return sequelize.define('AppSettings', {
        key: {
            type: DataTypes.STRING(255),
            primaryKey: true,
            allowNull: false,
        },
        value_text: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        value_int: {
            type: DataTypes.BIGINT,
            allowNull: true,
        },
        value_type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['TEXT', 'INT']],
            },
        },
    }, {
        tableName: 'app_settings',
        timestamps: true,
        underscored: true,
    });
}
