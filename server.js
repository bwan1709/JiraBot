require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const { PORT, DATA_DIR, PUBLIC_DIR } = require('./src/config');
const { initDb } = require('./src/db');
const { parseCookies, disableCache, requireAuth } = require('./src/middlewares/auth');

const authRoutes = require('./src/routes/auth.routes');
const jiraRoutes = require('./src/routes/jira.routes');
const noteRoutes = require('./src/routes/note.routes');
const markdownRoutes = require('./src/routes/markdown.routes');

const app = express();

// Apply global middlewares
app.use(parseCookies);
app.use(disableCache);
app.use(requireAuth);
app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Bind routes
app.use('/api', authRoutes);
app.use('/api', jiraRoutes);
app.use('/api', noteRoutes);
app.use('/api', markdownRoutes);

// SPA history fallback: any authenticated GET that isn't an /api call or a real
// static file is handled by the React app (react-router). requireAuth already
// redirected unauthenticated requests to /login.html before reaching here.
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

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
