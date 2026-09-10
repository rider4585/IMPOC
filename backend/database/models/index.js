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
import PaymentMethodModel from './PaymentMethod.js';
import CustomerSourceModel from './CustomerSource.js';
import ExpenseTypeModel from './ExpenseType.js';
import VendorModel from './Vendor.js';
import TripModel from './Trip.js';
import TripVendorModel from './TripVendor.js';
import StockModel from './Stock.js';
import StockTemplateModel from './StockTemplate.js';
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
import CustomerModel from './Customer.js';
import DeliveryLogModel from './DeliveryLog.js';

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
const PaymentMethod = PaymentMethodModel(sequelize);
const CustomerSource = CustomerSourceModel(sequelize);
const ExpenseType = ExpenseTypeModel(sequelize);
const Vendor = VendorModel(sequelize);
const Trip = TripModel(sequelize);
const TripVendor = TripVendorModel(sequelize);
const Stock = StockModel(sequelize);
const StockTemplate = StockTemplateModel(sequelize);
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
const Customer = CustomerModel(sequelize);
const DeliveryLog = DeliveryLogModel(sequelize);

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
 * Trip ↔ Vendor (via TripVendor junction)
 */
Trip.belongsToMany(Vendor, {
    through: TripVendor,
    foreignKey: 'tripId',
    otherKey: 'vendorId',
    as: 'vendors',
});

Vendor.belongsToMany(Trip, {
    through: TripVendor,
    foreignKey: 'vendorId',
    otherKey: 'tripId',
    as: 'trips',
});

Trip.hasMany(TripVendor, {
    foreignKey: 'trip_id',
    as: 'tripVendors',
});

TripVendor.belongsTo(Trip, {
    foreignKey: 'trip_id',
    as: 'trip',
});

Vendor.hasMany(TripVendor, {
    foreignKey: 'vendor_id',
    as: 'tripVendors',
});

TripVendor.belongsTo(Vendor, {
    foreignKey: 'vendor_id',
    as: 'vendor',
});

/*
 * TripVendor ↔ Stock
 */
TripVendor.hasMany(Stock, {
    foreignKey: 'trip_vendor_id',
    as: 'stocks',
});

Stock.belongsTo(TripVendor, {
    foreignKey: 'trip_vendor_id',
    as: 'tripVendor',
});

/*
 * Trip ↔ Stock
 */
Trip.hasMany(Stock, {
    foreignKey: 'trip_id',
    as: 'stocks',
});

Stock.belongsTo(Trip, {
    foreignKey: 'trip_id',
    as: 'trip',
});

/*
 * Vendor ↔ Stock
 */
Vendor.hasMany(Stock, {
    foreignKey: 'vendor_id',
    as: 'stocks',
});

Stock.belongsTo(Vendor, {
    foreignKey: 'vendor_id',
    as: 'vendor',
});

/*
 * Stock ↔ ProductType
 */
Stock.belongsTo(ProductType, {
    foreignKey: 'product_type_id',
    as: 'productType',
});

/*
 * Stock ↔ ProductType (subtype)
 */
Stock.belongsTo(ProductType, {
    foreignKey: 'subTypeId',
    as: 'subType',
    onDelete: 'SET NULL',
});

/*
 * Stock ↔ Unit
 */
Stock.hasMany(Unit, {
    foreignKey: 'stock_id',
    as: 'units',
});

Unit.belongsTo(Stock, {
    foreignKey: 'stock_id',
    as: 'stock',
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
 * Sale ↔ SaleLine
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
 * SaleLine ↔ Unit
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
 * Sale ↔ SaleReversal
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
 * RentalAgreement ↔ RentalLine
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
 * RentalLine ↔ Unit
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
 * RentalAgreement ↔ RentalReturn
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
 * RentalLine ↔ RentalReturn
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
 * RentalAgreement ↔ RentalReversal
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
 * Expense ↔ ExpenseReversal
 */
Expense.hasMany(ExpenseReversal, {
    foreignKey: 'expense_id',
    as: 'reversals',
});

ExpenseReversal.belongsTo(Expense, {
    foreignKey: 'expense_id',
    as: 'expense',
});

/*
 * StockTemplate ↔ Vendor
 */
Vendor.hasMany(StockTemplate, {
    foreignKey: 'vendor_id',
    as: 'stockTemplates',
});

StockTemplate.belongsTo(Vendor, {
    foreignKey: 'vendor_id',
    as: 'vendor',
});

/*
 * StockTemplate ↔ ProductType
 */
StockTemplate.belongsTo(ProductType, {
    foreignKey: 'product_type_id',
    as: 'productType',
});

/*
 * StockTemplate ↔ ProductType (subtype)
 */
StockTemplate.belongsTo(ProductType, {
    foreignKey: 'subTypeId',
    as: 'subType',
    onDelete: 'SET NULL',
});

/*
 * Customer ↔ Sale
 */
Customer.hasMany(Sale, {
    foreignKey: 'customer_id',
    as: 'sales',
});

Sale.belongsTo(Customer, {
    foreignKey: 'customer_id',
    as: 'customer',
});

/*
 * Customer ↔ RentalAgreement
 */
Customer.hasMany(RentalAgreement, {
    foreignKey: 'customer_id',
    as: 'rentals',
});

RentalAgreement.belongsTo(Customer, {
    foreignKey: 'customer_id',
    as: 'customer',
});

/*
 * DeliveryLog (no FK - designed for future WhatsApp/SMTP/SMS integration,
 * entity_id stores the target entity's uuid, not a relational id)
 */

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
    PaymentMethod,
    CustomerSource,
    ExpenseType,
    Vendor,
    Trip,
    TripVendor,
    Stock,
    StockTemplate,
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
    ExpenseReversal,
    Customer,
    DeliveryLog,
};