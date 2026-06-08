# JiraBot — Time Report Tracker

Hệ thống báo cáo thời gian làm việc từ Jira, hỗ trợ đa người dùng với phân quyền Admin/Client.

## 🚀 Chạy với Docker Compose (Khuyến nghị)

Image **tự build frontend** (`dist/`) trong container — không cần build tay.

```bash
# 1. Clone repo
git clone https://github.com/bwan1709/JiraBot.git
cd JiraBot

# 2. Tạo & sửa file .env
cp .env.example .env
nano .env            # ĐỔI ADMIN_PASSWORD; PORT=3344

# 3. Build image + chạy nền (lần đầu phải có --build)
docker compose up -d --build

# 4. Xem log khởi động / kiểm tra healthy
docker compose logs -f jirabot
docker compose ps
```

Truy cập: **http://localhost:3344** (cổng nội bộ — production nên đặt sau reverse proxy + HTTPS).

> **Production**: đặt Nginx/Caddy phía trước proxy về `localhost:3344` để có **HTTPS** (cookie đăng nhập).
> Dữ liệu SQLite được giữ ở volume `jirabot_data` — rebuild không mất dữ liệu.

---

## 🔧 Quản lý Docker

```bash
# Dừng app
docker compose down

# Rebuild sau khi cập nhật code
docker compose up -d --build

# Xem trạng thái
docker compose ps

# Xem logs
docker compose logs -f

# Backup database
docker compose exec jirabot cat /app/data/jirabot.db > backup.db
```

---

## 👤 Tài khoản mặc định

Khi khởi động lần đầu (DB chưa có user nào), hệ thống tự tạo tài khoản Admin lấy từ `.env`:
- **Email**: `ADMIN_EMAIL` (mặc định `admin@jirabot.local`)
- **Mật khẩu**: `ADMIN_PASSWORD` trong `.env`

> ⚠️ Đổi mật khẩu ngay sau khi đăng nhập lần đầu trong **⚙️ Cài đặt cá nhân**, và đừng để mật khẩu mặc định khi mở ra internet.

---

## 🏗️ Chạy thủ công (không dùng Docker)

Frontend là **React + Ant Design** (Vite), build ra `dist/` và được Express serve.

```bash
npm install          # cài cả backend + frontend deps

# Production: build rồi chạy 1 tiến trình (Express serve dist + API)
npm run build        # Vite build -> ./dist
PORT=3344 npm start  # mở http://localhost:3344

# Dev (hot-reload): chạy backend + Vite dev cùng lúc
npm run dev          # backend :3344  +  Vite :5173 (proxy /api)
# mở http://localhost:5173/login.html
```

> ⚠️ Phải `npm run build` ít nhất 1 lần trước khi `npm start`, vì Express serve thư mục `dist/`.

---

## 📁 Cấu trúc

```
JiraBot/
├── index.html         # Entry trang Dashboard (React)
├── login.html         # Entry trang Đăng nhập (React)
├── vite.config.ts     # Build React -> ./dist; dev proxy /api
├── tsconfig.json
├── server.js          # Backend entry (Express + SQLite)
├── src/               # Backend: config, db, middlewares, routes, services, utils
├── app/               # Frontend (React + TS): components, modals, charts, export...
├── dist/              # Build output (Express serve cái này — auto-gen, không commit)
├── public/            # Static passthrough (favicon) -> copy vào dist khi build
├── data/              # SQLite database (auto-created, không commit)
├── docker-compose.yml # Docker Compose config
├── Dockerfile         # Multi-stage: build dist + chạy backend
└── ecosystem.config.js # PM2 config (nếu dùng VPS trực tiếp)
```
