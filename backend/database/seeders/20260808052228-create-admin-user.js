'use strict';

import argon2 from 'argon2';
import { randomUUID } from 'crypto';

export async function up(queryInterface) {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    if (!adminPassword) {
        throw new Error(
            'Missing required environment variable: SEED_ADMIN_PASSWORD'
        );
    }

    const [existingUsers] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM users
        WHERE username = 'admin'
        LIMIT 1
        `
    );

    let adminUserId;

    if (existingUsers.length) {
        adminUserId = existingUsers[0].id;
    } else {
        const passwordHash = await argon2.hash(
            adminPassword,
            {
                type: argon2.argon2id,
            }
        );

        await queryInterface.bulkInsert('users', [
            {
                uuid: randomUUID(),
                username: 'admin',
                email: 'admin@shreefashion.local',
                password_hash: passwordHash,
                first_name: 'Shop',
                last_name: 'Admin',
                phone: '9999999999',
                status: 'ACTIVE',
                created_at: new Date(),
                updated_at: new Date(),
            },
        ]);

        const [users] = await queryInterface.sequelize.query(
            `
            SELECT id
            FROM users
            WHERE username = 'admin'
            LIMIT 1
            `
        );

        if (!users.length) {
            throw new Error('Failed to create admin user');
        }

        adminUserId = users[0].id;
    }

    const [roles] = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM roles
            WHERE name = 'ADMIN'
                LIMIT 1
        `
    );

    if (!roles.length) {
        throw new Error('ADMIN role not found');
    }

    await queryInterface.sequelize.query(
        `
        INSERT INTO user_roles (
            uuid,
            user_id,
            role_id,
            created_at,
            updated_at
        )
        VALUES (
            :uuid,
            :userId,
            :roleId,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, role_id)
        DO NOTHING
        `,
        {
            replacements: {
                uuid: randomUUID(),
                userId: adminUserId,
                roleId: roles[0].id,
            },
        }
    );
}

export async function down(queryInterface) {
    const [users] = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM users
            WHERE username = 'admin'
                LIMIT 1
        `
    );

    if (!users.length) {
        return;
    }

    const userId = users[0].id;

    await queryInterface.bulkDelete('user_roles', {
        user_id: userId,
    });

    await queryInterface.bulkDelete('users', {
        id: userId,
    });
}