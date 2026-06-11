const express = require('express');
const router = express.Router();
const { db, loadMonthData, getMonthlyPlan, getMonthlyPlans, saveMonthlyPlan } = require('../db');
const { requirePmOrAdmin } = require('../middlewares/auth');
const { jiraGet, jiraPost, jiraPut, searchAll, refreshMonthData, fetchLabels } = require('../services/jira.service');

// GET /api/months — list available months from DB
router.get('/months', (req, res) => {
    try {
        const rows = db.prepare(`SELECT year_month FROM months WHERE user_id = ? ORDER BY year_month DESC`).all(req.user.id);
        res.json({ months: rows.map(r => r.year_month) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/labels — list all Jira labels (for the task label picker)
router.get('/labels', async (req, res) => {
    try {
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.status(400).json({ error: 'JIRA_MISSING_INFO' });
        }
        const labels = await fetchLabels(req.user);
        res.json({ labels });
    } catch (e) {
        console.error('❌ Lỗi tải labels:', e.message);
        if (e.message === 'JIRA_401') {
            return res.status(400).json({ error: 'JIRA_401' });
        }
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
        const { transitionId, toStatus, issueType } = req.body;
        if (!transitionId) {
            return res.status(400).json({ error: 'Thiếu transitionId' });
        }

        // Check if transition is to "Done" status
        const isDoneStatus = toStatus && (
            toStatus.toLowerCase() === 'done' || 
            toStatus.toLowerCase() === 'đã hoàn thành' ||
            toStatus.toLowerCase() === 'closed'
        );

        if (isDoneStatus) {
            // Post comment first before transitioning to Done to fulfill validators
            let commentText = '/review-pass';
            if (issueType) {
                const typeLower = issueType.toLowerCase();
                if (typeLower === 'story') {
                    commentText = '/review-pass /qa-pass';
                } else if (typeLower === 'bug') {
                    commentText = '/review-pass /verified';
                }
            }
            try {
                await jiraPost(req.user, `/rest/api/2/issue/${issueKey}/comment`, {
                    body: commentText
                });
            } catch (commentError) {
                console.error('Lỗi khi tự động thêm comment done:', commentError);
                // We don't fail the entire transition if the comment fails
            }
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

// GET /api/daily-report — fetch daily tasks for a specific date (YYYY-MM-DD)
router.get('/daily-report', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Thiếu tham số date (YYYY-MM-DD)' });
        }
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.status(400).json({ error: 'JIRA_MISSING_INFO' });
        }

        const JQL = `worklogAuthor = '${req.user.account_id}' AND worklogDate = '${date}'`;
        const FIELDS = 'summary,status,worklog,issuetype,project,resolutiondate,timeoriginalestimate,customfield_10008,customfield_10009,customfield_10124';

        const issues = await searchAll(req.user, JQL, FIELDS);

        const getActualStart = (fields) => fields.customfield_10008 || null;
        const getActualEnd = (fields) => fields.customfield_10009 || fields.customfield_10124 || fields.resolutiondate || null;
        const pad = (n) => String(n).padStart(2, '0');
        const getLocalDateStr = (dateVal) => {
            if (!dateVal) return null;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return null;
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        const tasks = issues.map(issue => {
            const actualStart = getActualStart(issue.fields);
            const actualEnd = getActualEnd(issue.fields);
            
            const wls = issue.fields.worklog?.worklogs || [];
            let timeSpentSeconds = 0;
            wls.forEach(wl => {
                if (wl.author.accountId !== req.user.account_id) return;
                
                const logDate = getLocalDateStr(wl.started);
                const aeDate = getLocalDateStr(actualEnd);
                const asDate = getLocalDateStr(actualStart);
                
                let targetDateStr = logDate;
                if (logDate === date) {
                    targetDateStr = logDate;
                } else if (aeDate === date) {
                    targetDateStr = aeDate;
                } else if (asDate === date) {
                    targetDateStr = asDate;
                }

                if (targetDateStr === date) {
                    timeSpentSeconds += wl.timeSpentSeconds;
                }
            });

            return {
                key: issue.key,
                summary: issue.fields.summary,
                url: `${req.user.base_url}/browse/${issue.key}`,
                original_estimate: issue.fields.timeoriginalestimate || 0, // in seconds
                actual_start: actualStart,
                actual_end: actualEnd,
                time_spent_seconds: timeSpentSeconds
            };
        });

        // Extract and sort individual worklogs for the timeline
        const worklogs = [];
        issues.forEach(issue => {
            const actualStart = getActualStart(issue.fields);
            const actualEnd = getActualEnd(issue.fields);
            const wls = issue.fields.worklog?.worklogs || [];
            wls.forEach(wl => {
                if (wl.author.accountId !== req.user.account_id) return;
                
                const logDate = getLocalDateStr(wl.started);
                const aeDate = getLocalDateStr(actualEnd);
                const asDate = getLocalDateStr(actualStart);
                
                let targetDateStr = logDate;
                if (logDate === date) {
                    targetDateStr = logDate;
                } else if (aeDate === date) {
                    targetDateStr = aeDate;
                } else if (asDate === date) {
                    targetDateStr = asDate;
                }

                if (targetDateStr === date) {
                    const startedTimestamp = logDate === date 
                        ? wl.started 
                        : `${date}T09:00:00.000+0700`; // default to 9:00 AM on mapped date
                        
                    worklogs.push({
                        id: wl.id,
                        key: issue.key,
                        summary: issue.fields.summary,
                        url: `${req.user.base_url}/browse/${issue.key}`,
                        comment: wl.comment || '',
                        started: startedTimestamp,
                        timeSpentSeconds: wl.timeSpentSeconds,
                        timeSpent: wl.timeSpent
                    });
                }
            });
        });
        worklogs.sort((a, b) => a.started.localeCompare(b.started));

        res.json({ date, tasks, worklogs });
    } catch (e) {
        console.error('❌ Lỗi tải báo cáo ngày:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/jira/projects — fetch all projects from Jira workspace
router.get('/jira/projects', async (req, res) => {
    try {
        if (!req.user.token || !req.user.cloud_id || !req.user.account_id || !req.user.base_url) {
            return res.json({ projects: [] });
        }
        const list = await jiraGet(req.user, '/project');
        const projects = (Array.isArray(list) ? list : []).map(p => ({
            id: p.id,
            key: p.key,
            name: p.name
        }));
        res.json({ projects });
    } catch (e) {
        console.error('❌ Lỗi tải dự án Jira:', e.message);
        res.json({ projects: [] }); // Fallback to empty instead of crashing
    }
});

// GET /api/monthly-plans — list all monthly plans
router.get('/monthly-plans', (req, res) => {
    try {
        const plans = getMonthlyPlans();
        res.json({ plans });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/monthly-plans/:yearMonth — get plan for a specific month
router.get('/monthly-plans/:yearMonth', (req, res) => {
    try {
        const plan = getMonthlyPlan(req.params.yearMonth);
        res.json({ plan });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/monthly-plans — create or update monthly plan (PM/Admin only)
router.post('/monthly-plans', requirePmOrAdmin, (req, res) => {
    try {
        const { year_month, projects, title, description, items } = req.body;
        if (!year_month || !Array.isArray(projects)) {
            return res.status(400).json({ error: 'Thiếu thông tin tháng hoặc danh sách dự án' });
        }
        saveMonthlyPlan(year_month, projects, title || '', description || '', req.user.id, items || []);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
