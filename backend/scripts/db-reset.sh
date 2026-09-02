#!/bin/bash

# Database Reset Script for IMPOC
# This script completely resets the database:
# 1. Undoes all migrations
# 2. Runs all migrations fresh
# 3. Seeds the database with initial data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         IMPOC Database Reset Script                          ║"
echo "║                                                              ║"
echo "║  ⚠️  WARNING: This will delete ALL data in the database!     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Ask for confirmation
echo -e "${YELLOW}Are you sure you want to reset the database? (yes/no)${NC}"
read -p "Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}❌ Database reset cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 Starting database reset...${NC}"
echo ""

# Step 1: Undo all migrations
echo -e "${BLUE}Step 1: Undoing all migrations...${NC}"
if npx sequelize-cli db:migrate:undo:all; then
    echo -e "${GREEN}✅ All migrations undone${NC}"
else
    echo -e "${RED}❌ Failed to undo migrations${NC}"
    exit 1
fi

echo ""

# Step 2: Run all migrations
echo -e "${BLUE}Step 2: Running migrations...${NC}"
if npm run db:migrate; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Failed to run migrations${NC}"
    exit 1
fi

echo ""

# Step 3: Seed the database
echo -e "${BLUE}Step 3: Seeding database with initial data...${NC}"
if npm run db:seed; then
    echo -e "${GREEN}✅ Database seeded successfully${NC}"
else
    echo -e "${RED}❌ Failed to seed database${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 ✅ Database Reset Complete!                  ║"
echo "║                                                              ║"
echo "║  Your database has been reset with fresh data:              ║"
echo "║  • All tables created                                        ║"
echo "║  • Roles seeded (ADMIN, MANAGER, etc.)                       ║"
echo "║  • Permissions seeded                                        ║"
echo "║  • Admin user created                                        ║"
echo "║                                                              ║"
echo "║  Default admin credentials:                                 ║"
echo "║  • Username: admin                                           ║"
echo "║  • Password: (from SEED_ADMIN_PASSWORD env var)             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Start the server: ${BLUE}npm run dev${NC}"
echo "2. Login with admin credentials"
echo "3. Start developing! 🚀"
