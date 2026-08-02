# Antigravity Resume Studio

> A high-automation, modular LaTeX resume system and application tracker designed for a SaaS-like multi-tenant architecture. Features concurrent compilation, centralized cloud data, professional SDLC processes, and zero-touch deployment.

---

## System Architecture

The application has been refactored from a single-user local file system approach to a robust, multi-tenant cloud application. 

### Core Pillars
1. **Multi-Tenant Design**: User data is isolated and loaded securely via authentication states.
2. **Database Agnostic**: The backend utilizes the Repository Pattern (Controller-Service-Repository), making it trivial to switch between Firebase Firestore, local JSON, MongoDB, or PostgreSQL.
3. **Dual-Template Strategy**: Every role generates two variants automatically:
    - Standard (`.pdf`): Clean, minimalist, and ATS-friendly.
    - Modern (`_X.pdf`): A professional layout including profile photos, optimized for networking.
4. **Elastic Single-Page Guarantee**: Dynamic rubber-length spacing (using LaTeX `plus` and `minus` parameters) and margin-overflow limits stretch seamlessly to fill empty space.

---

## SDLC & Professional Workflows

This repository implements a professional Software Development Life Cycle (SDLC):

### Continuous Integration (CI)
Automated GitHub Actions (`ci.yml`) run on every Pull Request and push to `main`:
- Validates code formatting and syntax using `flake8`.
- Ensures no breaking code changes are merged into production.

### Continuous Deployment (CD)
Automated GitHub Actions (`cd.yml`) trigger on version tags (e.g. `v1.0.0`):
- Builds the optimized Docker image.
- Pushes to GitHub Container Registry (`ghcr.io`).
- Ready for zero-downtime deployment to target cloud platforms (Cloud Run, ECS, etc).

### Production Docker Environment
The `Dockerfile` is optimized using `python:3.11-slim`, installing only the required `texlive` dependencies to keep the image lightweight while guaranteeing LaTeX compilation capabilities in the cloud.

---

## How it Works

### 1. Data Models
Data is structured dynamically per user:
*   **Settings**: Stores custom prefixes, export folders, and configuration preferences.
*   **Library**: A flattened database of all reusable content pieces (projects, skills, certifications).
*   **Recipes**: Defines each resume role variation by linking to items in the Library.
*   **Applications**: The Job Tracker database logging timelines, interview rounds, and dynamically generated single-use resumes.

### 2. High-Performance Build Engine
The build orchestrator (`src/core/build.py`) utilizes a Concurrent Thread Pool. The engine triggers the heavy `pdflatex` processes simultaneously across CPU cores, cutting build times drastically. Built artifacts are pushed directly to a Cloudflare R2 bucket.

---

## Usage & Operations

### Unified Control Center
The system is managed through a menu-driven CLI or Docker:
```bash
./run.sh
```
This script handles:
- Starting the Resume Studio (FastAPI dashboard)
- Building all variants concurrently
- Targeting specific roles
- Cleaning workspace
- Syncing to Cloud (Cloudflare R2)

### Resume Studio (Visual Dashboard)
Accessible locally at `http://localhost:5050` or via your deployed domain. 
- **Live Preview**: View generated PDFs instantly in the browser.
- **Application Tracker**: Track your entire job pipeline. Create status timelines, log salaries, and automatically map exact resume PDF versions to specific companies.
- **Snapshot Builder**: Create a highly customized, one-off resume clone tailored for a specific job application without mutating your base recipes.
- **Cloud Sync**: Batch operations upload all resumes to an R2 bucket, supplying pre-signed URLs for easy sharing.

---

## Repository Structure
```
.
├── .github/workflows/       # CI/CD pipelines
├── src/                     # Python logic (Controllers, Services, Repositories)
├── templates/               # LaTeX (.tex) and Dashboard (.html) templates
├── assets/                  # Default profile photos and static assets
├── logs/                    # Build logs
├── Dockerfile               # Production container image
└── requirements.txt         # Dependencies
```

---
*Built with Python, FastAPI, React, and LaTeX | Status: Production Ready*
