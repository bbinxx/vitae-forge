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

from backend.core.config import load_resume_config


_LATEX_ESCAPE = {
    ord('&'): r'\&', ord('%'): r'\%', ord('$'): r'\$',
    ord('#'): r'\#', ord('_'): r'\_',
    ord('{'): r'\{', ord('}'): r'\}',
    ord('~'): r'\textasciitilde{}', ord('^'): r'\textasciicircum{}',
}

def escape_latex(text) -> str:
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)
    return text.translate(_LATEX_ESCAPE)


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
    user_id: str | None = None,
) -> None:
    """
    Generate a .tex file by filling `template_path` with data from
    `source` (a role_id string or a path to a JSON config file).
    """
    if os.path.isfile(source):
        with open(source) as f:
            data = json.load(f)
        if "recipes" in data and "library" in data:
            master_config = data
            if not role_id:
                # If no role specified but has recipes, use the first one if any exist
                if data["recipes"]:
                    role_id = list(data["recipes"].keys())[0]
                else:
                    role_id = None
            recipe = data["recipes"].get(role_id, {}) if role_id else {}
        else:
            if user_id:
                from backend.services.resume_service import get_full_config
                master_config = get_full_config(user_id)
            else:
                master_config = load_resume_config()
            rec_obj = data.get("recipe") if (isinstance(data, dict) and "recipe" in data) else (data.get("resume_template") if (isinstance(data, dict) and "resume_template" in data) else None)
            if isinstance(rec_obj, dict):
                recipe = dict(rec_obj)
                if "cover_letter" not in recipe and "email" in data:
                    recipe["cover_letter"] = data["email"]
                elif "cover_letter" in data and "cover_letter" not in recipe:
                    recipe["cover_letter"] = data["cover_letter"]
            else:
                recipe = data
    else:
        if user_id:
            from backend.services.resume_service import get_full_config
            master_config = get_full_config(user_id)
        else:
            master_config = load_resume_config()
        recipe = master_config.get("recipes", {}).get(source, {})
        if not recipe:
            raise ValueError(f"Role ID '{source}' not found in config.")

    personal = {}
    if isinstance(master_config, dict) and "personal" in master_config and isinstance(master_config["personal"], dict):
        personal.update(master_config["personal"])

    if 'data' in locals() and isinstance(data, dict):
        if "personal" in data and isinstance(data["personal"], dict):
            personal.update(data["personal"])
        for pfield in ("name", "email", "phone", "linkedin", "github"):
            if data.get(pfield):
                personal[pfield] = data[pfield]

    if isinstance(recipe, dict):
        if "personal" in recipe and isinstance(recipe["personal"], dict):
            personal.update(recipe["personal"])
        for pfield in ("name", "email", "phone", "linkedin", "github"):
            if recipe.get(pfield):
                personal[pfield] = recipe[pfield]

    library  = master_config.get("library", {})
    if "library" in recipe and isinstance(recipe["library"], dict):
        # Merge recipe's library over master_config's library
        merged_lib = {}
        for k, v in library.items():
            merged_lib[k] = dict(v)
        for k, v in recipe["library"].items():
            if k not in merged_lib:
                merged_lib[k] = {}
            merged_lib[k].update(v)
        library = merged_lib

    config = {**personal, **recipe}
    for pfield in ("name", "email", "phone", "linkedin", "github"):
        if personal.get(pfield):
            config[pfield] = personal[pfield]

    MODULAR_SECTIONS = [
        "professional_summary", "role_title", "skills", "experience", "projects",
        "education", "certifications", "achievements", "additional_info",
    ]
    for section in MODULAR_SECTIONS:
        config[section] = resolve_modular(config.get(section), section, library)

    with open(template_path) as f:
        tmpl = f.read()    # Helper to safely extract string from possible dict/list/string values
    def _str_field(val, preferred_keys=None):
        if not val:
            return ""
        if isinstance(val, str):
            return val
        if isinstance(val, dict) and preferred_keys:
            for k in preferred_keys:
                if val.get(k) and isinstance(val.get(k), str):
                    return val.get(k)
        return ""

    # ── Styling & Preamble Tokens ─────────────────────────────────────────────
    styling = config.get("styling", {}) if isinstance(config.get("styling"), dict) else {}
    tmpl = tmpl.replace("<<FONT_SIZE>>",         styling.get("font_size", "10pt"))
    tmpl = tmpl.replace("<<MARGIN_LEFT>>",       styling.get("margin_left", "0.45in"))
    tmpl = tmpl.replace("<<MARGIN_RIGHT>>",      styling.get("margin_right", "0.45in"))
    tmpl = tmpl.replace("<<MARGIN_TOP>>",        styling.get("margin_top", "0.3in"))
    tmpl = tmpl.replace("<<MARGIN_BOTTOM>>",     styling.get("margin_bottom", "0.3in"))
    tmpl = tmpl.replace("<<PRIMARY_COLOR_HEX>>", styling.get("primary_color_hex", "000000"))
    tmpl = tmpl.replace("<<RULE_THICKNESS>>",    styling.get("rule_thickness", "0.5pt"))

    user_name = escape_latex(_str_field(config.get("name"), ["name"]))
    tmpl = tmpl.replace("<<NAME>>",       user_name)
    tmpl = tmpl.replace("<<ROLE_TITLE>>", escape_latex(_str_field(config.get("role_title"), ["role_title", "title", "role"])))
    tmpl = tmpl.replace("<<COMPANY_NAME>>", escape_latex(_str_field(config.get("company", config.get("company_name")), ["name", "company"])))
    
    import datetime
    tmpl = tmpl.replace("<<DATE>>",       datetime.datetime.now().strftime("%B %d, %Y"))
    
    email_val = _str_field(config.get("email"), ["email", "address"])
    phone_val = _str_field(config.get("phone"), ["phone", "number"])
    
    raw_linkedin = _str_field(config.get("linkedin"), ["linkedin", "url"])
    clean_linkedin = raw_linkedin.replace("https://", "").replace("http://", "").replace("www.", "").strip()
    if clean_linkedin.startswith("linkedin.com/in/"):
        clean_linkedin = clean_linkedin[len("linkedin.com/in/"):]
    elif clean_linkedin.startswith("linkedin.com/"):
        clean_linkedin = clean_linkedin[len("linkedin.com/"):]

    raw_github = _str_field(config.get("github"), ["github", "url"])
    clean_github = raw_github.replace("https://", "").replace("http://", "").replace("www.", "").strip()
    if clean_github.startswith("github.com/"):
        clean_github = clean_github[len("github.com/"):]

    placeholder_emails = config.get("placeholder_emails", ["your.email@example.com", "email@example.com"])
    if email_val in placeholder_emails and (phone_val or clean_linkedin or clean_github):
        email_val = ""

    # Construct clean contact line (horizontal with configurable delimiter or custom items)
    contact_parts = []
    custom_contact_items = config.get("contact_items")
    if isinstance(custom_contact_items, list) and custom_contact_items:
        for item in custom_contact_items:
            if isinstance(item, dict):
                label = escape_latex(item.get("label") or item.get("value", ""))
                href = item.get("href") or item.get("url")
                if href:
                    contact_parts.append(f"\\href{{{href}}}{{{label}}}")
                elif label:
                    contact_parts.append(label)
            elif isinstance(item, str) and item:
                contact_parts.append(escape_latex(item))
    else:
        if email_val:
            contact_parts.append(f"\\href{{mailto:{email_val}}}{{{escape_latex(email_val)}}}")
        if phone_val:
            import re as _re
            clean_tel = _re.sub(r'[^\d+]', '', phone_val)
            contact_parts.append(f"\\href{{tel:{clean_tel}}}{{{escape_latex(phone_val)}}}")
        if clean_linkedin:
            contact_parts.append(f"\\href{{https://linkedin.com/in/{clean_linkedin}}}{{linkedin.com/in/{escape_latex(clean_linkedin)}}}")
        if clean_github:
            contact_parts.append(f"\\href{{https://github.com/{clean_github}}}{{github.com/{escape_latex(clean_github)}}}")

    contact_delimiter = config.get("contact_delimiter", " ~$|$~ ")
    contact_line = contact_delimiter.join(contact_parts)
    contact_stack = "\\\\[3pt]\n".join(contact_parts)

    tmpl = tmpl.replace("<<CONTACT_LINE>>", contact_line)
    tmpl = tmpl.replace("<<CONTACT_STACK>>", contact_stack)
    tmpl = tmpl.replace("<<EMAIL>>",      escape_latex(email_val))
    tmpl = tmpl.replace("<<PHONE>>",      escape_latex(phone_val))
    tmpl = tmpl.replace("<<LINKEDIN>>",   escape_latex(clean_linkedin))
    tmpl = tmpl.replace("<<GITHUB>>",     escape_latex(clean_github))

    # Support both 'professional_summary' (library recipes) and 'summary' (AI-generated JSON)
    summary_text = config.get("professional_summary") or config.get("summary", "")
    if isinstance(summary_text, dict):
        summary_text = summary_text.get("text") or summary_text.get("content") or summary_text.get("summary") or ""
    elif isinstance(summary_text, list):
        summary_text = " ".join(str(s) for s in summary_text)
    elif not isinstance(summary_text, str):
        summary_text = str(summary_text) if summary_text else ""
    tmpl = tmpl.replace("<<SUMMARY>>", escape_latex(summary_text))
    
    projects = config.get("projects", [])
    proj1 = escape_latex(projects[0].get("name", "")) if len(projects) > 0 and isinstance(projects[0], dict) else ""
    proj2 = escape_latex(projects[1].get("name", "")) if len(projects) > 1 and isinstance(projects[1], dict) else ""
    tmpl = tmpl.replace("<<PROJECT_1>>", proj1)
    tmpl = tmpl.replace("<<PROJECT_2>>", proj2)
    
    skills = config.get("skills", [])
    skill_words = []
    for s in skills:
        if isinstance(s, dict) and s.get("keywords"):
            skill_words.extend([k.strip() for k in s.get("keywords").split(',')])
    relevant_skills = escape_latex(", ".join(skill_words[:5])) if skill_words else ""
    tmpl = tmpl.replace("<<RELEVANT_SKILLS>>", relevant_skills)
    
    raw_cl = config.get("cover_letter", "")
    if isinstance(raw_cl, dict):
        raw_cl = raw_cl.get("body") or raw_cl.get("content") or raw_cl.get("letter") or ""
    elif isinstance(raw_cl, list):
        parts = []
        for item in raw_cl:
            if isinstance(item, dict):
                parts.append(item.get("body") or item.get("content") or item.get("text") or "")
            elif isinstance(item, str):
                parts.append(item)
        raw_cl = "\n\n".join(filter(None, parts))
    elif not isinstance(raw_cl, str):
        raw_cl = str(raw_cl) if raw_cl else ""
    cover_letter = escape_latex(raw_cl)
    cover_letter = re.sub(r'\r\n', '\n', cover_letter)
    cover_letter = re.sub(r'\n{3,}', '\n\n', cover_letter)
    cover_letter = cover_letter.replace('\n', '\n\n')
    
    # Strip signature dynamically matching user name
    name_regex_part = re.escape(user_name) if user_name else r'YOUR_NAME'
    cover_letter = re.sub(
        rf'\n*((Sincerely|Best regards|Yours sincerely|Yours faithfully|Regards|Thanks?)[,\s]*)?\n*\\n?(YOUR_NAME|{name_regex_part})\s*$',
        '',
        cover_letter,
        flags=re.IGNORECASE
    )
    tmpl = tmpl.replace("<<COVER_LETTER>>", cover_letter)

    # ── Section Formatting Functions & Table Specs ────────────────────────────
    table_specs = config.get("table_column_specs", {}) if isinstance(config.get("table_column_specs"), dict) else {}
    skills_spec = table_specs.get("skills", "@{} >{\\bfseries}p{3.8cm} p{13cm} @{}")
    cert_spec   = table_specs.get("certifications", "@{} p{8.2cm} >{\\centering\\arraybackslash}p{7.0cm} >{\\raggedleft\\arraybackslash}p{2.5cm} @{}")
    ach_spec    = table_specs.get("achievements", "@{} p{8.2cm} >{\\centering\\arraybackslash}p{7.0cm} >{\\raggedleft\\arraybackslash}p{2.5cm} @{}")
    add_spec    = table_specs.get("additional_info", "@{} >{\\bfseries}p{3.8cm} p{13cm} @{}")

    table_headers = config.get("table_headers", {}) if isinstance(config.get("table_headers"), dict) else {}
    cert_header_list = table_headers.get("certifications", ["Certificate", "Issuer", "Year"])
    cert_header_row = " & ".join(f"\\textbf{{{escape_latex(str(h))}}}" for h in cert_header_list)

    DEFAULT_SECTION_TITLES = {
        "summary": "Professional Summary",
        "professional_summary": "Professional Summary",
        "skills": "Skills",
        "experience": "Experience",
        "projects": "Projects",
        "education": "Education",
        "certifications": "Certifications",
        "achievements": "Achievements",
        "additional_info": "Additional Information",
        "languages": "Additional Information"
    }

    user_titles = config.get("section_titles", {}) if isinstance(config.get("section_titles"), dict) else {}
    def get_title(sec_name):
        if sec_name in user_titles:
            title_str = str(user_titles[sec_name])
        elif sec_name in DEFAULT_SECTION_TITLES:
            title_str = DEFAULT_SECTION_TITLES[sec_name]
        else:
            title_str = sec_name.replace("_", " ").title()
        return escape_latex(title_str)

    sec_toggles = config.get("sections", {}) if isinstance(config.get("sections"), dict) else {}

    # Education string formatting
    edu = config.get("education", "")
    if isinstance(edu, list):
        edu_items = []
        for e in edu:
            if isinstance(e, dict):
                inst = escape_latex(e.get("institution", ""))
                deg = escape_latex(e.get("degree", ""))
                dt = escape_latex(e.get("date") or e.get("year", ""))
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
        dt = escape_latex(edu.get("date") or edu.get("year", ""))
        det = escape_latex(edu.get("details", ""))
        edu_str = f"\\textbf{{{deg}}} \\hfill \\textbf{{{dt}}}\\\\\n{inst}"
        if det:
            edu_str += f" \\hfill {det}"
        edu = edu_str
    elif not isinstance(edu, str):
        edu = str(edu)
    tmpl = tmpl.replace("<<EDUCATION>>", edu)

    # Helper for rendering tabular or tabularx dynamically
    def render_table_block(spec, rows, header_row=None, arraystretch=1.0):
        env = "tabularx" if "X" in spec else "tabular"
        width_arg = "{\\linewidth}" if env == "tabularx" else ""
        stretch = f"\\renewcommand{{\\arraystretch}}{{{arraystretch}}}\n" if (arraystretch != 1.0 or env == "tabularx") else ""
        header = f"{header_row} \\\\[1pt]\n" if header_row else ""
        return (
            f"{stretch}"
            f"\\begin{{{env}}}{width_arg}{{{spec}}}\n"
            f"{header}"
            f"{rows}"
            f"\\end{{{env}}}"
        )

    # Summary
    summary_tex = ""
    if summary_text and sec_toggles.get("summary") is not False and sec_toggles.get("professional_summary") is not False:
        title = get_title("summary")
        summary_tex = f"\\section*{{{title}}}\n{escape_latex(summary_text)}"

    # Skills
    skills_tex = ""
    skills_inner_rows = ""
    skills_list = config.get("skills", [])
    if isinstance(skills_list, dict):
        skills_list = [
            {"name": k, "keywords": ", ".join(v) if isinstance(v, list) else str(v)}
            for k, v in skills_list.items()
        ]
        
    for cat in skills_list:
        if not isinstance(cat, dict) or cat.get("active") is False:
            continue
        skills_inner_rows += (
            f"{escape_latex(cat.get('name', ''))} & "
            f"{escape_latex(cat.get('keywords', ''))} \\\\\n"
        )

    if skills_inner_rows and sec_toggles.get("skills") is not False:
        title = get_title("skills")
        tbl = render_table_block(skills_spec, skills_inner_rows, arraystretch=1.0)
        skills_tex = f"\\section*{{{title}}}\n\n{tbl}"
    tmpl = tmpl.replace("<<SKILLS>>", skills_inner_rows)

    # Projects
    projects_tex = ""
    projects_inner = ""
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
        
        projects_inner += (
            f"\\textbf{{ {escape_latex(proj.get('name', ''))} }} "
            f"\\hfill \\textit{{ {escape_latex(tech)} "
            f"{date_str} }} {link_tex}\n"
        )
        projects_inner += "\\begin{itemize}\n"
        points = proj.get("points", proj.get("highlights", []))
        if isinstance(points, list):
            for pt in points:
                projects_inner += f"\\item {escape_latex(pt)}\n"
        elif isinstance(points, str) and points:
            projects_inner += f"\\item {escape_latex(points)}\n"
        projects_inner += "\\end{itemize}\n\\vspace{3pt plus 0.25fill minus 2pt}\n"

    if projects_inner and sec_toggles.get("projects") is not False:
        title = get_title("projects")
        projects_tex = f"\\section*{{{title}}}\n\n{projects_inner}"
    tmpl = tmpl.replace("<<PROJECTS>>", projects_inner)

    # Experience
    experience_tex = ""
    experience_inner = ""
    for exp in config.get("experience", []):
        if not isinstance(exp, dict) or exp.get("active") is False:
            continue
        role     = escape_latex(exp.get("role", exp.get("name", "")))
        company  = escape_latex(exp.get("company", ""))
        location = escape_latex(exp.get("location", ""))
        date     = escape_latex(exp.get("date", ""))
        
        date_str = f"\\hfill \\textbf{{ {date} }}" if date else ""
        company_loc = ", ".join(x for x in [company, location] if x)
        
        experience_inner += f"\\textbf{{ {role} }} {date_str}\\\\\n"
        if company_loc:
            experience_inner += f"\\textit{{ {company_loc} }}\n"
        
        experience_inner += "\\begin{itemize}\n"
        points = exp.get("points", exp.get("highlights", []))
        if isinstance(points, list):
            for pt in points:
                experience_inner += f"\\item {escape_latex(pt)}\n"
        elif isinstance(points, str) and points:
            experience_inner += f"\\item {escape_latex(points)}\n"
        experience_inner += "\\end{itemize}\n\\vspace{3pt plus 0.25fill minus 2pt}\n"

    if experience_inner and sec_toggles.get("experience") is not False:
        title = get_title("experience")
        experience_tex = f"\\section*{{{title}}}\n\n{experience_inner}"
    tmpl = tmpl.replace("<<EXPERIENCE>>", experience_inner)

    # Education section block
    education_tex = ""
    if edu and sec_toggles.get("education") is not False:
        title = get_title("education")
        education_tex = f"\\section*{{{title}}}\n{edu}"

    # Certifications, Achievements, Additional Info
    certifications_tex = ""
    achievements_tex = ""
    additional_tex = ""

    for key in ["certifications", "achievements", "additional_info"]:
        tex_rows = ""
        items = config.get(key, [])

        if key == "additional_info":
            add_info_active = sec_toggles.get("additional_info") is not False
            if isinstance(items, dict):
                lang_val = items.get("languages", "")
                aoi_val  = items.get("areas_of_interest", "")
                if isinstance(lang_val, list):
                    lang_val = ", ".join(lang_val)
                if isinstance(aoi_val, list):
                    aoi_val = ", ".join(aoi_val)
                normalised = []
                if lang_val and add_info_active and sec_toggles.get("languages") is not False:
                    normalised.append({"name": "Languages", "content": lang_val})
                if aoi_val and add_info_active and sec_toggles.get("areas_of_interest") is not False:
                    normalised.append({"name": "Areas of Interest", "content": aoi_val})
                items = normalised
            elif isinstance(items, list):
                if not add_info_active:
                    items = []
                else:
                    lang_items = [i for i in items if isinstance(i, dict) and "language" in i.get("name","").lower() and sec_toggles.get("languages") is not False]
                    aoi_items  = [i for i in items if isinstance(i, dict) and "interest" in i.get("name","").lower() and sec_toggles.get("areas_of_interest") is not False]
                    other      = [i for i in items if isinstance(i, dict) and "language" not in i.get("name","").lower() and "interest" not in i.get("name","").lower()]
                    items = lang_items + aoi_items + other

            for item in items:
                if not isinstance(item, dict) or item.get("active") is False:
                    continue
                content_val = item.get("content", item.get("keywords", ""))
                tex_rows += (
                    f"{escape_latex(item.get('name', ''))} & "
                    f"{escape_latex(content_val)} \\\\\n"
                )
            if tex_rows and add_info_active:
                title = get_title("additional_info")
                tbl = render_table_block(add_spec, tex_rows)
                additional_tex = f"\\section*{{{title}}}\n\n{tbl}"
            tmpl = tmpl.replace("<<ADDITIONAL>>", tex_rows)

        elif key == "certifications":
            for item in items:
                if not isinstance(item, dict) or item.get("active") is False:
                    continue
                tex_rows += (
                    f"{escape_latex(item.get('name'))} & "
                    f"{escape_latex(item.get('issuer'))} & "
                    f"{escape_latex(item.get('year', ''))} \\\\\n"
                )
            if tex_rows and sec_toggles.get("certifications") is not False:
                title = get_title("certifications")
                tbl = render_table_block(cert_spec, tex_rows, header_row=cert_header_row, arraystretch=1.0)
                certifications_tex = f"\\section*{{{title}}}\n\n{tbl}"
            tmpl = tmpl.replace("<<CERTIFICATIONS>>", tex_rows)

        elif key == "achievements":
            for item in items:
                if not isinstance(item, dict) or item.get("active") is False:
                    continue
                tex_rows += (
                    f"{escape_latex(item.get('name'))} & "
                    f"{escape_latex(item.get('issuer'))} & "
                    f"{escape_latex(item.get('year', ''))} \\\\\n"
                )
            if tex_rows and sec_toggles.get("achievements") is not False:
                title = get_title("achievements")
                tbl = render_table_block(ach_spec, tex_rows)
                achievements_tex = f"\\section*{{{title}}}\n\n{tbl}"
            tmpl = tmpl.replace("<<ACHIEVEMENTS>>", tex_rows)

    # ── Dynamic Section Assembly ──────────────────────────────────────────────
    section_map = {
        "summary": summary_tex,
        "professional_summary": summary_tex,
        "skills": skills_tex,
        "experience": experience_tex,
        "projects": projects_tex,
        "education": education_tex,
        "certifications": certifications_tex,
        "achievements": achievements_tex,
        "additional_info": additional_tex,
        "languages": additional_tex
    }

    custom_sections_map = config.get("custom_sections", {}) if isinstance(config.get("custom_sections"), dict) else {}

    section_order = config.get("section_order", [
        "summary", "skills", "experience", "projects", "education", "certifications", "achievements", "additional_info"
    ])

    compiled_sections = []
    for sec_key in section_order:
        sec_name = str(sec_key).lower()
        if sec_name in section_map:
            content = section_map[sec_name]
            if content and content not in compiled_sections:
                compiled_sections.append(content)
        elif sec_name in custom_sections_map:
            c_sec = custom_sections_map[sec_name]
            c_title = get_title(sec_name)
            c_body = ""
            c_spec = table_specs.get(sec_name, "@{} >{\\bfseries}p{3.8cm} p{13cm} @{}")
            if isinstance(c_sec, list):
                c_body += "\\begin{itemize}\n"
                for item in c_sec:
                    c_body += f"\\item {escape_latex(str(item))}\n"
                c_body += "\\end{itemize}\n"
            elif isinstance(c_sec, dict):
                c_rows = ""
                for k, v in c_sec.items():
                    c_rows += f"{escape_latex(str(k))} & {escape_latex(str(v))} \\\\\n"
                c_body = render_table_block(c_spec, c_rows)
            elif isinstance(c_sec, str):
                c_body = escape_latex(c_sec)
            if c_body:
                compiled_sections.append(f"\\section*{{{c_title}}}\n{c_body}")

    dynamic_sections_tex = "\n\n".join(compiled_sections)

    if "<<DYNAMIC_SECTIONS>>" in tmpl:
        tmpl = tmpl.replace("<<DYNAMIC_SECTIONS>>", dynamic_sections_tex)

    # ── Photo path ────────────────────────────────────────────────────────────
    if photo_path:
        tmpl = tmpl.replace("<<PHOTO_PATH>>", photo_path)

    # ── Auto-hide sections if missing/empty in JSON ───────────────────────────
    if "sections" not in config:
        config["sections"] = {}
        
    if not config.get("projects"):
        config["sections"]["projects"] = False
    if not config.get("experience"):
        config["sections"]["experience"] = False
    if not config.get("skills"):
        config["sections"]["skills"] = False
    if not config.get("education"):
        config["sections"]["education"] = False
    if not config.get("certifications"):
        config["sections"]["certifications"] = False
    if not config.get("achievements"):
        config["sections"]["achievements"] = False
    if not config.get("role_title"):
        config["sections"]["role_title"] = False
        
    summary_val = config.get("professional_summary") or config.get("summary")
    if not summary_val:
        config["sections"]["summary"] = False

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
    parser.add_argument("--user",   help="User ID")
    args = parser.parse_args()
    generate_resume(args.source, args.template, args.output, args.photo, args.role, args.user)
