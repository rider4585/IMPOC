# Database Reset Guide

## 🔄 Quick Start

### Reset Database (Full Reset with Fresh Data)

```bash
npm run db:reset
```

This will:
1. ✅ Undo all migrations
2. ✅ Run all migrations fresh
3. ✅ Seed database with initial data (roles, permissions, admin user)
4. ✅ Ready to use!

---

## 🎯 Available Commands

### Full Reset (Undo + Migrate + Seed)
```bash
npm run db:reset
```
**Use when**: You want a complete fresh database with all seeded data

### Refresh (Undo Migrations + Remigrate + Reseed)
```bash
npm run db:refresh
```
**Use when**: You want to start fresh without losing schema changes

### Individual Commands

**Undo all migrations:**
```bash
npm run db:migrate:undo:all
```

**Run all migrations:**
```bash
npm run db:migrate
```

**Seed database:**
```bash
npm run db:seed
```

**Undo all seeds:**
```bash
npm run db:seed:undo:all
```

**Check migration status:**
```bash
npm run db:migrate:status
```

---

## 📋 What Gets Reset

### Database Tables
- ✅ users
- ✅ roles
- ✅ permissions
- ✅ user_roles (junction)
- ✅ role_permissions (junction)
- ✅ auth_sessions

### Seeded Initial Data

**Roles:**
- ADMIN (full access)
- MANAGER
- INVENTORY_MANAGER
- CASHIER
- ACCOUNTANT

**Permissions:**
- users.view, users.create, users.update, users.delete
- roles.view, roles.manage
- inventory.view, inventory.create, inventory.update, inventory.delete
- sales.view, sales.create, sales.cancel, sales.refund
- expenses.view, expenses.create, expenses.update
- reports.view

**Default Admin User:**
- Username: `admin`
- Email: `admin@shreefashion.local`
- Phone: `9999999999`
- Status: `ACTIVE`
- Password: Set via `SEED_ADMIN_PASSWORD` environment variable

---

## ⚠️ Important Notes

### Warning
⚠️ **Database reset will DELETE ALL DATA!** Make sure you:
- Back up any important data first
- Are in a development environment
- Have confirmed you want to reset

### Required Environment Variable

Before running reset, set the admin password:

```bash
# Linux/Mac
export SEED_ADMIN_PASSWORD=YourPassword123

# Or in .env file
SEED_ADMIN_PASSWORD=YourPassword123
```

Without this, the admin user creation will fail.

---

## 🚀 Workflow

### Fresh Development Start

```bash
# 1. Set admin password
export SEED_ADMIN_PASSWORD=password123

# 2. Reset database
npm run db:reset

# 3. Start server
npm run dev

# 4. Login with
# Username: admin
# Password: password123
```

### After Modifying Migrations

```bash
# If you added new migrations/seeders
npm run db:reset
```

### Quick Refresh (Keep Structure)

```bash
# If you only changed seeder data
npm run db:refresh
```

---

## 🔍 Verify Reset Success

After running `npm run db:reset`, you should see:

```
✅ All migrations undone
✅ Migrations completed successfully
✅ Database seeded successfully

╔══════════════════════════════════════════════════════════════╗
║                 ✅ Database Reset Complete!                  ║
║  Your database has been reset with fresh data:              ║
║  • All tables created                                        ║
║  • Roles seeded (ADMIN, MANAGER, etc.)                       ║
║  • Permissions seeded                                        ║
║  • Admin user created                                        ║
╚══════════════════════════════════════════════════════════════╝
```

Then test with:

```bash
# Start the server
npm run dev

# In another terminal, test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

---

## 🐛 Troubleshooting

### Error: "Cannot undo migrations"

**Cause**: Database doesn't exist yet
**Solution**: Just run migrations fresh
```bash
npm run db:migrate
npm run db:seed
```

### Error: "Admin password not set"

**Cause**: `SEED_ADMIN_PASSWORD` environment variable missing
**Solution**: 
```bash
export SEED_ADMIN_PASSWORD=YourPassword123
npm run db:reset
```

### Error: "Cannot connect to database"

**Cause**: PostgreSQL not running or connection failed
**Solution**: Check your database configuration in `config/config.js`
```bash
# Start PostgreSQL (if using MAMP)
# Or configure connection string in .env
```

### Error: "Role already exists"

**Cause**: Database partially reset
**Solution**: Completely undo then migrate
```bash
npm run db:migrate:undo:all
npm run db:migrate
npm run db:seed
```

### Migrations Status Shows Pending

**Cause**: Migrations not properly applied
**Solution**: Check status and apply manually
```bash
npm run db:migrate:status
npm run db:migrate
```

---

## 📁 Related Files

- **Migrations**: `backend/database/migrations/`
- **Seeders**: `backend/database/seeders/`
- **Models**: `backend/database/models/`
- **Config**: `backend/config/config.js`
- **Script**: `backend/scripts/db-reset.sh`

---

## 💡 Tips

### Backup Before Reset
```bash
# Dump current database (if PostgreSQL)
pg_dump impoc > backup.sql

# Later, restore from backup
psql impoc < backup.sql
```

### Create Custom Seeders
Add new seeders in `database/seeders/` following the pattern:
```javascript
export async function up(queryInterface) {
    // Insert seed data
}

export async function down(queryInterface) {
    // Clean up
}
```

Then run:
```bash
npm run db:seed
```

### Migrate Specific Migration
```bash
# Run only one migration
npx sequelize-cli db:migrate --to [timestamp]-[migration-name]

# Undo to specific point
npx sequelize-cli db:migrate:undo --to [timestamp]-[migration-name]
```

---

## 🎓 Learning Path

1. **First time**: Read this guide
2. **Setup**: `npm run db:reset`
3. **Development**: `npm run dev`
4. **Testing**: Use Postman collection with seeded data
5. **Iterate**: Make changes, reset if needed

---

## ✨ Success Indicators

✅ Database reset without errors
✅ Admin user can login
✅ 5 roles exist (ADMIN, MANAGER, etc.)
✅ 18+ permissions created
✅ Ready for development/testing

---

## 📞 Quick Reference

| Command | What It Does |
|---------|-------------|
| `npm run db:reset` | **Full reset** - undo all, migrate, seed |
| `npm run db:refresh` | **Refresh only** - undo, migrate, seed (keep code) |
| `npm run db:migrate` | **Migrate only** - run pending migrations |
| `npm run db:migrate:undo:all` | **Undo all** - remove all migrations |
| `npm run db:seed` | **Seed only** - run all seeders |
| `npm run db:seed:undo:all` | **Undo seeds** - remove all seeded data |
| `npm run db:migrate:status` | **Status** - see pending migrations |

---

## 🚀 You're Ready!

Run `npm run db:reset` and start developing! 🎉
