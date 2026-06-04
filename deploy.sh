#!/bin/bash
# deploy.sh — Chạy trên VPS để pull code mới và restart app
set -e

APP_DIR="/var/www/jirabot"

echo "📦 Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "📚 Installing dependencies..."
npm ci --omit=dev

echo "🔄 Restarting PM2..."
pm2 reload ecosystem.config.js --update-env

echo "✅ Deploy thành công!"
pm2 status jirabot
