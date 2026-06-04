# JiraBot — Time Report Tracker

Hệ thống báo cáo thời gian làm việc từ Jira, hỗ trợ đa người dùng với phân quyền Admin/Client.

## 🚀 Chạy với Docker Compose (Khuyến nghị)

```bash
# 1. Clone repo
git clone https://github.com/bwan1709/JiraBot.git
cd JiraBot

# 2. Tạo file .env
cp .env.example .env
# Chỉnh sửa .env nếu cần (mặc định PORT=3000 là đủ)

# 3. Build và chạy
docker compose up -d

# 4. Xem logs
docker compose logs -f jirabot
```

Truy cập: **http://localhost:3344**

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

Khi khởi động lần đầu, hệ thống tự tạo tài khoản Admin:
- **Email**: `admin@jirabot.local`
- **Mật khẩu**: `ilovecds`

> ⚠️ Đổi mật khẩu ngay sau khi đăng nhập lần đầu trong **⚙️ Cài đặt cá nhân**.

---

## 🏗️ Chạy thủ công (không dùng Docker)

```bash
npm install
node server.js
```

---

## 📁 Cấu trúc

```
JiraBot/
├── server.js          # Backend API (Express + SQLite)
├── public/            # Frontend (HTML/JS/CSS)
│   ├── index.html     # Dashboard chính
│   └── login.html     # Trang đăng nhập / đăng ký
├── data/              # SQLite database (auto-created, không commit)
├── docker-compose.yml # Docker Compose config
├── Dockerfile         # Docker image
└── ecosystem.config.js # PM2 config (nếu dùng VPS trực tiếp)
```
