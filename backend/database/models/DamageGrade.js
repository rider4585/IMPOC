import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const DamageGrade = sequelize.define(
        'DamageGrade',
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
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            defaultChargePaise: {
                type: DataTypes.BIGINT,
                field: 'default_charge_paise',
                allowNull: false,
            },

            outcome: {
                type: DataTypes.STRING(30),
                allowNull: false,
            },

            isActive: {
                type: DataTypes.BOOLEAN,
                field: 'is_active',
                allowNull: false,
                defaultValue: true,
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
            tableName: 'damage_grades',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return DamageGrade;
};
