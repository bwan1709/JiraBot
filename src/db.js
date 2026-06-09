const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function initDb() {
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
            job_title   TEXT,
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

    // Migration: Add job_title column if it doesn't exist
    const tableInfo = db.pragma('table_info(users)');
    const hasJobTitle = tableInfo.some(col => col.name === 'job_title');
    if (!hasJobTitle) {
        db.exec('ALTER TABLE users ADD COLUMN job_title TEXT');
        console.log('  ⚙️ Added job_title column to users table');
    }

    const hasProjects = tableInfo.some(col => col.name === 'projects');
    if (!hasProjects) {
        db.exec('ALTER TABLE users ADD COLUMN projects TEXT');
        console.log('  ⚙️ Added projects column to users table');
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS monthly_plans (
            year_month   TEXT PRIMARY KEY,
            projects     TEXT NOT NULL,
            title        TEXT,
            description  TEXT,
            created_by   INTEGER,
            created_at   TEXT
        );

        CREATE TABLE IF NOT EXISTS monthly_plan_items (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            year_month   TEXT NOT NULL,
            content      TEXT NOT NULL,
            project_key  TEXT NOT NULL,
            FOREIGN KEY (year_month) REFERENCES monthly_plans(year_month) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS projects (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            key          TEXT UNIQUE NOT NULL,
            name         TEXT NOT NULL,
            created_at   TEXT
        );
    `);

    const planInfo = db.pragma('table_info(monthly_plans)');
    const hasTitle = planInfo.some(col => col.name === 'title');
    if (!hasTitle) {
        db.exec('ALTER TABLE monthly_plans ADD COLUMN title TEXT');
        console.log('  ⚙️ Added title column to monthly_plans table');
    }
    const hasDesc = planInfo.some(col => col.name === 'description');
    if (!hasDesc) {
        db.exec('ALTER TABLE monthly_plans ADD COLUMN description TEXT');
        console.log('  ⚙️ Added description column to monthly_plans table');
    }

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
            INSERT INTO users (email, password, token, cloud_id, account_id, base_url, full_name, role, department, job_title, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            'Administrator',
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

function getMonthlyPlan(ym) {
    const row = db.prepare(`SELECT * FROM monthly_plans WHERE year_month = ?`).get(ym);
    if (!row) return null;
    const items = db.prepare(`SELECT * FROM monthly_plan_items WHERE year_month = ?`).all(ym);
    return {
        year_month: row.year_month,
        projects: JSON.parse(row.projects || '[]'),
        title: row.title || '',
        description: row.description || '',
        created_by: row.created_by,
        created_at: row.created_at,
        items: items.map(it => ({ content: it.content, project_key: it.project_key }))
    };
}

function getMonthlyPlans() {
    const rows = db.prepare(`SELECT * FROM monthly_plans ORDER BY year_month DESC`).all();
    return rows.map(row => {
        const items = db.prepare(`SELECT * FROM monthly_plan_items WHERE year_month = ?`).all(row.year_month);
        return {
            year_month: row.year_month,
            projects: JSON.parse(row.projects || '[]'),
            title: row.title || '',
            description: row.description || '',
            created_by: row.created_by,
            created_at: row.created_at,
            items: items.map(it => ({ content: it.content, project_key: it.project_key }))
        };
    });
}

function saveMonthlyPlan(ym, projects, title, description, userId, items = []) {
    const run = db.transaction(() => {
        db.prepare(`
            INSERT OR REPLACE INTO monthly_plans (year_month, projects, title, description, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(ym, JSON.stringify(projects), title, description, userId, new Date().toISOString());

        db.prepare(`DELETE FROM monthly_plan_items WHERE year_month = ?`).run(ym);
        const insertItem = db.prepare(`INSERT INTO monthly_plan_items (year_month, content, project_key) VALUES (?, ?, ?)`);
        for (const item of items) {
            insertItem.run(ym, item.content, item.project_key);
        }
    });
    run();
}

function getProjects() {
    return db.prepare(`SELECT * FROM projects ORDER BY key ASC`).all();
}

function saveProject(key, name, id = null) {
    if (id) {
        db.prepare(`UPDATE projects SET key = ?, name = ? WHERE id = ?`).run(key, name, id);
    } else {
        db.prepare(`INSERT INTO projects (key, name, created_at) VALUES (?, ?, ?)`).run(key, name, new Date().toISOString());
    }
}

function deleteProject(id) {
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

module.exports = {
    db,
    initDb,
    saveMonthData,
    loadMonthData,
    getMonthlyPlan,
    getMonthlyPlans,
    saveMonthlyPlan,
    getProjects,
    saveProject,
    deleteProject
};
