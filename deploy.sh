#!/bin/bash
# deploy-docker.sh — Chạy trên VPS để pull code mới và rebuild Docker container
set -e

echo "📦 Pulling latest code..."
git pull origin main

echo "🔄 Rebuilding and restarting Docker container..."
docker compose up -d --build

echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deploy thành công!"
docker compose ps
