const { db } = require('../db');

const PUBLIC_PATHS = ['/login.html', '/docx.bundle.js', '/favicon.ico'];
const PUBLIC_API_PREFIXES = ['/api/login', '/api/register'];
// Static build assets (Vite output: JS/CSS/fonts) must be reachable before login,
// otherwise the unauthenticated login page can't load its bundles. These files are
// not sensitive — actual data stays gated behind the authenticated /api routes.
const PUBLIC_PATH_PREFIXES = ['/assets/'];

// Cookie parser middleware
function parseCookies(req, res, next) {
    req.cookies = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            req.cookies[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    next();
}

// Caching prevention middleware
function disableCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}

// Authentication check
function requireAuth(req, res, next) {
    if (
        PUBLIC_PATHS.includes(req.path) ||
        PUBLIC_PATH_PREFIXES.some(p => req.path.startsWith(p)) ||
        PUBLIC_API_PREFIXES.some(p => req.path.startsWith(p))
    ) {
        return next();
    }
    const userId = req.cookies.user_id;
    if (!userId) {
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        return res.redirect('/login.html');
    }
    try {
        const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
        if (!user) {
            res.clearCookie('user_id');
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'unauthorized' });
            }
            return res.redirect('/login.html');
        }
        req.user = user;
        next();
    } catch (e) {
        console.error('Lỗi xác thực:', e.message);
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(500).json({ error: 'Lỗi xác thực hệ thống' });
        }
        return res.redirect('/login.html');
    }
}

// Admin permission check
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
}

module.exports = {
    parseCookies,
    disableCache,
    requireAuth,
    requireAdmin
};
