import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const IntakeRecord = sequelize.define(
        'IntakeRecord',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                unique: true,
            },

            name: {
                type: DataTypes.STRING(200),
                allowNull: false,
            },

            purchasedOn: {
                type: DataTypes.DATEONLY,
                field: 'purchased_on',
                allowNull: false,
            },

            vendorId: {
                type: DataTypes.INTEGER,
                field: 'vendor_id',
                allowNull: true,
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'active',
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
            },

            createdAt: {
                type: DataTypes.DATE,
                field: 'created_at',
            },

            updatedAt: {
                type: DataTypes.DATE,
                field: 'updated_at',
            },
        },
        {
            tableName: 'intake_records',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return IntakeRecord;
};
