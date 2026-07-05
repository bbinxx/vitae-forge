# Vitae Forge Deployment Guide

Vitae Forge is a modern FastAPI application that features live PDF generation. Because it relies on **TeX Live (`pdflatex`)**, deploying it correctly depends on the host platform's capabilities.

This guide covers deployment across the most popular cloud platforms.

---

## 🏗️ Platform Support Matrix

| Platform | Type | PDF Compilation (`pdflatex`) | Recommended For |
|----------|------|------------------------------|-----------------|
| **Render** | Docker | ✅ Fully Supported | Production Backend |
| **DigitalOcean** | App Platform (Docker) | ✅ Fully Supported | Production Backend |
| **Railway** | Docker | ✅ Fully Supported | Production Backend |
| **Vercel** | Serverless Python | ❌ Fails (Size Limits) | Job Tracking / API only |
| **Netlify** | Static + Edge | ❌ Proxy Only | Decoupled Frontend |

> **⚠️ The Vercel Limitation:** Vercel serverless functions have strict size limits (50MB - 250MB) and do not support installing TeX Live (which is over 1GB). If you deploy the backend on Vercel, the app will run, but clicking "Compile PDF" will throw an error. You must use the "Download ZIP" feature and compile your resume on Overleaf.

---

## 🔑 Prerequisites (All Platforms)

Before deploying, ensure you have the following secrets ready to add as Environment Variables:

1. **`JWT_SECRET`**: A long, random string (e.g., `openssl rand -hex 32`).
2. **`PASSCODE_HASH`** (Optional): A bcrypt hash of the password you want to use to lock the app.
3. **`FIREBASE_SERVICE_ACCOUNT`**: The full JSON string of your Firebase service account key. Ensure you minify it into a single line.
4. **Cloudflare R2**:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`

---

## 1. Deploying to Render (⭐ Recommended)

Render natively supports Docker, making it the perfect host for the `pdflatex` dependency.

### Option A: Using `render.yaml` (Infrastructure as Code)
1. Fork or push the repository to your GitHub account.
2. In the Render Dashboard, go to **Blueprints**.
3. Connect your repository. Render will detect the `render.yaml` file.
4. Render will prompt you for the required Environment Variables.
5. Click **Apply**.

### Option B: Manual Setup
1. In Render, create a new **Web Service**.
2. Connect your GitHub repository.
3. Environment: **Docker** (Render will automatically use the `Dockerfile`).
4. Region: Choose your closest region (e.g., Frankfurt or Ohio).
5. Add the Environment Variables (Prerequisites).
6. Click **Create Web Service**.

> **Note:** The `render.yaml` is configured with `autoDeploy: false` to prevent accidental overwrites. You can change this in the Render dashboard or directly in the YAML file.

---

## 2. Deploying to DigitalOcean App Platform

DigitalOcean is another excellent Docker-compatible host.

1. Go to the DigitalOcean **Apps** dashboard.
2. Click **Create App**.
3. Connect your GitHub repository.
4. The platform will automatically detect the `app.yaml` file in the root directory.
5. Fill in the required Environment Variables.
6. Review the deployment and click **Create Resources**.

---

## 3. Deploying to Vercel (Job Tracker Only)

If you only need the Job Tracker and are comfortable compiling your downloaded `.tex` files locally or on Overleaf, Vercel is extremely fast and free.

1. Ensure you have the Vercel CLI or use the Vercel Dashboard.
2. Import your GitHub repository.
3. The project includes a `vercel.json` file which configures Vercel to run `src/app.py` as a Serverless Python function.
4. Add your Environment Variables in the Vercel Dashboard.
5. Click **Deploy**.

> **Static Asset Optimization:** The `vercel.json` applies aggressive caching (`Cache-Control: public, max-age=31536000, immutable`) to all files in the `/static/` directory to ensure instantaneous page loads.

---

## 4. Deploying to Netlify (Frontend Proxy)

You can use Netlify to host the frontend while pointing API requests to a backend hosted on Render. This is useful if you want Netlify's global edge caching for static assets.

1. Import your repository to Netlify.
2. Netlify will detect the `netlify.toml` file.
3. Before deploying, edit `netlify.toml` to replace `https://your-app.onrender.com` with your actual Render deployment URL.
4. Netlify will serve the frontend from `templates/` and `static/` and proxy `/api/*` and `/health` to Render.

---

## 🩺 Zero-Downtime Health Checks

The application features a `/health` endpoint (`GET /health`). 
Platforms like Render and DigitalOcean use this endpoint to verify that a new deployment is fully booted before routing traffic to it, ensuring zero-downtime updates.
