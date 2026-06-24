# Redeploy marker: 2026-06-01 Google auth client ID
FROM node:24-alpine AS frontend

WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
ENV VITE_API_URL=
ENV VITE_GOOGLE_CLIENT_ID=39326050245-27vfptarof8c1s0qv3lcdpvkmpk0u6te.apps.googleusercontent.com
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production
ENV PORT=5000
ENV STATIC_DIR=/app/server/static
ENV PDF_STORAGE_PATH=/app/server/storage/pdfs
ENV SETUP_SQL_PATH=/app/MASTER_SETUP_POSTGRES_v5.sql

WORKDIR /app

COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./server/
COPY MASTER_SETUP_POSTGRES_v5.sql ./MASTER_SETUP_POSTGRES_v5.sql
COPY pdfs/ ./server/storage/pdfs/
COPY --from=frontend /app/dist ./server/static/

WORKDIR /app/server

EXPOSE 5000

CMD python migrate.py && gunicorn "app:create_app()" --bind "0.0.0.0:${PORT}" --workers 2 --timeout 120
