"""
src/core/config.py
Single source of truth for all project paths and config I/O helpers.
"""
from pathlib import Path
import json

# ── Root Paths ────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent.parent
CONFIGS_DIR = ROOT / "configs"
DIST_DIR    = Path("/tmp/resume_dist")
LOG_DIR     = Path("/tmp/resume_logs")
ASSETS_DIR  = ROOT / "assets"
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
TEX_DIR     = TEMPLATES_DIR / "tex"
PROFILE_PHOTO = ASSETS_DIR / "profile-photo.jpg"
ENV_FILE    = ROOT / ".env"

DEFAULT_STARTER_CONFIG = {
  "personal": {
    "name": "YOUR NAME",
    "email": "your.email@example.com",
    "phone": "+1 (555) 000-0000",
    "linkedin": "your-linkedin",
    "github": "your-github"
  },
  "role_title": "Software Engineer",
  "summary": "Software Engineer specializing in full-stack development, backend engineering, and AI-powered applications. Skilled in Python, JavaScript, React.js, Node.js, Retrieval-Augmented Generation (RAG), and REST APIs. Passionate about building reliable software and continuously expanding knowledge in cloud technologies and DevOps.",
  "alternative_summaries": {
    "stack_focused": "Software Engineer with experience in Python, JavaScript, React.js, and Node.js. Skilled in developing full-stack applications, REST APIs, and AI-powered solutions using modern cloud technologies.",
    "problem_solver": "Adaptable Software Engineer with a strong foundation in full-stack development, backend architecture, and cloud technologies. Passionate about solving complex problems, writing maintainable code, and delivering reliable, user-focused applications.",
    "ai_aware": "Software Engineer specializing in full-stack development, cloud platforms, and AI-powered applications. Experienced in building responsive interfaces, backend systems, and Retrieval-Augmented Generation (RAG) solutions using AWS Bedrock."
  },
  "skills": {
    "Languages": ["Python", "JavaScript", "Java", "C"],
    "Web Development": ["React.js", "Node.js", "Next.js", "REST APIs"],
    "Frameworks": ["Express.js", "Flask", "Django", "Flutter"],
    "Databases": ["MongoDB", "MySQL", "Supabase"],
    "Developer Tools": ["Git", "GitHub", "Linux", "Docker", "Jira", "Postman"],
    "Deployment": ["AWS", "DigitalOcean", "Cloudflare", "Render", "Vercel"]
  },
  "experience": [
    {
      "role": "Software Engineer Trainee",
      "company": "Softnotions Technologies",
      "location": "Technopark, Thiruvananthapuram, Kerala",
      "date": "July 2026 – Present",
      "highlights": [
        "Built Retrieval-Augmented Generation (RAG) pipelines using AWS Bedrock Knowledge Bases for intelligent document search and contextual querying.",
        "Developed production-ready MERN applications featuring responsive React.js frontends and scalable REST APIs using Node.js and Express.js.",
        "Collaborated through GitHub workflows, pull requests, peer code reviews, and Jira-based Agile task management.",
        "Diagnosed application issues, configured development environments, and validated software releases to improve deployment reliability."
      ]
    }
  ],
  "projects": [
    {
      "name": "AI-Based Smart Traffic System Using Computer Vision",
      "technologies": "Python, YOLOv8, Flask",
      "highlights": [
        "Engineered a YOLOv8 object detection pipeline achieving 94% accuracy for real-time vehicle tracking.",
        "Implemented adaptive traffic signal control logic, increasing simulated intersection throughput by 25%.",
        "Developed low-latency Flask REST APIs supporting real-time edge inference with response times below 200 ms."
      ]
    },
    {
      "name": "Will It Rain? – Weather Risk Prediction System",
      "technologies": "React.js, Leaflet, Chart.js, NASA POWER API",
      "highlights": [
        "Built a climate analytics platform leveraging NASA POWER datasets for rainfall risk forecasting.",
        "Created interactive geospatial dashboards visualizing weather trends and probabilistic insights.",
        "Implemented structured CSV and JSON export capabilities for reporting and planning workflows."
      ]
    },
    {
      "name": "Certificate Generator and Verification System",
      "technologies": "Node.js, Firebase, EJS, Tailwind CSS",
      "highlights": [
        "Automated certificate generation for over 1,000 records, reducing manual processing effort by 90%.",
        "Integrated QR-code verification enabling instant and secure credential authentication.",
        "Developed an administrative certificate designer supporting customizable templates and layouts."
      ]
    },
    {
      "name": "IRRIGO – Smart Irrigation Platform",
      "technologies": "Next.js, Flask, Python, REST APIs",
      "highlights": [
        "Developed a smart irrigation platform integrating satellite imagery and weather data APIs for irrigation optimization.",
        "Reduced water consumption by 20% through data-driven evaluation across 50+ agricultural scenarios.",
        "Designed real-time environmental monitoring dashboards for irrigation analytics and visualization."
      ]
    }
  ],
  "education": {
    "degree": "B.Tech in Computer Science and Engineering",
    "institution": "Mar Baselios Christian College of Engineering and Technology",
    "year": "2026"
  },
  "certifications": [
    { "name": "Ubuntu Linux Professional Certificate", "issuer": "Canonical", "year": "November 2025" },
    { "name": "JavaScript Foundations Professional Certificate", "issuer": "Mozilla", "year": "July 2025" },
    { "name": "Amazon API Gateway for Serverless Applications", "issuer": "AWS Training", "year": "June 2025" },
    { "name": "Python for Data Science", "issuer": "NPTEL – IIT Madras", "year": "2024" },
    { "name": "Programming with Python", "issuer": "Python Institute OpenEDG", "year": "2024" }
  ],
  "achievements": [
    { "name": "Global Nominee", "issuer": "NASA Space Apps Challenge", "year": "2025" },
    { "name": "Global Connection Recognition Award", "issuer": "NASA Space Apps Challenge", "year": "2025" },
    { "name": "Galactic Problem Solver Award", "issuer": "NASA Space Apps Challenge", "year": "2024" }
  ],
  "additional_info": {
    "areas_of_interest": "Full-Stack Development, Artificial Intelligence, Cloud Computing, Backend Systems",
    "languages": "English, Malayalam"
  },
  "cover_letter": "Dear Hiring Manager,\n\nI am excited to apply for the Software Engineer position. I recently completed my Bachelor of Technology in Computer Science and Engineering and currently work as a Software Engineer Trainee at Softnotions Technologies. In my current role, I develop full-stack MERN applications, build Retrieval-Augmented Generation (RAG) solutions using AWS Bedrock Knowledge Bases, and develop scalable REST APIs supporting production-ready applications.\n\nBeyond my professional experience, I have built projects in artificial intelligence, cloud computing, computer vision, and full-stack web development, strengthening my problem-solving, software engineering, and collaboration skills. I enjoy learning new technologies, collaborating within Agile teams, and delivering reliable, maintainable software solutions.\n\nI am eager to contribute my technical skills, enthusiasm, and commitment to continuous learning to your engineering team. Thank you for your time and consideration. I look forward to discussing how my skills and experience can contribute to your organization.\n\nSincerely,\nYOUR NAME",
  "layout": {
    "one_page": True,
    "ats_optimized": True,
    "photo": False
  },
  "sections": {
    "role_title": True,
    "photo": False,
    "summary": True,
    "skills": True,
    "experience": True,
    "projects": True,
    "education": True,
    "certifications": True,
    "achievements": True,
    "languages": True,
    "areas_of_interest": False
  }
}

import copy

def load_resume_config() -> dict:
    """Return default starter resume configuration (in-memory)."""
    return copy.deepcopy(DEFAULT_STARTER_CONFIG)

# ── LaTeX Templates ───────────────────────────────────────────────────────────
TEMPLATE_PLAIN = TEX_DIR / "template.tex"
TEMPLATE_PHOTO = TEX_DIR / "template_photo.tex"
TEMPLATE_COVER_LETTER = TEX_DIR / "cover_letter.tex"

def ensure_dirs() -> None:
    """Make sure all required output directories exist."""
    for d in (DIST_DIR, LOG_DIR, ASSETS_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ── LaTeX Compiler Discovery ──────────────────────────────────────────────────

def find_pdflatex() -> str | None:
    """Locate the pdflatex executable (system PATH or TinyTeX fallback)."""
    import shutil, glob, os
    cmd = shutil.which("pdflatex")
    if cmd:
        return cmd
    tinytex = glob.glob(os.path.expanduser("~/.TinyTeX/bin/*/pdflatex"))
    return tinytex[0] if tinytex else None
