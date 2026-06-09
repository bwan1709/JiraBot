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

// Dynamic meta injection for shared notes
app.get('/share/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { getNote } = require('./src/db');
        const note = getNote(id);
        
        let html = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
        if (note) {
            const title = note.title || 'Ghi chú nhanh';
            const desc = note.content ? note.content.slice(0, 160).replace(/\r?\n/g, ' ') : 'Ghi chú trực tuyến tự hủy trong 24 giờ.';
            
            const cleanTitle = title.replace(/"/g, '&quot;');
            const cleanDesc = desc.replace(/"/g, '&quot;');

            const metaTags = `
  <title>Ghi chú: ${cleanTitle}</title>
  <meta name="description" content="${cleanDesc}" />
  <meta property="og:title" content="Ghi chú: ${cleanTitle}" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Ghi chú: ${cleanTitle}" />
  <meta name="twitter:description" content="${cleanDesc}" />
            `;
            
            if (html.includes('<title>')) {
                html = html.replace(/<title>.*?<\/title>/, metaTags);
            } else {
                html = html.replace('</head>', `${metaTags}\n</head>`);
            }
        }
        res.send(html);
    } catch (err) {
        console.error('Lỗi render shared note meta:', err);
        res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }
});

// Dynamic meta injection for shared markdowns
app.get('/share-md/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { getMarkdown } = require('./src/db');
        const md = getMarkdown(id);
        
        let html = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
        if (md) {
            const title = md.title || 'Tài liệu Markdown';
            const desc = md.content ? md.content.slice(0, 160).replace(/\r?\n/g, ' ') : 'Tài liệu Markdown trực tuyến tự hủy trong 24 giờ.';
            
            const cleanTitle = title.replace(/"/g, '&quot;');
            const cleanDesc = desc.replace(/"/g, '&quot;');

            const metaTags = `
  <title>Tài liệu: ${cleanTitle}</title>
  <meta name="description" content="${cleanDesc}" />
  <meta property="og:title" content="Tài liệu: ${cleanTitle}" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Tài liệu: ${cleanTitle}" />
  <meta name="twitter:description" content="${cleanDesc}" />
            `;
            
            if (html.includes('<title>')) {
                html = html.replace(/<title>.*?<\/title>/, metaTags);
            } else {
                html = html.replace('</head>', `${metaTags}\n</head>`);
            }
        }
        res.send(html);
    } catch (err) {
        console.error('Lỗi render shared markdown meta:', err);
        res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }
});

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
