# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm AS python-builder
WORKDIR /build
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.txt \
    && /opt/venv/bin/pip check

FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=5050 \
    HOME=/home/app

# Compilation is provided exclusively by TexCompiler; no TeX distribution here.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app

WORKDIR /app
COPY --from=python-builder /opt/venv /opt/venv
COPY --chown=app:app backend/ ./backend/
COPY --from=frontend-builder --chown=app:app /build/frontend/dist ./frontend/dist
# Only uploads and downloaded PDF artifacts need writable storage.
RUN mkdir -p /app/assets /tmp/resume_dist \
    && chown app:app /app/assets /tmp/resume_dist

USER app
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '5050') + '/login', timeout=3).close()"

# exec makes Uvicorn receive container termination signals directly.
CMD ["sh", "-c", "exec uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-5050} --timeout-graceful-shutdown 180"]
