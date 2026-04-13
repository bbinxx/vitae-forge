import json
import os
import sys

# Paths
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(REPO_ROOT, "configs", "resume_config.json")

def escape_latex(text):
    if not isinstance(text, str):
        return text
    replacements = {
        '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
        '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}',
    }
    return "".join(replacements.get(c, c) for c in text)

def resolve_modular(val, section_key, full_library):
    if not val:
        return "" if section_key == "professional_summary" else []

    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
        return val
    
    section_lib = full_library.get(section_key, {})
    
    if isinstance(val, list):
        resolved = []
        for item_id in val:
            if item_id in section_lib:
                resolved.append(section_lib[item_id])
            else:
                resolved.append(item_id)
        return resolved
    elif isinstance(val, str) and val in section_lib:
        return section_lib[val]

    return val

def generate_resume(role_id_or_file, template_path, output_path, photo_path=None):
    with open(CONFIG_FILE, 'r') as f:
        master_config = json.load(f)
    
    personal_info = master_config.get("personal", {})
    library = master_config.get("library", {})
    recipes = master_config.get("recipes", {})
    
    # Load recipe
    recipe = {}
    if os.path.isfile(role_id_or_file):
        with open(role_id_or_file, 'r') as f:
            recipe = json.load(f)
    else:
        if role_id_or_file in recipes:
            recipe = recipes[role_id_or_file]
        else:
            raise ValueError(f"Role ID '{role_id_or_file}' not found in master config.")

    # Merge personal info
    config = {**personal_info, **recipe}
    
    # Resolve modular sections
    for section in ["professional_summary", "role_title", "skills", "projects", 
                    "education", "certifications", "achievements", "additional_info"]:
        config[section] = resolve_modular(config.get(section), section, library)
    
    with open(template_path, 'r') as f:
        template = f.read()

    # Replacements
    template = template.replace("<<NAME>>", escape_latex(config.get("name", "Bibin Raju")))
    template = template.replace("<<ROLE_TITLE>>", escape_latex(config.get("role_title", "")))
    template = template.replace("<<EMAIL>>", escape_latex(config.get("email", "")))
    template = template.replace("<<PHONE>>", escape_latex(config.get("phone", "")))
    template = template.replace("<<LINKEDIN>>", escape_latex(config.get("linkedin", "")))
    template = template.replace("<<GITHUB>>", escape_latex(config.get("github", "")))
    template = template.replace("<<SUMMARY>>", escape_latex(config.get("professional_summary", "")))
    template = template.replace("<<EDUCATION>>", config.get("education", "")) 

    if photo_path:
        template = template.replace("<<PHOTO_PATH>>", photo_path)

    # Skills
    skills_tex = ""
    for cat in config.get("skills", []):
        if not isinstance(cat, dict): continue
        if cat.get("active") is False: continue
        skills_tex += f"{escape_latex(cat.get('name', ''))} & {escape_latex(cat.get('keywords', ''))} \\\\\n"
    template = template.replace("<<SKILLS>>", skills_tex)

    # Projects
    projects_tex = ""
    for proj in config.get("projects", []):
        if not isinstance(proj, dict): continue
        if proj.get("active") is False: continue
        link_tex = f" \\quad \\href{{{proj.get('link')}}}{{GitHub}}" if proj.get("link") else ""
        projects_tex += f"\\textbf{{ {escape_latex(proj.get('name', ''))} }} \\hfill \\textit{{ {escape_latex(proj.get('tech', ''))} \\quad {escape_latex(proj.get('date', ''))} }} {link_tex}\n"
        projects_tex += "\\begin{itemize}\n"
        for pt in proj.get("points", []):
            projects_tex += f"\\item {escape_latex(pt)}\n"
        projects_tex += "\\end{itemize}\n\\vspace{2pt}\n"
    template = template.replace("<<PROJECTS>>", projects_tex)

    # Simple Lists (Certs, Achievements, Info)
    for key, tag in [("certifications", "<<CERTIFICATIONS>>"), ("achievements", "<<ACHIEVEMENTS>>"), ("additional_info", "<<ADDITIONAL>>")]:
        tex = ""
        for item in config.get(key, []):
            if not isinstance(item, dict): continue
            if item.get("active") is False: continue
            if key == "certifications":
                tex += f"{escape_latex(item.get('name'))} & {escape_latex(item.get('issuer'))} & {escape_latex(item.get('year', ''))} \\\\\n"
            elif key == "achievements":
                tex += f"{escape_latex(item.get('name'))} & {escape_latex(item.get('issuer'))} & {escape_latex(item.get('year', ''))} \\\\\n"
            else:
                if item.get("name") == "Areas of Interest": continue
                tex += f"{escape_latex(item.get('name'))} & {escape_latex(item.get('content'))} \\\\\n"
        template = template.replace(tag, tex)

    # Section Toggling
    import re
    sections_config = config.get("sections", {})
    for section_name, is_active in sections_config.items():
        if is_active is False:
             pattern = rf"\% \[SECTION:{section_name.upper()}\].*?\% \[/SECTION:{section_name.upper()}\]"
             template = re.sub(pattern, "", template, flags=re.DOTALL)
    
    # Final cleanup of any potential leftover markers
    template = re.sub(r"\% \[SECTION:.*?\].*?\n", "", template)
    template = re.sub(r"\% \[/SECTION:.*?\].*?\n", "", template)

    with open(output_path, 'w') as f:
        f.write(template)
    print(f"Generated LaTeX: {output_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="Role ID or JSON file")
    parser.add_argument("template", help="LateX template")
    parser.add_argument("output", help="Output .tex")
    parser.add_argument("--photo", help="Profile photo")
    args = parser.parse_args()
    generate_resume(args.source, args.template, args.output, args.photo)
