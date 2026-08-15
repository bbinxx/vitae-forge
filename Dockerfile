# Stage 1: Build React SPA Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python + TeX Live Environment
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=5050 \
    PYTHONDONTWRITEBYTECODE=1

# Install TeX Live (LaTeX) and system dependencies for PDF compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-extra \
    cm-super \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application backend and configuration files
COPY . .

# Copy built React frontend bundle from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 5050

# Start unified single-server FastAPI container
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-5050}"]
