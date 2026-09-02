import {Sequelize} from 'sequelize';

import config from '../../config/config.js';
import { configureBigintParser } from '../../src/database/pg-pool-config.js';

const env = process.env.NODE_ENV || 'development';

const sequelize = new Sequelize(
    config[env].database,
    config[env].username,
    config[env].password,
    {
        host: config[env].host,
        port: config[env].port,
        dialect: config[env].dialect,
        logging: config[env].logging,
    }
);

// Configure pool to parse PostgreSQL BIGINT (int8) as JavaScript number
// Must happen before any queries run
try {
    configureBigintParser(sequelize);
} catch (error) {
    console.error('Failed to configure BIGINT parser:', error.message);
    throw error;
}

import UserModel from './User.js';
import RoleModel from './Role.js';
import PermissionModel from './Permission.js';
import UserRoleModel from './UserRole.js';
import RolePermissionModel from './RolePermission.js';
import AuthSessionModel from './AuthSession.js';
import RequestKeyModel from './RequestKey.js';
import AppSettingsModel from './AppSettings.js';
import ProductTypeModel from './ProductType.js';
import ColourModel from './Colour.js';
import SizeModel from './Size.js';
import DamageGradeModel from './DamageGrade.js';
import VendorModel from './Vendor.js';
import StockIntakeModel from './StockIntake.js';
import StockIntakeLineModel from './StockIntakeLine.js';
import UnitModel from './Unit.js';
import UnitStatusEventModel from './UnitStatusEvent.js';
import SaleModel from './Sale.js';
import SaleLineModel from './SaleLine.js';
import SaleReversalModel from './SaleReversal.js';
import RentalAgreementModel from './RentalAgreement.js';
import RentalLineModel from './RentalLine.js';
import RentalReturnModel from './RentalReturn.js';
import RentalReversalModel from './RentalReversal.js';
import ExpenseModel from './Expense.js';
import ExpenseReversalModel from './ExpenseReversal.js';

const User = UserModel(sequelize);
const Role = RoleModel(sequelize);
const Permission = PermissionModel(sequelize);
const UserRole = UserRoleModel(sequelize);
const RolePermission = RolePermissionModel(sequelize);
const AuthSession = AuthSessionModel(sequelize);
const RequestKey = RequestKeyModel(sequelize);
const AppSettings = AppSettingsModel(sequelize);
const ProductType = ProductTypeModel(sequelize);
const Colour = ColourModel(sequelize);
const Size = SizeModel(sequelize);
const DamageGrade = DamageGradeModel(sequelize);
const Vendor = VendorModel(sequelize);
const StockIntake = StockIntakeModel(sequelize);
const StockIntakeLine = StockIntakeLineModel(sequelize);
const Unit = UnitModel(sequelize);
const UnitStatusEvent = UnitStatusEventModel(sequelize);
const Sale = SaleModel(sequelize);
const SaleLine = SaleLineModel(sequelize);
const SaleReversal = SaleReversalModel(sequelize);
const RentalAgreement = RentalAgreementModel(sequelize);
const RentalLine = RentalLineModel(sequelize);
const RentalReturn = RentalReturnModel(sequelize);
const RentalReversal = RentalReversalModel(sequelize);
const Expense = ExpenseModel(sequelize);
const ExpenseReversal = ExpenseReversalModel(sequelize);

/*
 * User ↔ Role
 */
User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: 'userId',
    otherKey: 'roleId',
    as: 'roles',
});

Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: 'roleId',
    otherKey: 'userId',
    as: 'users',
});

/*
 * Role ↔ Permission
 */
Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'roleId',
    otherKey: 'permissionId',
    as: 'permissions',
});

Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'permissionId',
    otherKey: 'roleId',
    as: 'roles',
});

/*
 * Direct relationships with join models
 */
User.hasMany(UserRole, {
    foreignKey: 'userId',
    as: 'userRoles',
});

UserRole.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
});

Role.hasMany(UserRole, {
    foreignKey: 'roleId',
    as: 'userRoles',
});

UserRole.belongsTo(Role, {
    foreignKey: 'roleId',
    as: 'role',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
});

Role.hasMany(RolePermission, {
    foreignKey: 'roleId',
    as: 'rolePermissions',
});

RolePermission.belongsTo(Role, {
    foreignKey: 'roleId',
    as: 'role',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
});

Permission.hasMany(RolePermission, {
    foreignKey: 'permissionId',
    as: 'rolePermissions',
});

RolePermission.belongsTo(Permission, {
    foreignKey: 'permissionId',
    as: 'permission',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
});

// User ↔ AuthSession

User.hasMany(AuthSession, {
    foreignKey: 'userId',
    as: 'authSessions',
});

AuthSession.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
});

/*
 * ProductType ↔ ProductType (self-referential)
 */
ProductType.hasMany(ProductType, {
    foreignKey: 'parentId',
    as: 'children',
});

ProductType.belongsTo(ProductType, {
    foreignKey: 'parentId',
    as: 'parent',
});

/*
 * StockIntake ↔ Vendor
 */
Vendor.hasMany(StockIntake, {
    foreignKey: 'vendor_id',
    as: 'stockIntakes',
});

StockIntake.belongsTo(Vendor, {
    foreignKey: 'vendor_id',
    as: 'vendor',
});

/*
 * StockIntake ↔ StockIntakeLine
 */
StockIntake.hasMany(StockIntakeLine, {
    foreignKey: 'stock_intake_id',
    as: 'lines',
});

StockIntakeLine.belongsTo(StockIntake, {
    foreignKey: 'stock_intake_id',
    as: 'trip',
});

/*
 * StockIntakeLine ↔ ProductType
 */
StockIntakeLine.belongsTo(ProductType, {
    foreignKey: 'product_type_id',
    as: 'productType',
});

/*
 * Unit ↔ StockIntakeLine (lot)
 */
StockIntakeLine.hasMany(Unit, {
    foreignKey: 'stock_intake_line_id',
    as: 'units',
});

Unit.belongsTo(StockIntakeLine, {
    foreignKey: 'stock_intake_line_id',
    as: 'lot',
});

/*
 * Unit ↔ Colour
 */
Unit.belongsTo(Colour, {
    foreignKey: 'colour_id',
    as: 'colour',
});

/*
 * Unit ↔ Size
 */
Unit.belongsTo(Size, {
    foreignKey: 'size_id',
    as: 'size',
});

/*
 * UnitStatusEvent ↔ Unit
 */
UnitStatusEvent.belongsTo(Unit, {
    foreignKey: 'unit_id',
    as: 'unit',
});

Unit.hasMany(UnitStatusEvent, {
    foreignKey: 'unit_id',
    as: 'statusEvents',
});

/*
 * Sale �+" SaleLine
 */
Sale.hasMany(SaleLine, {
    foreignKey: 'sale_id',
    as: 'lines',
});

SaleLine.belongsTo(Sale, {
    foreignKey: 'sale_id',
    as: 'sale',
});

/*
 * SaleLine �+" Unit
 */
SaleLine.belongsTo(Unit, {
    foreignKey: 'unit_id',
    as: 'unit',
});

Unit.hasMany(SaleLine, {
    foreignKey: 'unit_id',
    as: 'saleLines',
});

/*
 * Sale �+" SaleReversal
 */
Sale.hasMany(SaleReversal, {
    foreignKey: 'sale_id',
    as: 'reversals',
});

SaleReversal.belongsTo(Sale, {
    foreignKey: 'sale_id',
    as: 'sale',
});

/*
 * RentalAgreement �+" RentalLine
 */
RentalAgreement.hasMany(RentalLine, {
    foreignKey: 'agreement_id',
    as: 'lines',
});

RentalLine.belongsTo(RentalAgreement, {
    foreignKey: 'agreement_id',
    as: 'agreement',
});

/*
 * RentalLine �+" Unit
 */
RentalLine.belongsTo(Unit, {
    foreignKey: 'unit_id',
    as: 'unit',
});

Unit.hasMany(RentalLine, {
    foreignKey: 'unit_id',
    as: 'rentalLines',
});

/*
 * RentalAgreement �+" RentalReturn
 */
RentalAgreement.hasMany(RentalReturn, {
    foreignKey: 'agreement_id',
    as: 'returns',
});

RentalReturn.belongsTo(RentalAgreement, {
    foreignKey: 'agreement_id',
    as: 'agreement',
});

/*
 * RentalLine �+" RentalReturn
 */
RentalLine.hasMany(RentalReturn, {
    foreignKey: 'rental_line_id',
    as: 'returns',
});

RentalReturn.belongsTo(RentalLine, {
    foreignKey: 'rental_line_id',
    as: 'line',
});

/*
 * RentalAgreement �+" RentalReversal
 */
RentalAgreement.hasMany(RentalReversal, {
    foreignKey: 'agreement_id',
    as: 'reversals',
});

RentalReversal.belongsTo(RentalAgreement, {
    foreignKey: 'agreement_id',
    as: 'agreement',
});

/*
 * Expense �+" ExpenseReversal
 */
Expense.hasMany(ExpenseReversal, {
    foreignKey: 'expense_id',
    as: 'reversals',
});

ExpenseReversal.belongsTo(Expense, {
    foreignKey: 'expense_id',
    as: 'expense',
});

export {
    sequelize,
    Sequelize,
    User,
    Role,
    Permission,
    UserRole,
    RolePermission,
    AuthSession,
    RequestKey,
    AppSettings,
    ProductType,
    Colour,
    Size,
    DamageGrade,
    Vendor,
    StockIntake,
    StockIntakeLine,
    Unit,
    UnitStatusEvent,
    Sale,
    SaleLine,
    SaleReversal,
    RentalAgreement,
    RentalLine,
    RentalReturn,
    RentalReversal,
    Expense,
    ExpenseReversal
};