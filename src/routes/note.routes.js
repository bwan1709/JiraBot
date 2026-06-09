const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
    cleanupNotes, 
    saveNote, 
    getNote, 
    getUserNotes, 
    deleteNote 
} = require('../db');

// Run notes cleanup on every API request to keep the database tidy
router.use((req, res, next) => {
    cleanupNotes();
    next();
});

// GET /api/notes - Get all active notes of the logged-in user
router.get('/notes', (req, res) => {
    try {
        const notes = getUserNotes(req.user.id);
        res.json({ notes });
    } catch (e) {
        console.error('❌ Lỗi tải danh sách note:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/notes - Create or update a note
router.post('/notes', (req, res) => {
    try {
        const { id, title, content, drawing, image_url } = req.body;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

        let noteId = id;
        let isNew = false;
        let existingNote = null;

        if (noteId) {
            existingNote = getNote(noteId);
            if (existingNote && existingNote.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa ghi chú này' });
            }
        }

        if (!existingNote) {
            noteId = crypto.randomUUID();
            isNew = true;
        }

        const note = {
            id: noteId,
            user_id: req.user.id,
            title: title || '',
            content: content || '',
            drawing: drawing || null,
            image_url: image_url || null,
            created_at: existingNote ? existingNote.created_at : now.toISOString(),
            expires_at: expiresAt.toISOString() // Reset/refresh expiration on save
        };

        saveNote(note);
        res.json({ success: true, note, isNew });
    } catch (e) {
        console.error('❌ Lỗi lưu note:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/notes/:id', (req, res) => {
    try {
        const note = getNote(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Ghi chú không tồn tại' });
        }
        if (note.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa ghi chú này' });
        }
        deleteNote(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Lỗi xóa note:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/public/notes/:id - Public anonymous view of a shared note
router.get('/public/notes/:id', (req, res) => {
    try {
        const note = getNote(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Ghi chú đã hết hạn hoặc không tồn tại' });
        }
        
        // Double check expiration just in case cleanup hasn't run yet
        const now = new Date().toISOString();
        if (note.expires_at <= now) {
            // Delete it immediately
            deleteNote(note.id, note.user_id);
            return res.status(404).json({ error: 'Ghi chú đã hết hạn hoặc không tồn tại' });
        }

        // Return note content (exclude user_id for security)
        res.json({
            id: note.id,
            title: note.title,
            content: note.content,
            drawing: note.drawing,
            image_url: note.image_url,
            created_at: note.created_at,
            expires_at: note.expires_at
        });
    } catch (e) {
        console.error('❌ Lỗi tải shared note:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
