export async function up(queryInterface) {
    const expenseTypes = [
        ['Rent', true],
        ['Travel', true],
        ['Food', true],
        ['Misc', true],
    ];

    for (const [name, isActive] of expenseTypes) {
        await queryInterface.sequelize.query(
            `
                INSERT INTO expense_types (
                    name,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    :name,
                    :isActive,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (name) WHERE deleted_at IS NULL AND is_active = true
                DO NOTHING
            `,
            {
                replacements: {
                    name,
                    isActive,
                },
            }
        );
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('expense_types', {
        name: ['Rent', 'Travel', 'Food', 'Misc'],
    });
}
