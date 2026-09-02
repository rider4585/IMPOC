import * as db from '../../database/models/index.js';

let isInitialized = false;

export async function initializeTestDatabase() {
  try {
    // Only sync once per test run, not for each test file
    if (!isInitialized) {
      await db.sequelize.sync({ force: true });

      // Create partial unique index on vendors name (for deactivation safety)
      // This index allows name reuse after soft-delete while preventing active duplicates
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL'
      );

      // Create partial unique index on stock_intakes (vendor_id, bill_reference) for duplicate prevention
      // This index allows reusing bill references after soft-delete while preventing active duplicates
      await db.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_intakes_vendor_bill ON stock_intakes (vendor_id, bill_reference) WHERE deleted_at IS NULL'
      );

      // Create triggers and constraints that are in migrations but not created by sync()
      await db.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS app_settings_update_timestamp ON app_settings;

        CREATE TRIGGER app_settings_update_timestamp
        BEFORE UPDATE ON app_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_app_settings_updated_at();
      `);

      await db.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_request_keys_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS request_keys_update_timestamp ON request_keys;

        CREATE TRIGGER request_keys_update_timestamp
        BEFORE UPDATE ON request_keys
        FOR EACH ROW
        EXECUTE FUNCTION update_request_keys_updated_at();
      `);

      // Add CHECK constraints that are in migrations but not created by sync()
      await db.sequelize.query(
        `ALTER TABLE app_settings ADD CONSTRAINT app_settings_value_type_check CHECK (value_type IN ('TEXT', 'INT'))`
      );

      await db.sequelize.query(
        `ALTER TABLE request_keys ADD CONSTRAINT request_keys_gesture_type_check CHECK (gesture_type IN ('SALE_CHECKOUT', 'SALE_EXCHANGE', 'RENTAL_BOOK', 'RENTAL_HANDOVER', 'RENTAL_AMEND', 'RENTAL_CANCEL', 'RENTAL_SETTLE', 'RENTAL_WRITE_OFF', 'UNIT_RECOVER', 'UNIT_TRANSITION', 'EXPENSE_CREATE', 'EXPENSE_REVERSE', 'INTAKE_SCAN', 'BARCODE_GENERATE', 'BARCODE_GENERATE_TEST'))`
      );

      // Create barcode_seq sequence (from migration 20260824000002)
      try {
        await db.sequelize.query(
          'CREATE SEQUENCE public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;'
        );
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }

      // Seed barcode geometry settings (from migration 20260825000006)
      const MM_TO_POINTS = 72 / 25.4;
      const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);

      const geometrySettings = [
        { key: 'barcode_width_pt', value_text: mmToPoints(35), value_type: 'TEXT' },
        { key: 'barcode_height_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_text_font_size_pt', value_text: '5', value_type: 'TEXT' },
        { key: 'barcode_clear_space_pt', value_text: '15', value_type: 'TEXT' },
        { key: 'barcode_margin_top_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_right_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_bottom_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_left_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_gap_horizontal_pt', value_text: mmToPoints(5), value_type: 'TEXT' },
        { key: 'barcode_gap_vertical_pt', value_text: mmToPoints(6), value_type: 'TEXT' },
        { key: 'barcode_grid_columns', value_int: 3, value_type: 'INT' },
        { key: 'barcode_grid_rows', value_int: 5, value_type: 'INT' },
      ];

      for (const setting of geometrySettings) {
        const sql = `
          INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO NOTHING
        `;
        await db.sequelize.query(sql, {
          replacements: [setting.key, setting.value_text || null, setting.value_int || null, setting.value_type],
          type: db.sequelize.QueryTypes.INSERT,
        });
      }

      await seedTestData();
      isInitialized = true;
    }
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export async function seedTestData() {
  // Create roles
  const roles = await db.Role.bulkCreate([
    { name: 'ADMIN', description: 'Administrator with full access' },
    { name: 'MANAGER', description: 'Manager role' },
    { name: 'INVENTORY_MANAGER', description: 'Inventory manager role' },
    { name: 'CASHIER', description: 'Cashier role' },
    { name: 'ACCOUNTANT', description: 'Accountant role' },
  ], { ignoreDuplicates: true });

  // Create permissions
  const permissions = await db.Permission.bulkCreate([
    // User permissions
    { name: 'users.view', description: 'View users' },
    { name: 'users.create', description: 'Create users' },
    { name: 'users.update', description: 'Update users' },
    { name: 'users.delete', description: 'Delete users' },
    // Inventory permissions
    { name: 'inventory.view', description: 'View inventory' },
    { name: 'inventory.create', description: 'Create inventory items' },
    { name: 'inventory.update', description: 'Update inventory' },
    { name: 'inventory.delete', description: 'Delete inventory' },
    { name: 'inventory.barcode_generate', description: 'Generate barcodes' },
    // Sales permissions
    { name: 'sales.view', description: 'View sales' },
    { name: 'sales.create', description: 'Create sales' },
    { name: 'sales.cancel', description: 'Cancel sales' },
    { name: 'sales.refund', description: 'Process refunds' },
    // Expenses permissions
    { name: 'expenses.view', description: 'View expenses' },
    { name: 'expenses.create', description: 'Create expenses' },
    { name: 'expenses.update', description: 'Update expenses' },
    // Reports permissions
    { name: 'reports.view', description: 'View reports' },
    // Role permissions
    { name: 'roles.view', description: 'View roles' },
    { name: 'roles.manage', description: 'Manage roles' },
    // Picklists permissions
    { name: 'picklists.view', description: 'View picklists' },
    { name: 'picklists.create', description: 'Create picklists' },
    { name: 'picklists.update', description: 'Update picklists' },
  ], { ignoreDuplicates: true });

  // Assign permissions to ADMIN role (all permissions)
  const adminRole = roles[0];
  await adminRole.addPermissions(permissions);

  // Assign permissions to MANAGER role
  const managerRole = roles[1];
  const managerPermissions = permissions.filter(p =>
    ['users.view', 'users.update', 'inventory.view', 'inventory.create', 'inventory.update', 'inventory.barcode_generate', 'picklists.view', 'picklists.create', 'picklists.update', 'sales.view', 'sales.create', 'sales.cancel', 'sales.refund', 'expenses.view', 'expenses.create', 'expenses.update', 'reports.view'].includes(p.name)
  );
  await managerRole.addPermissions(managerPermissions);

  // Assign permissions to INVENTORY_MANAGER role
  const invRole = roles[2];
  const invPermissions = permissions.filter(p =>
    ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete', 'inventory.barcode_generate', 'picklists.view', 'picklists.create', 'picklists.update'].includes(p.name)
  );
  await invRole.addPermissions(invPermissions);

  // Assign permissions to CASHIER role
  const cashierRole = roles[3];
  const cashierPermissions = permissions.filter(p =>
    ['inventory.view', 'sales.view', 'sales.create'].includes(p.name)
  );
  await cashierRole.addPermissions(cashierPermissions);

  // Assign permissions to ACCOUNTANT role
  const accountantRole = roles[4];
  const accountantPermissions = permissions.filter(p =>
    ['sales.view', 'expenses.view', 'expenses.create', 'expenses.update', 'reports.view', 'roles.view'].includes(p.name)
  );
  await accountantRole.addPermissions(accountantPermissions);

  return { roles, permissions };
}

export async function cleanupTestDatabase() {
  try {
    // Clean ProductType records first (before other cleanups due to FK dependencies)
    if (db.ProductType) {
      await db.ProductType.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TestProductType_%'
          }
        }
      });
    }

    // Clean Colour and Size records
    if (db.Colour) {
      await db.Colour.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TEST_%'
          }
        }
      });
    }

    if (db.Size) {
      await db.Size.destroy({
        where: {
          name: {
            [db.Sequelize.Op.like]: 'TEST_%'
          }
        }
      });
    }

    // Clean only test-created data, not auth sessions or core users
    // Note: We do NOT truncate RolePermission because it contains core seeded data
    // that is needed by subsequent tests. Instead, we rely on tests to create and
    // clean up their own test-specific role-permission associations.
    const tablesToClean = ['UserRole'];

    for (const model of tablesToClean) {
      if (db[model]) {
        await db[model].truncate();
      }
    }

    // Clean test-created users (not admin)
    await db.User.destroy({
      where: {
        username: {
          [db.Sequelize.Op.like]: 'testuser_%'
        }
      }
    });

    // Clean test-created roles
    await db.Role.destroy({
      where: {
        name: {
          [db.Sequelize.Op.like]: 'TEST_ROLE_%'
        }
      }
    });

    // Clean test-created permissions
    await db.Permission.destroy({
      where: {
        name: {
          [db.Sequelize.Op.like]: 'test.%'
        }
      }
    });

    // Do NOT truncate AuthSession - allows tokens to persist for multiple tests
    // Do NOT truncate Users with admin accounts
  } catch (error) {
    console.error('Database cleanup failed:', error);
    throw error;
  }
}

export async function closeDatabase() {
  try {
    await db.sequelize.close();
  } catch (error) {
    console.error('Database close failed:', error);
    throw error;
  }
}

/*
 * Date.now() alone collides when two fixtures are built inside the same
 * millisecond, which made any test creating two records in a row fail on a
 * unique-name constraint. The counter makes every generated name unique
 * regardless of clock resolution.
 */
let uniqueCounter = 0;

function uniqueSuffix() {
  uniqueCounter += 1;
  return `${Date.now()}_${uniqueCounter}`;
}

export function generateTestUser(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    username: `testuser_${suffix}`,
    email: `test_${suffix}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password: 'TestPassword123!',
    phone: '+1234567890',
    ...overrides,
  };
}

export function generateTestRole(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `TEST_ROLE_${suffix}`.toUpperCase(),
    description: 'Test role',
    ...overrides,
  };
}

export function generateTestPermission(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `test.permission.${suffix}`,
    description: 'Test permission',
    ...overrides,
  };
}

export function generateTestProductType(overrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: `TestProductType_${suffix}`,
    ...overrides,
  };
}
