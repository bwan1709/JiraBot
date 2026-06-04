require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR    = path.join(__dirname, 'data');
const DB_PATH     = path.join(DATA_DIR, 'jirabot.db');
const PUBLIC_DIR  = path.join(__dirname, 'public');

// Parse cookies middleware
app.use((req, res, next) => {
    req.cookies = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            req.cookies[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    next();
});

// Middleware to disable caching for API endpoints and static assets in dev
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const PUBLIC_PATHS = ['/login.html', '/docx.bundle.js', '/favicon.ico'];
const PUBLIC_API_PREFIXES = ['/api/login', '/api/register'];

function requireAuth(req, res, next) {
    if (PUBLIC_PATHS.includes(req.path) || PUBLIC_API_PREFIXES.some(p => req.path.startsWith(p))) {
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

app.use(requireAuth);
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// ─── Helpers ───────────────────────────────────────────────────────────────

function getAuthHeader(user) {
    return `Basic ${Buffer.from(`${user.email}:${user.token}`).toString('base64')}`;
}

async function jiraGet(user, endpoint) {
    const userJiraApi = `https://api.atlassian.com/ex/jira/${user.cloud_id}/rest/api/3`;
    const url = endpoint.startsWith('http') ? endpoint : `${userJiraApi}${endpoint}`;
    const res = await fetch(url, {
        headers: { 'Authorization': getAuthHeader(user), 'Accept': 'application/json' }
    });
    if (!res.ok) {
        if (res.status === 401) {
            throw new Error('JIRA_401');
        }
        const txt = await res.text();
        throw new Error(`Jira API ${res.status}: ${txt.substring(0, 200)}`);
    }
    return res.json();
}

async function jiraPost(user, endpoint, body) {
    const userJiraApi = `https://api.atlassian.com/ex/jira/${user.cloud_id}/rest/api/3`;
    const url = endpoint.startsWith('http') ? endpoint : `${userJiraApi}${endpoint}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 
            'Authorization': getAuthHeader(user), 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        if (res.status === 401) {
            throw new Error('JIRA_401');
        }
        const txt = await res.text();
        throw new Error(`Jira API ${res.status}: ${txt.substring(0, 200)}`);
    }
    return res.status === 204 ? {} : res.json();
}

async function jiraPut(user, endpoint, body) {
    const userJiraApi = `https://api.atlassian.com/ex/jira/${user.cloud_id}/rest/api/3`;
    const url = endpoint.startsWith('http') ? endpoint : `${userJiraApi}${endpoint}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 
            'Authorization': getAuthHeader(user), 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        if (res.status === 401) {
            throw new Error('JIRA_401');
        }
        const txt = await res.text();
        throw new Error(`Jira API ${res.status}: ${txt.substring(0, 200)}`);
    }
    return res.status === 204 ? {} : res.json();
}

function makeAdfComment(text) {
    if (!text) return undefined;
    return {
        type: "doc",
        version: 1,
        content: [
            {
                type: "paragraph",
                content: [
                    {
                        text: text,
                        type: "text"
                    }
                ]
            }
        ]
    };
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate(); // month is 1-based
}

// Returns all working days (Mon-Sat) in a month
function buildWorkingDays(year, month) {
    const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const days = [];
    const total = getDaysInMonth(year, month);
    for (let d = 1; d <= total; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay(); // 0=Sun
        if (dow === 0) continue;  // skip Sunday
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        days.push({
            date: dateStr,
            day_label: `${pad(d)}\n${DAY_NAMES[dow]}`,
            day_name: DAY_NAMES[dow],
            dow,
            is_saturday: dow === 6,
            standard: dow === 6 ? 4 : 8,
            logged: 0
        });
    }
    return days;
}

function pad(n) { return String(n).padStart(2, '0'); }
function secToH(s) { return Math.round((s / 3600) * 100) / 100; }

function fmtH(h) {
    if (h === 0) return '0h';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

const MONTH_NAMES_VI = ['', 'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
    'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

// ─── SQLite Database ───────────────────────────────────────────────────────

let db;

function initDb() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better concurrent read performance

    // Check if users table exists. If not, old database schemas are present and need migration.
    const hasUsersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (!hasUsersTable) {
        console.log('  ⚠️  Old database schema detected. Dropping old tables for migration...');
        db.exec(`
            DROP TABLE IF EXISTS tasks;
            DROP TABLE IF EXISTS working_days;
            DROP TABLE IF EXISTS months;
        `);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL DEFAULT 'ilovecds',
            token       TEXT NOT NULL,
            cloud_id    TEXT NOT NULL,
            account_id  TEXT NOT NULL,
            base_url    TEXT NOT NULL,
            full_name   TEXT,
            role        TEXT,
            department  TEXT,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS months (
            user_id           INTEGER NOT NULL,
            year_month        TEXT NOT NULL,
            month             INTEGER NOT NULL,
            year              INTEGER NOT NULL,
            month_label       TEXT,
            standard_hours    REAL DEFAULT 0,
            total_logged      REAL DEFAULT 0,
            required_to_date  REAL DEFAULT 0,
            logged_to_date    REAL DEFAULT 0,
            net_to_date       REAL DEFAULT 0,
            progress_pct      REAL DEFAULT 0,
            task_count        INTEGER DEFAULT 0,
            in_progress_count INTEGER DEFAULT 0,
            todo_count        INTEGER DEFAULT 0,
            no_worklog_count  INTEGER DEFAULT 0,
            last_updated      TEXT,
            today             TEXT,
            PRIMARY KEY (user_id, year_month),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tasks (
            user_id            INTEGER NOT NULL,
            key                TEXT NOT NULL,
            year_month         TEXT NOT NULL,
            task_type          TEXT NOT NULL,
            summary            TEXT,
            project            TEXT,
            project_key        TEXT,
            issue_type         TEXT,
            status             TEXT,
            resolved_date      TEXT,
            parent_key         TEXT,
            time_spent_hours   REAL DEFAULT 0,
            time_spent_display TEXT,
            has_worklog        INTEGER DEFAULT 0,
            url                TEXT,
            original_estimate  INTEGER,
            actual_start       TEXT,
            actual_end         TEXT,
            labels             TEXT,
            duedate            TEXT,
            start_date         TEXT,
            story_points       REAL,
            missing_fields     TEXT,
            created            TEXT,
            PRIMARY KEY (user_id, key, year_month),
            FOREIGN KEY (user_id, year_month) REFERENCES months(user_id, year_month) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS working_days (
            user_id      INTEGER NOT NULL,
            year_month   TEXT NOT NULL,
            date         TEXT NOT NULL,
            day_label    TEXT,
            day_name     TEXT,
            dow          INTEGER,
            is_saturday  INTEGER DEFAULT 0,
            standard     REAL DEFAULT 0,
            logged       REAL DEFAULT 0,
            PRIMARY KEY (user_id, year_month, date),
            FOREIGN KEY (user_id, year_month) REFERENCES months(user_id, year_month) ON DELETE CASCADE
        );
    `);

    // Seed default admin user from .env if table is empty
    const defaultEmail    = process.env.ADMIN_EMAIL    || 'admin@jirabot.local';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'ilovecds';
    const defaultFullName = process.env.ADMIN_FULLNAME || 'Administrator';
    const defaultDept     = process.env.ADMIN_DEPARTMENT || '';
    const defaultToken    = process.env.ATLASSIAN_TOKEN    || '';
    const defaultCloudId  = process.env.ATLASSIAN_CLOUD_ID || '';
    const defaultAccId    = process.env.ATLASSIAN_ACCOUNT_ID || '';
    const defaultBaseUrl  = process.env.ATLASSIAN_BASE_URL || '';

    const count = db.prepare('SELECT count(*) as c FROM users').get().c;
    if (count === 0) {
        db.prepare(`
            INSERT INTO users (email, password, token, cloud_id, account_id, base_url, full_name, role, department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            defaultEmail,
            defaultPassword,
            defaultToken,
            defaultCloudId,
            defaultAccId,
            defaultBaseUrl,
            defaultFullName,
            'admin',
            defaultDept,
            new Date().toISOString()
        );
        console.log('  👤 Seeded default admin:', defaultEmail);
    } else {
        // Ensure the designated admin email always has admin role
        db.prepare(`UPDATE users SET role = 'admin' WHERE email = ?`).run(defaultEmail);
    }

    console.log('  💾 SQLite DB initialized:', DB_PATH);
}

// Save full month data (upsert) using a single transaction bound to user_id
function saveMonthData(userId, result) {
    const upsertMonth = db.prepare(`
        INSERT OR REPLACE INTO months
            (user_id, year_month, month, year, month_label, standard_hours, total_logged,
             required_to_date, logged_to_date, net_to_date, progress_pct,
             task_count, in_progress_count, todo_count, no_worklog_count,
             last_updated, today)
        VALUES
            (@user_id, @year_month, @month, @year, @month_label, @standard_hours, @total_logged,
             @required_to_date, @logged_to_date, @net_to_date, @progress_pct,
             @task_count, @in_progress_count, @todo_count, @no_worklog_count,
             @last_updated, @today)
    `);

    const upsertTask = db.prepare(`
        INSERT OR REPLACE INTO tasks
            (user_id, key, year_month, task_type, summary, project, project_key, issue_type,
             status, resolved_date, parent_key, time_spent_hours, time_spent_display,
             has_worklog, url, original_estimate, actual_start, actual_end,
             labels, duedate, start_date, story_points, missing_fields, created)
        VALUES
            (@user_id, @key, @year_month, @task_type, @summary, @project, @project_key, @issue_type,
             @status, @resolved_date, @parent_key, @time_spent_hours, @time_spent_display,
             @has_worklog, @url, @original_estimate, @actual_start, @actual_end,
             @labels, @duedate, @start_date, @story_points, @missing_fields, @created)
    `);

    const upsertDay = db.prepare(`
        INSERT OR REPLACE INTO working_days
            (user_id, year_month, date, day_label, day_name, dow, is_saturday, standard, logged)
        VALUES
            (@user_id, @year_month, @date, @day_label, @day_name, @dow, @is_saturday, @standard, @logged)
    `);

    const deleteTasks = db.prepare(`DELETE FROM tasks WHERE user_id = ? AND year_month = ?`);
    const deleteDays  = db.prepare(`DELETE FROM working_days WHERE user_id = ? AND year_month = ?`);

    const runAll = db.transaction((r) => {
        // Upsert month summary
        upsertMonth.run({
            user_id:           userId,
            year_month:        r.year_month,
            month:             r.month,
            year:              r.year,
            month_label:       r.month_label,
            standard_hours:    r.standard_hours,
            total_logged:      r.total_logged,
            required_to_date:  r.required_to_date,
            logged_to_date:    r.logged_to_date,
            net_to_date:       r.net_to_date,
            progress_pct:      r.progress_pct,
            task_count:        r.task_count,
            in_progress_count: r.in_progress_count,
            todo_count:        r.todo_count,
            no_worklog_count:  r.no_worklog_count,
            last_updated:      r.last_updated,
            today:             r.today
        });

        // Replace tasks (delete then insert to handle removed tasks)
        deleteTasks.run(userId, r.year_month);
        const taskToRow = (t, type) => ({
            user_id:            userId,
            key:                t.key,
            year_month:         r.year_month,
            task_type:          type,
            summary:            t.summary,
            project:            t.project,
            project_key:        t.project_key,
            issue_type:         t.issue_type,
            status:             t.status,
            resolved_date:      t.resolved_date    || null,
            parent_key:         t.parent_key        || null,
            time_spent_hours:   t.time_spent_hours,
            time_spent_display: t.time_spent_display || null,
            has_worklog:        t.has_worklog ? 1 : 0,
            url:                t.url,
            original_estimate:  t.original_estimate || null,
            actual_start:       t.actual_start      || null,
            actual_end:         t.actual_end        || null,
            labels:             JSON.stringify(t.labels || []),
            duedate:            t.duedate            || null,
            start_date:         t.start_date         || null,
            story_points:       t.story_points != null ? t.story_points : null,
            missing_fields:     JSON.stringify(t.missing_fields || []),
            created:            t.created            || null,
        });
        r.tasks.forEach(t => upsertTask.run(taskToRow(t, 'done')));
        r.in_progress_tasks.forEach(t => upsertTask.run(taskToRow(t, 'in_progress')));
        r.todo_tasks.forEach(t => upsertTask.run(taskToRow(t, 'todo')));

        // Replace working days
        deleteDays.run(userId, r.year_month);
        r.working_days.forEach(d => upsertDay.run({
            user_id:     userId,
            year_month:  r.year_month,
            date:        d.date,
            day_label:   d.day_label,
            day_name:    d.day_name,
            dow:         d.dow,
            is_saturday: d.is_saturday ? 1 : 0,
            standard:    d.standard,
            logged:      d.logged
        }));
    });

    runAll(result);
}

// Reconstruct full result object from DB contextually based on user_id
function loadMonthData(userId, ym) {
    const meta = db.prepare(`SELECT * FROM months WHERE user_id = ? AND year_month = ?`).get(userId, ym);
    if (!meta) return null;

    const rowToTask = (row) => ({
        key:                row.key,
        summary:            row.summary,
        project:            row.project,
        project_key:        row.project_key,
        issue_type:         row.issue_type,
        status:             row.status,
        resolved_date:      row.resolved_date,
        parent_key:         row.parent_key,
        time_spent_hours:   row.time_spent_hours,
        time_spent_display: row.time_spent_display,
        has_worklog:        row.has_worklog === 1,
        url:                row.url,
        original_estimate:  row.original_estimate,
        actual_start:       row.actual_start,
        actual_end:         row.actual_end,
        labels:             JSON.parse(row.labels || '[]'),
        duedate:            row.duedate,
        start_date:         row.start_date,
        story_points:       row.story_points,
        missing_fields:     JSON.parse(row.missing_fields || '[]'),
        created:            row.created
    });

    const tasks           = db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND year_month = ? AND task_type = 'done' ORDER BY resolved_date DESC`).all(userId, ym).map(rowToTask);
    const in_progress_tasks = db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND year_month = ? AND task_type = 'in_progress' ORDER BY key`).all(userId, ym).map(rowToTask);
    const todo_tasks      = db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND year_month = ? AND task_type = 'todo' ORDER BY key`).all(userId, ym).map(rowToTask);
    const working_days    = db.prepare(`SELECT * FROM working_days WHERE user_id = ? AND year_month = ? ORDER BY date`).all(userId, ym).map(row => ({
        date:        row.date,
        day_label:   row.day_label,
        day_name:    row.day_name,
        dow:         row.dow,
        is_saturday: row.is_saturday === 1,
        standard:    row.standard,
        logged:      row.logged
    }));

    return {
        month:             meta.month,
        year:              meta.year,
        year_month:        meta.year_month,
        month_label:       meta.month_label,
        standard_hours:    meta.standard_hours,
        total_logged:      meta.total_logged,
        required_to_date:  meta.required_to_date,
        logged_to_date:    meta.logged_to_date,
        net_to_date:       meta.net_to_date,
        progress_pct:      meta.progress_pct,
        task_count:        meta.task_count,
        in_progress_count: meta.in_progress_count,
        todo_count:        meta.todo_count,
        no_worklog_count:  meta.no_worklog_count,
        last_updated:      meta.last_updated,
        today:             meta.today,
        tasks,
        in_progress_tasks,
        todo_tasks,
        working_days
    };
}

// ─── Jira Fetch Helpers ────────────────────────────────────────────────────

// Fetch one page contextually for a user
async function fetchPage(user, jql, fields, nextPageToken = null, maxResults = 100) {
    const params = { jql, fields, maxResults: String(maxResults) };
    if (nextPageToken) {
        params.nextPageToken = nextPageToken;
    }
    const q = new URLSearchParams(params);
    return jiraGet(user, `/search/jql?${q}`);
}

// Fetch all pages contextually for a user
async function searchAll(user, jql, fields) {
    const results = [];
    let nextPageToken = null;
    let isLast = false;

    while (!isLast) {
        const page = await fetchPage(user, jql, fields, nextPageToken);
        if (page.issues && page.issues.length > 0) {
            results.push(...page.issues);
        }
        nextPageToken = page.nextPageToken;
        isLast = page.isLast === true || !page.nextPageToken;
    }

    return results;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// ─── Authentication & User Routes ──────────────────────────────────────────

// POST /api/login — Login handler
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ email và mật khẩu.' });
        }
        const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
        }

        // Set httpOnly session cookie
        res.cookie('user_id', user.id.toString(), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                department: user.department
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/register — Register new account (email + password only)
app.post('/api/register', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ email và mật khẩu.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(400).json({ error: 'Email này đã được đăng ký trong hệ thống.' });
        }

        // Create user with empty Jira credentials — to be filled via profile settings
        const info = db.prepare(`
            INSERT INTO users (email, password, token, cloud_id, account_id, base_url, full_name, role, department, created_at)
            VALUES (?, ?, '', '', '', '', ?, 'client', '', ?)
        `).run(email, password, email.split('@')[0], new Date().toISOString());

        // Auto login
        res.cookie('user_id', info.lastInsertRowid.toString(), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
        res.json({ success: true, message: 'Đăng ký thành công! Vui lòng cập nhật thông tin Jira trong mục Cài đặt.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/logout — Logout handler
app.post('/api/logout', (req, res) => {
    res.clearCookie('user_id');
    res.json({ success: true });
});

// GET /api/me — Get profile of currently logged-in user
app.get('/api/me', (req, res) => {
    const full = req.query.full === '1';
    const u = req.user;
    const payload = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
        base_url: u.base_url
    };
    if (full) {
        payload.token = u.token || '';
        payload.account_id = u.account_id || '';
        payload.cloud_id = u.cloud_id || '';
        payload.email_jira = u.email || ''; // email is also used for Jira auth
    }
    res.json({ user: payload });
});

// PUT /api/profile — Update own profile (any authenticated user)
app.put('/api/profile', (req, res) => {
    try {
        const { full_name, department, email_jira, token, account_id, cloud_id, base_url, password } = req.body;

        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập Họ & Tên.' });
        }
        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }

        // Build update fields
        const fields = {
            full_name: full_name.trim(),
            department: (department || '').trim(),
            token: (token || '').trim(),
            account_id: (account_id || '').trim(),
            cloud_id: (cloud_id || '').trim(),
            base_url: (base_url || '').trim()
        };
        if (password) fields.password = password;

        const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const values = Object.values(fields);
        values.push(req.user.id);

        db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper middleware for admin-only endpoints
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
}

// GET /api/users — List all users (Admin only)
app.get('/api/users', requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`SELECT id, email, token, cloud_id, account_id, base_url, full_name, role, department, created_at FROM users ORDER BY id ASC`).all();
        res.json({ users });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/users — Create new user (Admin only)
app.post('/api/users', requireAdmin, (req, res) => {
    try {
        const { email, password, token, cloud_id, account_id, base_url, full_name, role, department } = req.body;
        if (!email || !token || !cloud_id || !account_id || !base_url) {
            return res.status(400).json({ error: 'Thiếu các thông tin bắt buộc (email, token, cloud_id, account_id, base_url)' });
        }

        const pwd = password || 'ilovecds';
        const userRole = role || 'client';

        const info = db.prepare(`
            INSERT INTO users (email, password, token, cloud_id, account_id, base_url, full_name, role, department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(email, pwd, token, cloud_id, account_id, base_url, full_name || null, userRole, department || null, new Date().toISOString());

        res.json({ success: true, userId: info.lastInsertRowId });
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/users/:id — Edit user details (Admin only)
app.put('/api/users/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, token, cloud_id, account_id, base_url, full_name, role, department } = req.body;
        if (!email || !token || !cloud_id || !account_id || !base_url) {
            return res.status(400).json({ error: 'Thiếu các thông tin bắt buộc' });
        }

        const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        }

        // Handle password update: if not provided or empty, keep existing password
        const pwd = (password && password.trim() !== '') ? password : existing.password;
        const userRole = role || existing.role;

        db.prepare(`
            UPDATE users 
            SET email = ?, password = ?, token = ?, cloud_id = ?, account_id = ?, base_url = ?, full_name = ?, role = ?, department = ?
            WHERE id = ?
        `).run(email, pwd, token, cloud_id, account_id, base_url, full_name || null, userRole, department || null, id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/users/:id — Delete user (Admin only)
app.delete('/api/users/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình.' });
        }

        const count = db.prepare('SELECT count(*) as c FROM users').get().c;
        if (count <= 1) {
            return res.status(400).json({ error: 'Không thể xóa người dùng cuối cùng của hệ thống.' });
        }

        db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Jira Dashboard & Operations Routes ────────────────────────────────────

// GET /api/months — list available months from DB
app.get('/api/months', (req, res) => {
    try {
        const rows = db.prepare(`SELECT year_month FROM months WHERE user_id = ? ORDER BY year_month DESC`).all(req.user.id);
        res.json({ months: rows.map(r => r.year_month) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/data/:yearMonth — load data from DB
app.get('/api/data/:yearMonth', (req, res) => {
    try {
        const data = loadMonthData(req.user.id, req.params.yearMonth);
        if (!data) return res.status(404).json({ error: 'no_data' });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/refresh/:yearMonth — fetch fresh data from Jira and save to DB
app.post('/api/refresh/:yearMonth', async (req, res) => {
    try {
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.status(400).json({ error: 'JIRA_MISSING_INFO' });
        }

        const [yearStr, monthStr] = req.params.yearMonth.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        if (!year || !month || month < 1 || month > 12) {
            throw new Error('Tháng không hợp lệ. Định dạng: YYYY-MM (vd: 2026-06)');
        }

        const startDate = `${year}-${pad(month)}-01`;
        const endDate   = `${year}-${pad(month)}-${getDaysInMonth(year, month)}`;
        const d_today   = new Date();
        const today     = `${d_today.getFullYear()}-${pad(d_today.getMonth() + 1)}-${pad(d_today.getDate())}`;

        console.log(`\n📡 Đang tải dữ liệu cho ${req.user.full_name} (${MONTH_NAMES_VI[month]}/${year})...`);
        const t0 = Date.now();

        // ── Chạy song song 4 queries ──────────────────────────────────────
        const WL_FIELDS   = 'summary,worklog,issuetype,project,status,customfield_10009';
        const DONE_FIELDS = 'summary,status,worklog,issuetype,project,resolutiondate,timeoriginalestimate,customfield_10008,customfield_10009,labels,duedate,customfield_10015,customfield_10016,parent,created';

        const [wlIssues, doneIssues, inProgressIssues, todoIssues] = await Promise.all([
            searchAll(
                req.user,
                `worklogAuthor = '${req.user.account_id}' AND ((cf[10009] >= '${startDate}' AND cf[10009] <= '${endDate}') OR (cf[10009] is empty AND worklogDate >= '${startDate}' AND worklogDate <= '${endDate}'))`,
                WL_FIELDS
            ),
            searchAll(
                req.user,
                `assignee = '${req.user.account_id}' AND status = Done AND cf[10009] >= '${startDate}' AND cf[10009] <= '${endDate}'`,
                DONE_FIELDS
            ),
            searchAll(
                req.user,
                `assignee = '${req.user.account_id}' AND status = 'In Progress' AND status != CANCELLED`,
                DONE_FIELDS
            ),
            searchAll(
                req.user,
                `assignee = '${req.user.account_id}' AND status = 'To Do' AND status != CANCELLED`,
                DONE_FIELDS
            )
        ]);

        console.log(`  → Jira trả về: ${wlIssues.length} worklog issues, ${doneIssues.length} done tasks, ${inProgressIssues.length} in-progress tasks (${Date.now() - t0}ms)`);

        // ── Build daily hours map từ worklog issues ────────────────────────
        const wdList = buildWorkingDays(year, month);
        const dailySecMap = {};
        wdList.forEach(d => { dailySecMap[d.date] = 0; });

        wlIssues.forEach(issue => {
            const actualEnd = issue.fields.customfield_10009 || null;
            const wls = issue.fields.worklog?.worklogs || [];
            wls.forEach(wl => {
                if (wl.author.accountId !== req.user.account_id) return;
                
                let targetDateStr;
                if (actualEnd) {
                    // Task có actualEnd, quy thuộc worklog về tháng của actualEnd
                    const wlDate = new Date(wl.started);
                    const logDate = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
                    
                    const aeDate = new Date(actualEnd);
                    const aeMonthStr = `${aeDate.getFullYear()}-${pad(aeDate.getMonth() + 1)}`;
                    const wlMonthStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}`;
                    
                    if (wlMonthStr === aeMonthStr) {
                        // Nếu cùng tháng, giữ nguyên ngày của worklog
                        targetDateStr = logDate;
                    } else {
                        // Nếu lệch tháng (ví dụ log muộn ở tháng sau), quy về ngày actualEnd của task đó
                        let targetDate = new Date(actualEnd);
                        // Nếu ngày actualEnd trùng vào Chủ Nhật (không có trong calendar làm việc), lùi về Thứ Bảy gần nhất hoặc tiến lên Thứ Hai
                        if (targetDate.getDay() === 0) {
                            const prevDay = new Date(targetDate);
                            prevDay.setDate(targetDate.getDate() - 1);
                            if (prevDay.getMonth() === targetDate.getMonth()) {
                                targetDate = prevDay;
                            } else {
                                const nextDay = new Date(targetDate);
                                nextDay.setDate(targetDate.getDate() + 1);
                                targetDate = nextDay;
                            }
                        }
                        targetDateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
                    }
                } else {
                    // Task chưa có actualEnd (đang in-progress/todo), dùng ngày của worklog
                    const wlDate = new Date(wl.started);
                    targetDateStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
                }

                if (targetDateStr >= startDate && targetDateStr <= endDate && dailySecMap[targetDateStr] !== undefined) {
                     dailySecMap[targetDateStr] += wl.timeSpentSeconds;
                }
            });
        });

        // ── Process done tasks ─────────────────────────────────────────────
        const tasks = doneIssues.map(issue => {
            const allWls = issue.fields.worklog?.worklogs || [];
            const userWls = allWls.filter(w => w.author.accountId === req.user.account_id);
            const totalSec = userWls.reduce((s, w) => s + w.timeSpentSeconds, 0);
            let resolvedDate = null;
            if (issue.fields.resolutiondate) {
                const resDate = new Date(issue.fields.resolutiondate);
                resolvedDate = `${resDate.getFullYear()}-${pad(resDate.getMonth() + 1)}-${pad(resDate.getDate())}`;
            }

            const originalEstimate = issue.fields.timeoriginalestimate || null;
            const actualStart = issue.fields.customfield_10008 || null;
            const actualEnd = issue.fields.customfield_10009 || null;
            const labels = issue.fields.labels || [];
            const duedate = issue.fields.duedate || null;
            const startDateField = issue.fields.customfield_10015 || null;
            const storyPoints = issue.fields.customfield_10016 || null;
            const parentKey = issue.fields.parent ? issue.fields.parent.key : null;

            const missingFields = [];
            if (!originalEstimate) missingFields.push('Original estimate');
            if (!actualStart) missingFields.push('Actual start');
            if (!actualEnd) missingFields.push('Actual end');
            if (userWls.length === 0) missingFields.push('Time tracking (Worklog)');
            if (labels.length === 0) missingFields.push('Labels');
            if (!duedate) missingFields.push('Due date');
            if (!startDateField) missingFields.push('Start date');
            if (storyPoints === null || storyPoints === undefined) missingFields.push('Story point estimate');
            if (issue.fields.issuetype.subtask && !parentKey) missingFields.push('Parent task');

            return {
                key: issue.key,
                summary: issue.fields.summary,
                project: issue.fields.project.name,
                project_key: issue.fields.project.key,
                issue_type: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                resolved_date: resolvedDate,
                parent_key: parentKey,
                time_spent_hours: secToH(totalSec),
                time_spent_display: totalSec > 0 ? fmtH(secToH(totalSec)) : null,
                has_worklog: userWls.length > 0,
                url: `${req.user.base_url}/browse/${issue.key}`,
                original_estimate: originalEstimate,
                actual_start: actualStart,
                actual_end: actualEnd,
                labels,
                duedate,
                start_date: startDateField,
                story_points: storyPoints,
                missing_fields: missingFields,
                created: issue.fields.created
            };
        }).sort((a, b) => (b.resolved_date || '').localeCompare(a.resolved_date || ''));

        // ── Process in-progress tasks ──────────────────────────────────────
        const inProgressTasks = inProgressIssues.filter(issue => {
            const created = issue.fields.created;
            if (!created) return false;
            return created.substring(0, 7) === req.params.yearMonth;
        }).map(issue => {
            const allWls = issue.fields.worklog?.worklogs || [];
            const userWls = allWls.filter(w => w.author.accountId === req.user.account_id);
            const totalSec = userWls.reduce((s, w) => s + w.timeSpentSeconds, 0);

            return {
                key: issue.key,
                summary: issue.fields.summary,
                project: issue.fields.project.name,
                project_key: issue.fields.project.key,
                issue_type: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                time_spent_hours: secToH(totalSec),
                time_spent_display: totalSec > 0 ? fmtH(secToH(totalSec)) : null,
                has_worklog: userWls.length > 0,
                url: `${req.user.base_url}/browse/${issue.key}`,
                original_estimate: issue.fields.timeoriginalestimate || null,
                actual_start: issue.fields.customfield_10008 || null,
                actual_end: issue.fields.customfield_10009 || null,
                labels: issue.fields.labels || [],
                duedate: issue.fields.duedate || null,
                start_date: issue.fields.customfield_10015 || null,
                story_points: issue.fields.customfield_10016 || null,
                parent_key: issue.fields.parent ? issue.fields.parent.key : null,
                created: issue.fields.created
            };
        }).sort((a, b) => a.key.localeCompare(b.key));

        // ── Process to-do tasks ────────────────────────────────────────────
        const todoTasks = todoIssues.filter(issue => {
            const isSubtask = issue.fields.issuetype.subtask === true;
            const statusName = (issue.fields.status.name || '').toUpperCase();
            if (!(isSubtask && statusName !== 'IDEA')) return false;

            const created = issue.fields.created;
            if (!created) return false;
            return created.substring(0, 7) === req.params.yearMonth;
        }).map(issue => {
            const allWls = issue.fields.worklog?.worklogs || [];
            const userWls = allWls.filter(w => w.author.accountId === req.user.account_id);
            const totalSec = userWls.reduce((s, w) => s + w.timeSpentSeconds, 0);

            return {
                key: issue.key,
                summary: issue.fields.summary,
                project: issue.fields.project.name,
                project_key: issue.fields.project.key,
                issue_type: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                time_spent_hours: secToH(totalSec),
                time_spent_display: totalSec > 0 ? fmtH(secToH(totalSec)) : null,
                has_worklog: userWls.length > 0,
                url: `${req.user.base_url}/browse/${issue.key}`,
                original_estimate: issue.fields.timeoriginalestimate || null,
                actual_start: issue.fields.customfield_10008 || null,
                actual_end: issue.fields.customfield_10009 || null,
                labels: issue.fields.labels || [],
                duedate: issue.fields.duedate || null,
                start_date: issue.fields.customfield_10015 || null,
                story_points: issue.fields.customfield_10016 || null,
                parent_key: issue.fields.parent ? issue.fields.parent.key : null,
                created: issue.fields.created
            };
        }).sort((a, b) => a.key.localeCompare(b.key));

        // ── Build result ───────────────────────────────────────────────────
        const workingDays = wdList.map(d => ({
            ...d,
            logged: secToH(dailySecMap[d.date] || 0)
        }));

        const totalSecAll   = wdList.reduce((s, d) => s + (dailySecMap[d.date] || 0), 0);
        const standardHours = workingDays.reduce((s, d) => s + d.standard, 0);
        const totalLogged   = secToH(totalSecAll);

        const pastDays     = workingDays.filter(d => d.date <= today);
        const pastDates    = new Set(pastDays.map(d => d.date));
        const totalSecPast = wdList.filter(d => pastDates.has(d.date)).reduce((s, d) => s + (dailySecMap[d.date] || 0), 0);
        const reqToDate    = pastDays.reduce((s, d) => s + d.standard, 0);
        const logToDate    = secToH(totalSecPast);
        const noWorklogCount = tasks.filter(t => !t.has_worklog).length;

        const result = {
            month, year,
            year_month: `${year}-${pad(month)}`,
            month_label: `${MONTH_NAMES_VI[month]}/${year}`,
            standard_hours: standardHours,
            total_logged: totalLogged,
            required_to_date: reqToDate,
            logged_to_date: logToDate,
            net_to_date: Math.round((logToDate - reqToDate) * 100) / 100,
            progress_pct: Math.round((totalLogged / standardHours) * 1000) / 10,
            task_count: tasks.length,
            in_progress_count: inProgressTasks.length,
            todo_count: todoTasks.length,
            no_worklog_count: noWorklogCount,
            last_updated: new Date().toISOString(),
            today,
            tasks,
            in_progress_tasks: inProgressTasks,
            todo_tasks: todoTasks,
            working_days: workingDays
        };

        // ── Save to SQLite (single transaction) ───────────────────────────
        saveMonthData(req.user.id, result);

        console.log(`  ✅ Xong! ${tasks.length} tasks Done, ${inProgressTasks.length} tasks In Progress, ${todoTasks.length} tasks To-do | ${totalLogged}h / ${standardHours}h`);
        res.json(result);

    } catch (e) {
        console.error('❌ Lỗi refresh:', e.message);
        if (e.message === 'JIRA_401') {
            return res.status(400).json({ error: 'JIRA_401' });
        }
        res.status(500).json({ error: e.message });
    }
});

// GET /api/issue/:issueKey/transitions - get allowed transitions
app.get('/api/issue/:issueKey/transitions', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const data = await jiraGet(req.user, `/issue/${issueKey}/transitions`);
        const transitions = (data.transitions || []).map(t => ({
            id: t.id,
            name: t.name,
            toStatus: t.to.name
        }));
        res.json({ transitions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/issue/:issueKey/transition - transition issue
app.post('/api/issue/:issueKey/transition', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const { transitionId } = req.body;
        if (!transitionId) {
            return res.status(400).json({ error: 'Thiếu transitionId' });
        }
        await jiraPost(req.user, `/issue/${issueKey}/transitions`, {
            transition: { id: transitionId }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/issue/:issueKey/worklog - log work
app.post('/api/issue/:issueKey/worklog', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const { timeSpent, comment, started } = req.body;
        if (!timeSpent) {
            return res.status(400).json({ error: 'Thiếu thời gian timeSpent (vd: 2h, 45m)' });
        }
        const payload = { timeSpent };
        if (started) payload.started = started;
        if (comment) payload.comment = makeAdfComment(comment);
        await jiraPost(req.user, `/issue/${issueKey}/worklog`, payload);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/issue/:issueKey/update-fields - update multiple fields
app.post('/api/issue/:issueKey/update-fields', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const { originalEstimate, labels, parentKey, duedate, startDate, storyPoints, actualStart, actualEnd } = req.body;

        const fields = {};

        if (originalEstimate !== undefined) fields.timetracking = { originalEstimate };
        if (labels !== undefined) {
            fields.labels = Array.isArray(labels) ? labels : labels.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (parentKey !== undefined && parentKey) fields.parent = { key: parentKey.trim() };
        if (duedate !== undefined) fields.duedate = duedate || null;
        if (startDate !== undefined) fields.customfield_10015 = startDate || null;
        if (storyPoints !== undefined) {
            fields.customfield_10016 = storyPoints !== null && storyPoints !== '' ? parseFloat(storyPoints) : null;
        }
        if (actualStart !== undefined) fields.customfield_10008 = actualStart || null;
        if (actualEnd !== undefined) fields.customfield_10009 = actualEnd || null;

        console.log(`📡 Đang cập nhật fields cho task ${issueKey}:`, fields);
        await jiraPut(req.user, `/issue/${issueKey}`, { fields });
        res.json({ success: true });
    } catch (e) {
        console.error(`❌ Lỗi cập nhật fields cho task ${req.params.issueKey}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── Start ─────────────────────────────────────────────────────────────────

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
