const express = require('express');
const router = express.Router();
const { db, loadMonthData } = require('../db');
const { jiraGet, jiraPost, jiraPut, refreshMonthData } = require('../services/jira.service');

// GET /api/months — list available months from DB
router.get('/months', (req, res) => {
    try {
        const rows = db.prepare(`SELECT year_month FROM months WHERE user_id = ? ORDER BY year_month DESC`).all(req.user.id);
        res.json({ months: rows.map(r => r.year_month) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/data/:yearMonth — load data from DB
router.get('/data/:yearMonth', (req, res) => {
    try {
        const data = loadMonthData(req.user.id, req.params.yearMonth);
        if (!data) return res.status(404).json({ error: 'no_data' });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/refresh/:yearMonth — fetch fresh data from Jira and save to DB
router.post('/refresh/:yearMonth', async (req, res) => {
    try {
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.status(400).json({ error: 'JIRA_MISSING_INFO' });
        }

        const result = await refreshMonthData(req.user, req.params.yearMonth);
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
router.get('/issue/:issueKey/transitions', async (req, res) => {
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
router.post('/issue/:issueKey/transition', async (req, res) => {
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
router.post('/issue/:issueKey/worklog', async (req, res) => {
    try {
        const { issueKey } = req.params;
        const { timeSpent, comment, started } = req.body;
        if (!timeSpent) {
            return res.status(400).json({ error: 'Thiếu thời gian timeSpent (vd: 2h, 45m)' });
        }
        const payload = { timeSpent };
        if (started) payload.started = started;
        if (comment) payload.comment = comment;
        await jiraPost(req.user, `/rest/api/2/issue/${issueKey}/worklog`, payload);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/issue/:issueKey/update-fields - update multiple fields
router.post('/issue/:issueKey/update-fields', async (req, res) => {
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

        // Fetch dynamic custom field keys using editmeta
        const editmeta = await jiraGet(req.user, `/issue/${issueKey}/editmeta`);
        const fieldMap = {
            actualStart: 'customfield_10008',
            actualEnd: 'customfield_10009',
            startDate: 'customfield_10015',
            storyPoints: 'customfield_10016'
        };
        if (editmeta && editmeta.fields) {
            for (const [key, field] of Object.entries(editmeta.fields)) {
                const nameLower = (field.name || '').toLowerCase();
                if (nameLower === 'actual start') {
                    fieldMap.actualStart = key;
                } else if (nameLower === 'actual end') {
                    fieldMap.actualEnd = key;
                } else if (nameLower === 'start date') {
                    fieldMap.startDate = key;
                } else if (nameLower === 'story point estimate' || nameLower === 'story points') {
                    fieldMap.storyPoints = key;
                }
            }
        }

        if (startDate !== undefined) fields[fieldMap.startDate] = startDate || null;
        if (storyPoints !== undefined) {
            fields[fieldMap.storyPoints] = storyPoints !== null && storyPoints !== '' ? parseFloat(storyPoints) : null;
        }
        if (actualStart !== undefined) fields[fieldMap.actualStart] = actualStart || null;
        if (actualEnd !== undefined) fields[fieldMap.actualEnd] = actualEnd || null;

        console.log(`📡 Đang cập nhật fields cho task ${issueKey}:`, fields);
        await jiraPut(req.user, `/issue/${issueKey}`, { fields });
        res.json({ success: true });
    } catch (e) {
        console.error(`❌ Lỗi cập nhật fields cho task ${req.params.issueKey}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
