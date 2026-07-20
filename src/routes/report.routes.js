const express = require('express');
const router = express.Router();
const { db } = require('../db');

// POST /api/reports/submit - Submit a new monthly report
router.post('/submit', (req, res) => {
    try {
        const { year_month, snapshot_data, user_comment } = req.body;
        if (!year_month || !snapshot_data) {
            return res.status(400).json({ error: 'Thiếu dữ liệu báo cáo' });
        }

        // Check if report already exists for this month
        const existing = db.prepare('SELECT id FROM monthly_reports WHERE user_id = ? AND year_month = ?').get(req.user.id, year_month);
        if (existing) {
            return res.status(400).json({ error: `Báo cáo tháng ${year_month} đã được nộp.` });
        }

        // The first approver is the user's direct manager
        const current_approver_id = req.user.manager_id || null;
        // If no manager is set, the report might be auto-approved or require admin intervention
        const initial_status = current_approver_id ? 'pending' : 'approved';

        const info = db.prepare(`
            INSERT INTO monthly_reports (user_id, year_month, snapshot_data, user_comment, status, current_approver_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, year_month, snapshot_data, user_comment || '', initial_status, current_approver_id, new Date().toISOString());

        res.json({ success: true, report_id: info.lastInsertRowid, status: initial_status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/reports/my-reports - List my reports
router.get('/my-reports', (req, res) => {
    try {
        const reports = db.prepare(`
            SELECT id, year_month, user_comment, status, current_approver_id, created_at 
            FROM monthly_reports 
            WHERE user_id = ? 
            ORDER BY year_month DESC
        `).all(req.user.id);
        res.json({ reports });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/reports/pending-approvals - List reports waiting for MY approval
router.get('/pending-approvals', (req, res) => {
    try {
        // Find reports where I am the current_approver_id
        const reports = db.prepare(`
            SELECT r.id, r.year_month, r.user_comment, r.status, r.created_at,
                   u.full_name as submitter_name, u.email as submitter_email
            FROM monthly_reports r
            JOIN users u ON r.user_id = u.id
            WHERE r.current_approver_id = ? AND r.status = 'pending'
            ORDER BY r.created_at ASC
        `).all(req.user.id);
        res.json({ reports });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/reports/:id - Get specific report details
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const report = db.prepare(`
            SELECT r.*, u.full_name as submitter_name, u.email as submitter_email
            FROM monthly_reports r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `).get(id);

        if (!report) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        // Check permission (must be owner, or current approver, or have already approved it, or be admin)
        // For simplicity, let's just fetch approvals to attach them
        const approvals = db.prepare(`
            SELECT a.*, u.full_name as approver_name, u.job_title as approver_title
            FROM report_approvals a
            JOIN users u ON a.approver_id = u.id
            WHERE a.report_id = ?
            ORDER BY a.approved_at ASC
        `).all(id);

        res.json({ report, approvals });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/reports/:id/approve - Approve a report
router.post('/:id/approve', (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        
        const report = db.prepare('SELECT * FROM monthly_reports WHERE id = ?').get(id);
        if (!report) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }
        if (report.status !== 'pending' || report.current_approver_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền duyệt báo cáo này lúc này' });
        }

        // User must have a signature configured
        const me = db.prepare('SELECT signature_url, manager_id FROM users WHERE id = ?').get(req.user.id);
        if (!me.signature_url) {
            return res.status(400).json({ error: 'Vui lòng cấu hình chữ ký số trong phần Cài đặt trước khi duyệt báo cáo.' });
        }

        // Record approval
        db.prepare(`
            INSERT INTO report_approvals (report_id, approver_id, comment, signature_url, approved_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.user.id, comment || '', me.signature_url, new Date().toISOString());

        // Multi-level logic: move to next manager, or mark approved
        if (me.manager_id) {
            db.prepare('UPDATE monthly_reports SET current_approver_id = ? WHERE id = ?').run(me.manager_id, id);
        } else {
            db.prepare(`UPDATE monthly_reports SET status = 'approved', current_approver_id = NULL WHERE id = ?`).run(id);
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
