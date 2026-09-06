import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RentalAgreement = sequelize.define(
        'RentalAgreement',
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

            agreementNumber: {
                type: DataTypes.STRING(20),
                field: 'agreement_number',
                allowNull: false,
                unique: true,
            },

            customerName: {
                type: DataTypes.STRING(255),
                field: 'customer_name',
                allowNull: true,
            },

            customerMobile: {
                type: DataTypes.STRING(30),
                field: 'customer_mobile',
                allowNull: true,
            },

            customerId: {
                type: DataTypes.INTEGER,
                field: 'customer_id',
                allowNull: true,
            },

            startDate: {
                type: DataTypes.DATEONLY,
                field: 'start_date',
                allowNull: false,
            },

            dueDate: {
                type: DataTypes.DATEONLY,
                field: 'due_date',
                allowNull: false,
            },

            depositRefundablePaise: {
                type: DataTypes.BIGINT,
                field: 'deposit_refundable_paise',
                allowNull: false,
                defaultValue: 0,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'active',
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            paymentMethod: {
                type: DataTypes.STRING(50),
                field: 'payment_method',
                allowNull: true,
            },

            customerSource: {
                type: DataTypes.STRING(50),
                field: 'customer_source',
                allowNull: true,
            },

            createdBy: {
                type: DataTypes.INTEGER,
                field: 'created_by',
                allowNull: true,
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
                allowNull: true,
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
            tableName: 'rental_agreements',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return RentalAgreement;
};
