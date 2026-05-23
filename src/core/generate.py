"""
src/core/generate.py
LaTeX resume generator — fills a .tex template from resume_config.json.
Moved from src/generate.py into the core package; fully standalone.
"""
import json
import os
import re
import sys
from pathlib import Path

# Add project root to sys.path to allow running the script directly
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.core.config import RESUME_CONFIG


def escape_latex(text) -> str:
    if not isinstance(text, str):
        return text
    replacements = {
        '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
        '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}',
    }
    return "".join(replacements.get(c, c) for c in text)


def resolve_modular(val, section_key: str, full_library: dict):
    """Resolve a library key reference (or list of keys) to its actual data."""
    if not val:
        return "" if section_key == "professional_summary" else []

    section_lib = full_library.get(section_key, {})

    if isinstance(val, list):
        if val and isinstance(val[0], dict):
            return val  # already resolved inline objects
        resolved = []
        for item_id in val:
            resolved.append(section_lib.get(item_id, item_id))
        return resolved

    if isinstance(val, str) and val in section_lib:
        return section_lib[val]

    return val


def generate_resume(
    source: str,
    template_path: str,
    output_path: str,
    photo_path: str | None = None,
    role_id: str | None = None,
) -> None:
    """
    Generate a .tex file by filling `template_path` with data from
    `source` (a role_id string or a path to a JSON config file).
    """
    config_file = str(RESUME_CONFIG)

    if os.path.isfile(source):
        with open(source) as f:
            data = json.load(f)
        if "recipes" in data and "library" in data:
            master_config = data
            if not role_id:
                role_id = list(data["recipes"].keys())[0]
            recipe = data["recipes"].get(role_id, {})
        else:
            with open(config_file) as f:
                master_config = json.load(f)
            recipe = data
    else:
        with open(config_file) as f:
            master_config = json.load(f)
        recipe = master_config.get("recipes", {}).get(source, {})
        if not recipe:
            raise ValueError(f"Role ID '{source}' not found in config.")

    personal = master_config.get("personal", {})
    library  = master_config.get("library", {})

    config = {**personal, **recipe}

    MODULAR_SECTIONS = [
        "professional_summary", "role_title", "skills", "projects",
        "education", "certifications", "achievements", "additional_info",
    ]
    for section in MODULAR_SECTIONS:
        config[section] = resolve_modular(config.get(section), section, library)

    with open(template_path) as f:
        tmpl = f.read()

    # ── Simple replacements ───────────────────────────────────────────────────
    tmpl = tmpl.replace("<<NAME>>",       escape_latex(config.get("name", "")))
    tmpl = tmpl.replace("<<ROLE_TITLE>>", escape_latex(config.get("role_title", "")))
    tmpl = tmpl.replace("<<EMAIL>>",      escape_latex(config.get("email", "")))
    tmpl = tmpl.replace("<<PHONE>>",      escape_latex(config.get("phone", "")))
    tmpl = tmpl.replace("<<LINKEDIN>>",   escape_latex(config.get("linkedin", "")))
    tmpl = tmpl.replace("<<GITHUB>>",     escape_latex(config.get("github", "")))
    tmpl = tmpl.replace("<<SUMMARY>>",    escape_latex(config.get("professional_summary", "")))
    edu = config.get("education", "")
    if isinstance(edu, dict):
        inst = escape_latex(edu.get("institution", ""))
        deg = escape_latex(edu.get("degree", ""))
        dt = escape_latex(edu.get("date", ""))
        det = escape_latex(edu.get("details", ""))
        edu_str = f"\\textbf{{{deg}}} \\hfill \\textbf{{{dt}}}\\\\\n{inst}"
        if det:
            edu_str += f" \\hfill {det}"
        edu = edu_str
    tmpl = tmpl.replace("<<EDUCATION>>", edu)



    # ── Skills ────────────────────────────────────────────────────────────────
    skills_tex = ""
    for cat in config.get("skills", []):
        if not isinstance(cat, dict) or cat.get("active") is False:
            continue
        skills_tex += (
            f"{escape_latex(cat.get('name', ''))} & "
            f"{escape_latex(cat.get('keywords', ''))} \\\\\n"
        )
    tmpl = tmpl.replace("<<SKILLS>>", skills_tex)

    # ── Projects ──────────────────────────────────────────────────────────────
    projects_tex = ""
    for proj in config.get("projects", []):
        if not isinstance(proj, dict) or proj.get("active") is False:
            continue
        link_tex = (
            f" \\quad \\href{{{proj.get('link')}}}{{GitHub}}"
            if proj.get("link") else ""
        )
        projects_tex += (
            f"\\textbf{{ {escape_latex(proj.get('name', ''))} }} "
            f"\\hfill \\textit{{ {escape_latex(proj.get('tech', ''))} "
            f"\\quad {escape_latex(proj.get('date', ''))} }} {link_tex}\n"
        )
        projects_tex += "\\begin{itemize}\n"
        for pt in proj.get("points", []):
            projects_tex += f"\\item {escape_latex(pt)}\n"
        projects_tex += "\\end{itemize}\n\\vspace{2pt}\n"
    tmpl = tmpl.replace("<<PROJECTS>>", projects_tex)

    # ── Simple table sections ─────────────────────────────────────────────────
    for key, tag in [
        ("certifications",  "<<CERTIFICATIONS>>"),
        ("achievements",    "<<ACHIEVEMENTS>>"),
        ("additional_info", "<<ADDITIONAL>>"),
    ]:
        tex = ""
        for item in config.get(key, []):
            if not isinstance(item, dict) or item.get("active") is False:
                continue
            if key in ("certifications", "achievements"):
                tex += (
                    f"{escape_latex(item.get('name'))} & "
                    f"{escape_latex(item.get('issuer'))} & "
                    f"{escape_latex(item.get('year', ''))} \\\\\n"
                )
            else:
                if item.get("name") == "Areas of Interest":
                    continue
                tex += (
                    f"{escape_latex(item.get('name'))} & "
                    f"{escape_latex(item.get('content'))} \\\\\n"
                )
        tmpl = tmpl.replace(tag, tex)

    # ── Section toggling ──────────────────────────────────────────────────────
    for sec_name, is_active in config.get("sections", {}).items():
        if is_active is False:
            pattern = (
                rf"% \[SECTION:{sec_name.upper()}\].*?"
                rf"% \[/SECTION:{sec_name.upper()}\]"
            )
            tmpl = re.sub(pattern, "", tmpl, flags=re.DOTALL)

    tmpl = re.sub(r"% \[SECTION:.*?\].*?\n", "", tmpl)
    tmpl = re.sub(r"% \[/SECTION:.*?\].*?\n", "", tmpl)

    with open(output_path, "w") as f:
        f.write(tmpl)
    print(f"Generated LaTeX → {output_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate a resume .tex file")
    parser.add_argument("source",   help="Role ID or path to JSON config file")
    parser.add_argument("template", help="Path to .tex template")
    parser.add_argument("output",   help="Output .tex path")
    parser.add_argument("--role",   help="Role ID when source is a full config file")
    parser.add_argument("--photo",  help="Profile photo path")
    args = parser.parse_args()
    generate_resume(args.source, args.template, args.output, args.photo, args.role)
