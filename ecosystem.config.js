# ecosystem.config.js — PM2 process manager config
module.exports = {
    apps: [
        {
            name: 'jirabot',
            script: 'server.js',
            instances: 1,           // SQLite không hỗ trợ multi-instance
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            // Rotate logs
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-error.log',
            merge_logs: true
        }
    ]
};
