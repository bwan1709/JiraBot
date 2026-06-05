const fetch = require('node-fetch');
const { saveMonthData } = require('../db');
const { 
    pad, secToH, fmtH, getDaysInMonth, buildWorkingDays, MONTH_NAMES_VI 
} = require('../utils/helpers');

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

async function fetchPage(user, jql, fields, nextPageToken = null, maxResults = 100) {
    const params = { jql, fields, maxResults: String(maxResults) };
    if (nextPageToken) {
        params.nextPageToken = nextPageToken;
    }
    const q = new URLSearchParams(params);
    return jiraGet(user, `/search/jql?${q}`);
}

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

// Complex monthly sync logic from Jira API
async function refreshMonthData(user, yearMonth) {
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    if (!year || !month || month < 1 || month > 12) {
        throw new Error('Tháng không hợp lệ. Định dạng: YYYY-MM (vd: 2026-06)');
    }

    const startDate = `${year}-${pad(month)}-01`;
    const endDate   = `${year}-${pad(month)}-${getDaysInMonth(year, month)}`;
    const d_today   = new Date();
    const today     = `${d_today.getFullYear()}-${pad(d_today.getMonth() + 1)}-${pad(d_today.getDate())}`;

    console.log(`\n📡 Đang tải dữ liệu cho ${user.full_name} (${MONTH_NAMES_VI[month]}/${year})...`);
    const t0 = Date.now();

    // ── Run 4 queries in parallel ──────────────────────────────────────
    const WL_FIELDS   = 'summary,worklog,issuetype,project,status,customfield_10009,customfield_10124,resolutiondate';
    const DONE_FIELDS = 'summary,status,worklog,issuetype,project,resolutiondate,timeoriginalestimate,customfield_10008,customfield_10009,customfield_10124,labels,duedate,customfield_10015,customfield_10128,customfield_10123,customfield_10016,customfield_10035,parent,created';

    const [wlIssues, doneIssues, inProgressIssues, todoIssues] = await Promise.all([
        searchAll(
            user,
            `worklogAuthor = '${user.account_id}' AND ((cf[10009] is not empty AND cf[10009] >= '${startDate}' AND cf[10009] <= '${endDate}') OR (cf[10009] is empty AND resolved is not empty AND resolved >= '${startDate}' AND resolved <= '${endDate}') OR (cf[10009] is empty AND resolved is empty AND worklogDate >= '${startDate}' AND worklogDate <= '${endDate}'))`,
            WL_FIELDS
        ),
        searchAll(
            user,
            `assignee = '${user.account_id}' AND status = Done AND ((cf[10009] is not empty AND cf[10009] >= '${startDate}' AND cf[10009] <= '${endDate}') OR (cf[10009] is empty AND resolved >= '${startDate}' AND resolved <= '${endDate}'))`,
            DONE_FIELDS
        ),
        searchAll(
            user,
            `assignee = '${user.account_id}' AND status = 'In Progress' AND status != CANCELLED`,
            DONE_FIELDS
        ),
        searchAll(
            user,
            `assignee = '${user.account_id}' AND status = 'To Do' AND status != CANCELLED`,
            DONE_FIELDS
        )
    ]);

    console.log(`  → Jira trả về: ${wlIssues.length} worklog issues, ${doneIssues.length} done tasks, ${inProgressIssues.length} in-progress tasks (${Date.now() - t0}ms)`);

    // ── Build daily hours map từ worklog issues ────────────────────────
    const wdList = buildWorkingDays(year, month);
    const dailySecMap = {};
    wdList.forEach(d => { dailySecMap[d.date] = 0; });

    const workingDaysSet = new Set(wdList.map(d => d.date));

    // Helpers for project-specific custom fields
    const getActualStart = (fields) => fields.customfield_10008 || null;
    const getActualEnd = (fields) => fields.customfield_10009 || fields.customfield_10124 || fields.resolutiondate || null;
    const getStartDate = (fields) => fields.customfield_10015 || fields.customfield_10128 || fields.customfield_10123 || null;
    const getStoryPoints = (fields) => fields.customfield_10016 !== null && fields.customfield_10016 !== undefined ? fields.customfield_10016 : (fields.customfield_10035 !== null && fields.customfield_10035 !== undefined ? fields.customfield_10035 : null);

    // Helper to map Sunday/weekend logs to closest working day in the month
    const mapToWorkingDay = (dateStr) => {
        if (workingDaysSet.has(dateStr)) return dateStr;
        const d = new Date(dateStr);
        
        // Try next day
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        const nextStr = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
        if (nextStr >= startDate && nextStr <= endDate && workingDaysSet.has(nextStr)) {
            return nextStr;
        }
        
        // Try previous day
        const prev = new Date(d);
        prev.setDate(d.getDate() - 1);
        const prevStr = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
        if (prevStr >= startDate && prevStr <= endDate && workingDaysSet.has(prevStr)) {
            return prevStr;
        }
        
        const sortedDays = Array.from(workingDaysSet).sort();
        if (sortedDays.length > 0) {
            if (dateStr < sortedDays[0]) return sortedDays[0];
            if (dateStr > sortedDays[sortedDays.length - 1]) return sortedDays[sortedDays.length - 1];
        }
        return dateStr;
    };

    const getIssueSecondsForMonth = (issue) => {
        const actualEnd = getActualEnd(issue.fields);
        const wls = issue.fields.worklog?.worklogs || [];
        let totalSec = 0;
        wls.forEach(wl => {
            if (wl.author.accountId !== user.account_id) return;
            
            let targetDateStr;
            if (actualEnd) {
                const wlDate = new Date(wl.started);
                const logDate = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
                
                const aeDate = new Date(actualEnd);
                const aeMonthStr = `${aeDate.getFullYear()}-${pad(aeDate.getMonth() + 1)}`;
                const wlMonthStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}`;
                
                if (wlMonthStr === aeMonthStr) {
                    targetDateStr = logDate;
                } else {
                    let targetDate = new Date(actualEnd);
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
                const wlDate = new Date(wl.started);
                targetDateStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
            }

            if (targetDateStr >= startDate && targetDateStr <= endDate) {
                const mappedDateStr = mapToWorkingDay(targetDateStr);
                if (workingDaysSet.has(mappedDateStr)) {
                    totalSec += wl.timeSpentSeconds;
                }
            }
        });
        return totalSec;
    };

    wlIssues.forEach(issue => {
        if (issue.fields.issuetype.subtask !== true) return; // Only process subtasks!

        const actualEnd = getActualEnd(issue.fields);
        const wls = issue.fields.worklog?.worklogs || [];
        wls.forEach(wl => {
            if (wl.author.accountId !== user.account_id) return;
            
            let targetDateStr;
            if (actualEnd) {
                const wlDate = new Date(wl.started);
                const logDate = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
                
                const aeDate = new Date(actualEnd);
                const aeMonthStr = `${aeDate.getFullYear()}-${pad(aeDate.getMonth() + 1)}`;
                const wlMonthStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}`;
                
                if (wlMonthStr === aeMonthStr) {
                    targetDateStr = logDate;
                } else {
                    let targetDate = new Date(actualEnd);
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
                const wlDate = new Date(wl.started);
                targetDateStr = `${wlDate.getFullYear()}-${pad(wlDate.getMonth() + 1)}-${pad(wlDate.getDate())}`;
            }

            if (targetDateStr >= startDate && targetDateStr <= endDate) {
                const mappedDateStr = mapToWorkingDay(targetDateStr);
                if (dailySecMap[mappedDateStr] !== undefined) {
                     dailySecMap[mappedDateStr] += wl.timeSpentSeconds;
                }
            }
        });
    });

    // ── Process done tasks ─────────────────────────────────────────────
    const tasks = doneIssues.filter(issue => issue.fields.issuetype.subtask === true).map(issue => {
        const allWls = issue.fields.worklog?.worklogs || [];
        const userWls = allWls.filter(w => w.author.accountId === user.account_id);
        const totalSec = getIssueSecondsForMonth(issue);
        let resolvedDate = null;
        if (issue.fields.resolutiondate) {
            const resDate = new Date(issue.fields.resolutiondate);
            resolvedDate = `${resDate.getFullYear()}-${pad(resDate.getMonth() + 1)}-${pad(resDate.getDate())}`;
        }

        const originalEstimate = issue.fields.timeoriginalestimate || null;
        const actualStart = getActualStart(issue.fields);
        const actualEnd = getActualEnd(issue.fields);
        const labels = issue.fields.labels || [];
        const duedate = issue.fields.duedate || null;
        const startDateField = getStartDate(issue.fields);
        const storyPoints = getStoryPoints(issue.fields);
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
            has_worklog: totalSec > 0,
            url: `${user.base_url}/browse/${issue.key}`,
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
        if (issue.fields.issuetype.subtask !== true) return false;
        const created = issue.fields.created;
        if (!created) return false;
        return created.substring(0, 7) === yearMonth;
    }).map(issue => {
        const totalSec = getIssueSecondsForMonth(issue);

        return {
            key: issue.key,
            summary: issue.fields.summary,
            project: issue.fields.project.name,
            project_key: issue.fields.project.key,
            issue_type: issue.fields.issuetype.name,
            status: issue.fields.status.name,
            time_spent_hours: secToH(totalSec),
            time_spent_display: totalSec > 0 ? fmtH(secToH(totalSec)) : null,
            has_worklog: totalSec > 0,
            url: `${user.base_url}/browse/${issue.key}`,
            original_estimate: issue.fields.timeoriginalestimate || null,
            actual_start: getActualStart(issue.fields),
            actual_end: getActualEnd(issue.fields),
            labels: issue.fields.labels || [],
            duedate: issue.fields.duedate || null,
            start_date: getStartDate(issue.fields),
            story_points: getStoryPoints(issue.fields),
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
        return created.substring(0, 7) === yearMonth;
    }).map(issue => {
        const totalSec = getIssueSecondsForMonth(issue);

        return {
            key: issue.key,
            summary: issue.fields.summary,
            project: issue.fields.project.name,
            project_key: issue.fields.project.key,
            issue_type: issue.fields.issuetype.name,
            status: issue.fields.status.name,
            time_spent_hours: secToH(totalSec),
            time_spent_display: totalSec > 0 ? fmtH(secToH(totalSec)) : null,
            has_worklog: totalSec > 0,
            url: `${user.base_url}/browse/${issue.key}`,
            original_estimate: issue.fields.timeoriginalestimate || null,
            actual_start: getActualStart(issue.fields),
            actual_end: getActualEnd(issue.fields),
            labels: issue.fields.labels || [],
            duedate: issue.fields.duedate || null,
            start_date: getStartDate(issue.fields),
            story_points: getStoryPoints(issue.fields),
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

    // Save to SQLite
    saveMonthData(user.id, result);
    console.log(`  ✅ Xong! ${tasks.length} tasks Done, ${inProgressTasks.length} tasks In Progress, ${todoTasks.length} tasks To-do | ${totalLogged}h / ${standardHours}h`);
    return result;
}

module.exports = {
    jiraGet,
    jiraPost,
    jiraPut,
    searchAll,
    refreshMonthData
};
