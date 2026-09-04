import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Customer = sequelize.define(
        'Customer',
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
                type: DataTypes.STRING(255),
                allowNull: false,
            },

            phone: {
                type: DataTypes.STRING(30),
                allowNull: true,
            },

            email: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            dob: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            consentWhatsapp: {
                type: DataTypes.BOOLEAN,
                field: 'consent_whatsapp',
                allowNull: false,
                defaultValue: false,
            },

            consentEmail: {
                type: DataTypes.BOOLEAN,
                field: 'consent_email',
                allowNull: false,
                defaultValue: false,
            },

            consentSms: {
                type: DataTypes.BOOLEAN,
                field: 'consent_sms',
                allowNull: false,
                defaultValue: false,
            },

            consentWhatsappGroup: {
                type: DataTypes.BOOLEAN,
                field: 'consent_whatsapp_group',
                allowNull: false,
                defaultValue: false,
            },

            consentRecordedAt: {
                type: DataTypes.DATE,
                field: 'consent_recorded_at',
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
            tableName: 'customers',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Customer;
};
