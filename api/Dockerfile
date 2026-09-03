FROM node:22-bookworm-slim AS frontend-build

WORKDIR /build/frontend

COPY api/frontend/package*.json ./
RUN npm ci

COPY api/frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    HOST=0.0.0.0 \
    PORT=5000 \
    DATABASE_PATH=/data/database.db \
    UPLOAD_DIR=/data/uploads \
    SECRET_KEY_FILE=/data/.secret_key \
    ADMIN_CREDS_FILE=/data/admin_credentials.txt \
    MAX_UPLOAD_MB=200

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api ./api
COPY src ./src
COPY --from=frontend-build /build/frontend/dist ./api/frontend/dist

RUN mkdir -p /data/uploads /app/reports

WORKDIR /app

EXPOSE 5000

CMD ["gunicorn", "-b", "0.0.0.0:5000", "api.app:app"]
