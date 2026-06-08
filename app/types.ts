// Domain types mirroring the Express backend payloads (src/db.js, src/services/jira.service.js).

export interface Task {
  key: string;
  summary: string;
  project: string;
  project_key: string;
  issue_type: string;
  status: string;
  resolved_date: string | null;
  parent_key: string | null;
  time_spent_hours: number;
  time_spent_display: string | null;
  has_worklog: boolean;
  url: string;
  original_estimate: number | null; // seconds
  actual_start: string | null;
  actual_end: string | null;
  labels: string[];
  duedate: string | null;
  start_date: string | null;
  story_points: number | null;
  missing_fields: string[];
  created: string | null;
}

export interface WorkingDay {
  date: string; // YYYY-MM-DD
  day_label: string; // e.g. "01\nT2"
  day_name: string; // e.g. "T2"
  dow: number; // 0=Sun
  is_saturday: boolean;
  standard: number;
  logged: number;
}

export interface MonthData {
  month: number;
  year: number;
  year_month: string;
  month_label: string;
  standard_hours: number;
  total_logged: number;
  required_to_date: number;
  logged_to_date: number;
  net_to_date: number;
  progress_pct: number;
  task_count: number;
  in_progress_count: number;
  todo_count: number;
  no_worklog_count: number;
  last_updated: string;
  today: string;
  tasks: Task[];
  in_progress_tasks: Task[];
  todo_tasks: Task[];
  working_days: WorkingDay[];
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string; // 'admin' | 'client'
  department: string;
  base_url?: string;
  job_title: string;
  // present only when fetched with ?full=1 or from /api/users
  token?: string;
  account_id?: string;
  cloud_id?: string;
  email_jira?: string;
  created_at?: string;
}

export interface DailyTask {
  key: string;
  summary: string;
  url: string;
  original_estimate: number; // seconds
  actual_start: string | null;
  actual_end: string | null;
  time_spent_seconds: number;
}

export interface Worklog {
  id: string;
  key: string;
  summary: string;
  url: string;
  comment: unknown; // string | ADF object
  started: string; // ISO timestamp
  timeSpentSeconds: number;
  timeSpent: string;
}

export interface DailyReport {
  date: string;
  tasks: DailyTask[];
  worklogs: Worklog[];
}

export interface Transition {
  id: string;
  name: string;
  toStatus: string;
}

export type TaskTabKey = 'todo' | 'inprogress' | 'done' | 'missing';
