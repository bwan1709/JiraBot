const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
    cleanupMarkdowns, 
    saveMarkdown, 
    getMarkdown, 
    getUserMarkdowns, 
    deleteMarkdown 
} = require('../db');

// Run markdowns cleanup on every API request to keep the database tidy
router.use((req, res, next) => {
    cleanupMarkdowns();
    next();
});

// GET /api/markdowns - Get all active markdowns of the logged-in user
router.get('/markdowns', (req, res) => {
    try {
        const markdowns = getUserMarkdowns(req.user.id);
        res.json({ markdowns });
    } catch (e) {
        console.error('❌ Lỗi tải danh sách markdown:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/markdowns - Create or update a markdown document
router.post('/markdowns', (req, res) => {
    try {
        const { id, title, content } = req.body;
        const now = new Date();

        let mdId = id;
        let isNew = false;
        let existingMd = null;

        if (mdId) {
            existingMd = getMarkdown(mdId);
            if (existingMd && existingMd.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tài liệu này' });
            }
        }

        if (!existingMd) {
            mdId = crypto.randomUUID();
            isNew = true;
        }

        const md = {
            id: mdId,
            user_id: req.user.id,
            title: title || '',
            content: content || '',
            created_at: existingMd ? existingMd.created_at : now.toISOString(),
            expires_at: null // No expiration: documents persist until user deletes them
        };

        saveMarkdown(md);
        res.json({ success: true, markdown: md, isNew });
    } catch (e) {
        console.error('❌ Lỗi lưu markdown:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/markdowns/:id - Delete a markdown document
router.delete('/markdowns/:id', (req, res) => {
    try {
        const md = getMarkdown(req.params.id);
        if (!md) {
            return res.status(404).json({ error: 'Tài liệu không tồn tại' });
        }
        if (md.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa tài liệu này' });
        }
        deleteMarkdown(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Lỗi xóa markdown:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/public/markdowns/:id - Public anonymous view of a shared markdown
router.get('/public/markdowns/:id', (req, res) => {
    try {
        const md = getMarkdown(req.params.id);
        if (!md) {
            return res.status(404).json({ error: 'Tài liệu không tồn tại' });
        }

        res.json({
            id: md.id,
            title: md.title,
            content: md.content,
            created_at: md.created_at
        });
    } catch (e) {
        console.error('❌ Lỗi tải shared markdown:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
