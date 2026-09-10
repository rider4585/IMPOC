export async function up(queryInterface) {
    const upiAccounts = [
        // Placeholder VPA — replace with the shop's real UPI id via Picklists > UPI accounts.
        ['Shop UPI (placeholder)', 'shree.placeholder@okhdfcbank', true],
    ];

    for (const [label, vpa, isActive] of upiAccounts) {
        await queryInterface.sequelize.query(
            `
                INSERT INTO upi_accounts (
                    label,
                    vpa,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    :label,
                    :vpa,
                    :isActive,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (label) WHERE deleted_at IS NULL AND is_active = true
                DO NOTHING
            `,
            {
                replacements: {
                    label,
                    vpa,
                    isActive,
                },
            }
        );
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('upi_accounts', {
        label: ['Shop UPI (placeholder)'],
    });
}
