const express = require('express');
const router = express.Router();
const { db, getProjects, saveProject, deleteProject, syncProjects } = require('../db');
const { requireAdmin } = require('../middlewares/auth');

// POST /api/login — Login handler
router.post('/login', (req, res) => {
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
                department: user.department,
                job_title: user.job_title
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/register — Register new account
router.post('/register', (req, res) => {
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
router.post('/logout', (req, res) => {
    res.clearCookie('user_id');
    res.json({ success: true });
});

// GET /api/me — Get profile of currently logged-in user
router.get('/me', (req, res) => {
    const full = req.query.full === '1';
    const u = req.user;
    const payload = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
        base_url: u.base_url,
        job_title: u.job_title || '',
        projects: JSON.parse(u.projects || '[]')
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
router.put('/profile', (req, res) => {
    try {
        const { full_name, department, job_title, email_jira, token, account_id, cloud_id, base_url, password, projects } = req.body;

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
            job_title: (job_title || '').trim(),
            token: (token || '').trim(),
            account_id: (account_id || '').trim(),
            cloud_id: (cloud_id || '').trim(),
            base_url: (base_url || '').trim(),
            projects: Array.isArray(projects) ? JSON.stringify(projects) : '[]'
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

// GET /api/users — List all users (Admin only)
router.get('/users', requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`SELECT id, email, token, cloud_id, account_id, base_url, full_name, role, department, job_title, projects, created_at FROM users ORDER BY id ASC`).all();
        const parsedUsers = users.map(u => ({
            ...u,
            projects: JSON.parse(u.projects || '[]')
        }));
        res.json({ users: parsedUsers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/users — Create new user (Admin only)
router.post('/users', requireAdmin, (req, res) => {
    try {
        const { email, password, token, cloud_id, account_id, base_url, full_name, role, department, job_title, projects } = req.body;
        if (!email || !token || !cloud_id || !account_id || !base_url) {
            return res.status(400).json({ error: 'Thiếu các thông tin bắt buộc (email, token, cloud_id, account_id, base_url)' });
        }

        const pwd = password || 'ilovecds';
        const userRole = role || 'client';

        const info = db.prepare(`
            INSERT INTO users (email, password, token, cloud_id, account_id, base_url, full_name, role, department, job_title, projects, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(email, pwd, token, cloud_id, account_id, base_url, full_name || null, userRole, department || null, job_title || null, Array.isArray(projects) ? JSON.stringify(projects) : '[]', new Date().toISOString());

        res.json({ success: true, userId: info.lastInsertRowId });
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/users/:id — Edit user details (Admin only)
router.put('/users/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, token, cloud_id, account_id, base_url, full_name, role, department, job_title, projects } = req.body;
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
        const projStr = Array.isArray(projects) ? JSON.stringify(projects) : '[]';

        db.prepare(`
            UPDATE users 
            SET email = ?, password = ?, token = ?, cloud_id = ?, account_id = ?, base_url = ?, full_name = ?, role = ?, department = ?, job_title = ?, projects = ?
            WHERE id = ?
        `).run(email, pwd, token, cloud_id, account_id, base_url, full_name || null, userRole, department || null, job_title || null, projStr, id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/users/:id — Delete user (Admin only)
router.delete('/users/:id', requireAdmin, (req, res) => {
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

// GET /api/projects — list all projects
router.get('/projects', (req, res) => {
    try {
        const projects = getProjects();
        res.json({ projects });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/projects/sync — sync projects from Jira (Admin only)
router.post('/projects/sync', requireAdmin, async (req, res) => {
    try {
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.status(400).json({ error: 'Tài khoản admin chưa cấu hình đầy đủ thông tin Jira.' });
        }

        const { jiraGet } = require('../services/jira.service');
        const list = await jiraGet(req.user, '/project');
        
        const jiraProjects = (Array.isArray(list) ? list : []).map(p => ({
            key: p.key.trim().toUpperCase(),
            name: p.name.trim()
        }));

        if (jiraProjects.length === 0) {
            return res.status(400).json({ error: 'Không tìm thấy dự án nào trên Jira.' });
        }

        syncProjects(jiraProjects);
        res.json({ success: true, count: jiraProjects.length });
    } catch (e) {
        console.error('❌ Lỗi đồng bộ dự án:', e.message);
        if (e.message === 'JIRA_401') {
            return res.status(400).json({ error: 'Thông tin xác thực Jira không chính xác hoặc đã hết hạn.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// POST /api/projects — create new project (Disabled)
router.post('/projects', requireAdmin, (req, res) => {
    return res.status(400).json({ error: 'Chức năng tạo dự án thủ công đã bị vô hiệu hóa. Vui lòng sử dụng tính năng đồng bộ từ Jira.' });
});

// PUT /api/projects/:id — update project (Disabled)
router.put('/projects/:id', requireAdmin, (req, res) => {
    return res.status(400).json({ error: 'Chức năng chỉnh sửa dự án thủ công đã bị vô hiệu hóa. Vui lòng sử dụng tính năng đồng bộ từ Jira.' });
});

// DELETE /api/projects/:id — delete project (Disabled)
router.delete('/projects/:id', requireAdmin, (req, res) => {
    return res.status(400).json({ error: 'Chức năng xóa dự án thủ công đã bị vô hiệu hóa. Danh sách dự án được quản lý tự động qua đồng bộ từ Jira.' });
});

module.exports = router;
