require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;

const { PORT, DATA_DIR, PUBLIC_DIR } = require('./src/config');
const { initDb } = require('./src/db');
const { parseCookies, disableCache, requireAuth } = require('./src/middlewares/auth');

const authRoutes = require('./src/routes/auth.routes');
const jiraRoutes = require('./src/routes/jira.routes');

const app = express();

// Apply global middlewares
app.use(parseCookies);
app.use(disableCache);
app.use(requireAuth);
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// Bind routes
app.use('/api', authRoutes);
app.use('/api', jiraRoutes);

async function start() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    initDb();
    app.listen(PORT, () => {
        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║   🚀 JiraBot Time Report Server          ║');
        console.log(`║   http://localhost:${PORT}                   ║`);
        console.log('╚══════════════════════════════════════════╝\n');
        if (!process.env.ATLASSIAN_TOKEN || process.env.ATLASSIAN_TOKEN === 'YOUR_API_TOKEN_HERE') {
            console.log('⚠️  Chưa cấu hình API token trong .env!');
            console.log('   Truy cập: https://id.atlassian.com/manage-profile/security/api-tokens\n');
        }
    });
}

start();
