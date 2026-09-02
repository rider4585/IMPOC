import { sequelize } from './database/models/index.js';

async function check() {
    try {
        const result = await sequelize.query(
            'SELECT key, value_text, value_int FROM app_settings WHERE key LIKE \'barcode_%\' ORDER BY key'
        );
        
        console.log('Geometry settings in database:');
        if (result[0].length === 0) {
            console.log('❌ NO geometry settings found!');
        } else {
            result[0].forEach(row => {
                const value = row.value_text || row.value_int;
                console.log(`✓ ${row.key}: ${value}`);
            });
        }
    } catch (error) {
        console.error('Error querying database:', error.message);
    } finally {
        await sequelize.close();
    }
}

check();
