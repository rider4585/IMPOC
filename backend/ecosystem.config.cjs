// pm2 process file for the production laptop. `.cjs` because the backend is
// `type: module` and pm2 loads this with require().
//
//   pm2 start ecosystem.config.cjs && pm2 save
//
// Values in backend/.env (DB creds, JWT secrets, FRONTEND_ORIGIN, ...) are read
// by dotenv inside the app; only process-level settings live here.
module.exports = {
    apps: [
        {
            name: 'impoc',
            script: 'server.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 20,
            restart_delay: 3000,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
            },
            out_file: './logs/impoc-out.log',
            error_file: './logs/impoc-error.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            time: true,
        },
    ],
};
