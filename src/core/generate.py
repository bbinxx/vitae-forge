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
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)
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

    personal = master_config.get("personal", {}).copy()
    if "personal" in recipe and isinstance(recipe["personal"], dict):
        personal.update(recipe["personal"])
        
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
    tmpl = tmpl.replace("<<COMPANY_NAME>>", escape_latex(config.get("company", config.get("company_name", ""))))
    
    import datetime
    tmpl = tmpl.replace("<<DATE>>",       datetime.datetime.now().strftime("%B %d, %Y"))
    
    tmpl = tmpl.replace("<<EMAIL>>",      escape_latex(config.get("email", "")))
    tmpl = tmpl.replace("<<PHONE>>",      escape_latex(config.get("phone", "")))
    tmpl = tmpl.replace("<<LINKEDIN>>",   escape_latex(config.get("linkedin", "")))
    tmpl = tmpl.replace("<<GITHUB>>",     escape_latex(config.get("github", "")))
    # Support both 'professional_summary' (library recipes) and 'summary' (AI-generated JSON)
    summary_text = config.get("professional_summary") or config.get("summary", "")
    tmpl = tmpl.replace("<<SUMMARY>>", escape_latex(summary_text))
    
    projects = config.get("projects", [])
    proj1 = escape_latex(projects[0].get("name", "")) if len(projects) > 0 and isinstance(projects[0], dict) else "Academic Projects"
    proj2 = escape_latex(projects[1].get("name", "")) if len(projects) > 1 and isinstance(projects[1], dict) else "Personal Projects"
    tmpl = tmpl.replace("<<PROJECT_1>>", proj1)
    tmpl = tmpl.replace("<<PROJECT_2>>", proj2)
    
    skills = config.get("skills", [])
    skill_words = []
    for s in skills:
        if isinstance(s, dict) and s.get("keywords"):
            skill_words.extend([k.strip() for k in s.get("keywords").split(',')])
    relevant_skills = escape_latex(", ".join(skill_words[:5]) if skill_words else "various modern tools")
    tmpl = tmpl.replace("<<RELEVANT_SKILLS>>", relevant_skills)
    
    cover_letter = escape_latex(config.get("cover_letter", ""))
    # Convert newlines to LaTeX paragraph breaks
    cover_letter = cover_letter.replace('\n', '\n\n')
    tmpl = tmpl.replace("<<COVER_LETTER>>", cover_letter)
    edu = config.get("education", "")
    if isinstance(edu, list):
        edu_items = []
        for e in edu:
            if isinstance(e, dict):
                inst = escape_latex(e.get("institution", ""))
                deg = escape_latex(e.get("degree", ""))
                dt = escape_latex(e.get("date") or e.get("year", ""))  # AI JSON uses 'year'
                det = escape_latex(e.get("details", ""))
                edu_str = f"\\textbf{{{deg}}} \\hfill \\textbf{{{dt}}}\\\\\n{inst}"
                if det:
                    edu_str += f" \\hfill {det}"
                edu_items.append(edu_str)
            elif isinstance(e, str):
                edu_items.append(escape_latex(e))
        edu = "\n\n\\vspace{4pt}\n\n".join(edu_items)
    elif isinstance(edu, dict):
        inst = escape_latex(edu.get("institution", ""))
        deg = escape_latex(edu.get("degree", ""))
        dt = escape_latex(edu.get("date") or edu.get("year", ""))  # AI JSON uses 'year'
        det = escape_latex(edu.get("details", ""))
        edu_str = f"\\textbf{{{deg}}} \\hfill \\textbf{{{dt}}}\\\\\n{inst}"
        if det:
            edu_str += f" \\hfill {det}"
        edu = edu_str
    elif not isinstance(edu, str):
        edu = str(edu)
        
    tmpl = tmpl.replace("<<EDUCATION>>", edu)



    # ── Skills ────────────────────────────────────────────────────────────────
    skills_tex = ""
    skills_list = config.get("skills", [])
    if isinstance(skills_list, dict):
        # AI format: {"Languages": ["Java", "Python"]} -> internal format
        skills_list = [
            {"name": k, "keywords": ", ".join(v) if isinstance(v, list) else str(v)}
            for k, v in skills_list.items()
        ]
        
    for cat in skills_list:
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
        tech = proj.get("tech", proj.get("technologies", ""))
        date = proj.get("date", "")
        
        date_str = f"\\quad {escape_latex(date)}" if date else ""
        
        projects_tex += (
            f"\\textbf{{ {escape_latex(proj.get('name', ''))} }} "
            f"\\hfill \\textit{{ {escape_latex(tech)} "
            f"{date_str} }} {link_tex}\n"
        )
        projects_tex += "\\begin{itemize}\n"
        points = proj.get("points", proj.get("highlights", []))
        if isinstance(points, list):
            for pt in points:
                projects_tex += f"\\item {escape_latex(pt)}\n"
        elif isinstance(points, str) and points:
            projects_tex += f"\\item {escape_latex(points)}\n"
            
        projects_tex += "\\end{itemize}\n\\vspace{3pt plus 0.25fill minus 2pt}\n"
    tmpl = tmpl.replace("<<PROJECTS>>", projects_tex)

    # ── Simple table sections ─────────────────────────────────────────────────
    for key, tag in [
        ("certifications",  "<<CERTIFICATIONS>>"),
        ("achievements",    "<<ACHIEVEMENTS>>"),
        ("additional_info", "<<ADDITIONAL>>"),
    ]:
        tex = ""
        items = config.get(key, [])

        if key == "additional_info":
            # AI JSON format: {"areas_of_interest": "...", "languages": "..."}
            # Library format: [{"name": "Languages", "content": "..."}, ...]
            # Normalise both into a canonical list, then render Languages first.
            if isinstance(items, dict):
                # Build ordered pair: Languages row first, then Areas of Interest
                lang_val = items.get("languages", "")
                aoi_val  = items.get("areas_of_interest", "")
                normalised = []
                if lang_val:
                    normalised.append({"name": "Languages",         "content": lang_val})
                if aoi_val:
                    normalised.append({"name": "Areas of Interest", "content": aoi_val})
                items = normalised
            elif isinstance(items, list):
                # Library format — sort so Languages always comes first
                lang_items = [i for i in items if isinstance(i, dict) and "language" in i.get("name","").lower()]
                aoi_items  = [i for i in items if isinstance(i, dict) and "interest" in i.get("name","").lower()]
                other      = [i for i in items if isinstance(i, dict)
                              and "language" not in i.get("name","").lower()
                              and "interest"  not in i.get("name","").lower()]
                items = lang_items + aoi_items + other

            for item in items:
                if not isinstance(item, dict) or item.get("active") is False:
                    continue
                content_val = item.get("content", item.get("keywords", ""))
                tex += (
                    f"{escape_latex(item.get('name', ''))} & "
                    f"{escape_latex(content_val)} \\\\\n"
                )
        else:
            for item in items:
                if not isinstance(item, dict) or item.get("active") is False:
                    continue
                tex += (
                    f"{escape_latex(item.get('name'))} & "
                    f"{escape_latex(item.get('issuer'))} & "
                    f"{escape_latex(item.get('year', ''))} \\\\\n"
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
