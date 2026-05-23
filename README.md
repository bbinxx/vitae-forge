# YOUR NAME - Automated Multi-Role Resume System

> A high-automation, modular LaTeX resume system that generates multiple variants from a single master configuration file. Features concurrent compilation, elastic 1-page bounds, centralized data, two modern templates (Photo & Standard), and zero-touch deployment.

---

## System Architecture

This is the ultimate evolution of the modular resume system. Everything—your contact info, your entire career history, and all your resume role recipes—lives in one single file.

### Dual-Template Strategy
Every role generates two variants automatically:
1.  Standard (.pdf): Clean, minimalist, and 100% ATS-friendly.
2.  Modern (_X.pdf): A professional layout including your profile photo, optimized for networking.

### Elastic Single-Page Guarantee
Both templates feature dynamic rubber-length spacing (using LaTeX `plus` and `minus` parameters) and margin-overflow limits. The layout stretches seamlessly to fill empty space and smartly compresses gaps if content overflows, guaranteeing a beautiful layout that never artificially triggers a second page.

---

## How it Works

### 1. The "One True File" (configs/resume_config.json)
The entire system is powered by this one file, divided into three sections:
*   personal: Your name and contact details.
*   library: A flattened database of all your reusable content pieces. Each project, skill, and certification has a unique ID (e.g., "nasa_2024").
*   recipes: Defines each of your resume roles.
    *   Item Selection: Add or remove item IDs from arrays to pull content into a resume.
    *   sections: A nested boolean map to show/hide any top-level layout block.

### Advanced: Toggle Anything
You can wrap any part of the LaTeX templates with % [SECTION:NAME] and % [/SECTION:NAME] markers. Then, add "NAME": true/false to your recipe's sections config to toggle that specific block.

### 2. High-Performance Build Engine
The build orchestrator (`src/core/build.py`) utilizes a Concurrent Thread Pool. Instead of compiling sequentially, the engine triggers the heavy `pdflatex` processes simultaneously across your CPU cores, cutting build times from 30+ seconds down to under 5 seconds!

---

## Usage & Operations

### Updating Everything
1.  Open configs/resume_config.json.
2.  Edit your career history in the library section.
3.  Add or tweak a resume role in the recipes section.

### Unified Control Center
The entire system is managed through a single menu-driven script:
```bash
./run.sh
```
This script handles:
- Starting Resume Studio (Visual Dashboard)
- Building all variants concurrently
- Targeting specific roles
- Cleaning workspace
- Syncing to Cloud (Cloudflare R2)
- Tagging versions for CI/CD

### Resume Studio (Visual Dashboard)
Accessible via `./run.sh` [Option 1]. Powered by Google Material Symbols for a sleek, modern UI.
- Live Preview: View generated PDFs instantly in the browser.
- Application Tracker: Track your entire job pipeline. Create status timelines, log salaries, and automatically map exact resume PDF versions sent to specific companies.
- Snapshot Builder: Found inside the Application Tracker. Create a highly customized, one-off resume clone tailored for a specific job application without mutating your base recipes.
- Batch Operations: Use the 'Build All' and 'Upload All' tools to instantly generate and deploy all your resumes to your Cloudflare R2 bucket.
- ZIP Bundler: Download a portable LaTeX package for any variant.

---

## Repository Structure
```
.
├── configs/                 # THE ONLY FILE YOU NEED TO EDIT (JSON)
├── templates/               # LaTeX (.tex) and Dashboard (.html) templates
├── src/                     # Python logic and build scripts
├── assets/                  # Profile photo and static assets
├── dist/                    # Final PDF artifacts and Tracker DB
└── logs/                    # Build logs
```

---
*Built with Python, Bash, and LaTeX | Status: Fully Automated*
