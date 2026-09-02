import 'dotenv/config';

const requireTestDatabase = () => {
    const testDatabase = process.env.DB_NAME_TEST;

    if (!testDatabase) {
        throw new Error(
            'Missing required environment variable: DB_NAME_TEST. ' +
            'The test suite drops every table in the database it connects to, ' +
            'so it must target a dedicated test database (see .env.example).'
        );
    }

    if (testDatabase === process.env.DB_NAME) {
        throw new Error(
            'DB_NAME_TEST must not equal DB_NAME. The test suite drops every ' +
            'table in the database it connects to, which would destroy ' +
            'development data.'
        );
    }

    return testDatabase;
};

export default {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
    },

    /*
     * The test suite runs sequelize.sync({ force: true }), which DROPS every
     * table in the target database. Falling back to DB_NAME here would point
     * that at the development database and wipe it, so a missing or
     * dev-matching DB_NAME_TEST is a hard failure instead.
     */
    test: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        get database() {
            return requireTestDatabase();
        },
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
    },

    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
    },
};