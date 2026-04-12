import json
import os
import sys

def escape_latex(text):
    if not isinstance(text, str):
        return text
    # LaTeX special character escaping
    replacements = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
    }
    return "".join(replacements.get(c, c) for c in text)

def resolve_modular(config_path, section_key, folder_name=None):
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    val = config.get(section_key)
    if not val:
        return "" if section_key == "professional_summary" else []

    # If it's already structured data (list of dicts), return as is
    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
        return val
    
    # Define folder and library filename
    folder = folder_name or section_key
    if section_key == "projects": folder = "projects"
    elif section_key == "professional_summary": folder = "summaries"
    elif section_key == "certifications": folder = "certs"
    elif section_key == "additional_info": folder = "info"
    
    lib_name = "projects.json" if section_key == "projects" else f"{folder}.json"
    module_file = os.path.join(os.path.dirname(config_path), folder, lib_name)
    
    if os.path.exists(module_file):
        with open(module_file, 'r') as f:
            library = json.load(f)
        
        if isinstance(val, list):
            resolved = []
            for item_id in val:
                if item_id in library:
                    resolved.append(library[item_id])
                else:
                    resolved.append(item_id) # Fallback to original
            return resolved
        elif isinstance(val, str) and val in library:
            return library[val]
    
    return val

def generate_resume(config_path, template_path, output_path, photo_path=None):
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Resolve all modular sections
    config["professional_summary"] = resolve_modular(config_path, "professional_summary")
    config["skills"] = resolve_modular(config_path, "skills")
    config["projects"] = resolve_modular(config_path, "projects")
    config["certifications"] = resolve_modular(config_path, "certifications")
    config["achievements"] = resolve_modular(config_path, "achievements")
    config["additional_info"] = resolve_modular(config_path, "additional_info")
    
    with open(template_path, 'r') as f:
        template = f.read()

    # Simple scalar replacements
    template = template.replace("<<NAME>>", escape_latex(config.get("name", "YOUR NAME")))
    template = template.replace("<<ROLE_TITLE>>", escape_latex(config.get("role_title", "")))
    template = template.replace("<<EMAIL>>", escape_latex(config.get("email", "")))
    template = template.replace("<<PHONE>>", escape_latex(config.get("phone", "")))
    template = template.replace("<<LINKEDIN>>", escape_latex(config.get("linkedin", "")))
    template = template.replace("<<GITHUB>>", escape_latex(config.get("github", "")))
    template = template.replace("<<SUMMARY>>", escape_latex(config.get("professional_summary", "")))
    template = template.replace("<<EDUCATION>>", config.get("education", "")) # Keep raw for LaTeX

    # Photo path replacement (if using photo template)
    if photo_path:
        # LaTeX needs absolute path or relative to output dir
        # We'll use the provided path but ensure it exists
        template = template.replace("<<PHOTO_PATH>>", photo_path)

    # Skills section
    skills_tex = ""
    for category in config.get("skills", []):
        if category.get("active") is False:
            continue
        name = escape_latex(category.get("name", ""))
        keywords = escape_latex(category.get("keywords", ""))
        skills_tex += f"{name} & {keywords} \\\\\n"
    template = template.replace("<<SKILLS>>", skills_tex)

    # Projects section
    projects_tex = ""
    for project in config.get("projects", []):
        if project.get("active") is False:
            continue
        name = escape_latex(project.get("name", ""))
        tech = escape_latex(project.get("tech", ""))
        date = escape_latex(project.get("date", ""))
        link = project.get("link", "")
        
        link_tex = f" \\quad \\href{{{link}}}{{GitHub}}" if link else ""
        
        projects_tex += f"\\textbf{{ {name} }} \\hfill \\textit{{ {tech} \\quad {date} }} {link_tex}\n"
        projects_tex += "\\begin{itemize}\n"
        for point in project.get("points", []):
            projects_tex += f"\\item {escape_latex(point)}\n"
        projects_tex += "\\end{itemize}\n"
        projects_tex += "\\vspace{2pt}\n"
    template = template.replace("<<PROJECTS>>", projects_tex)

    # Certifications section
    certs_tex = ""
    for cert in config.get("certifications", []):
        if cert.get("active") is False:
            continue
        name = escape_latex(cert.get("name", ""))
        issuer = escape_latex(cert.get("issuer", ""))
        year = escape_latex(cert.get("year", ""))
        certs_tex += f"{name} & {issuer} & {year} \\\\\n"
    template = template.replace("<<CERTIFICATIONS>>", certs_tex)

    # Achievements section
    ach_tex = ""
    for ach in config.get("achievements", []):
        if ach.get("active") is False:
            continue
        name = escape_latex(ach.get("name", ""))
        issuer = escape_latex(ach.get("issuer", ""))
        ach_tex += f"{name} & {issuer} \\\\\n"
    template = template.replace("<<ACHIEVEMENTS>>", ach_tex)

    # Additional info
    info_tex = ""
    for info in config.get("additional_info", []):
        if info.get("active") is False:
            continue
        name = escape_latex(info.get("name", ""))
        content = escape_latex(info.get("content", ""))
        info_tex += f"{name} & {content} \\\\\n"
    template = template.replace("<<ADDITIONAL>>", info_tex)

    with open(output_path, 'w') as f:
        f.write(template)
    
    print(f"Generated LaTeX: {output_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate LaTeX resume from JSON config")
    parser.add_argument("config", help="Path to JSON config")
    parser.add_argument("template", help="Path to LaTeX template")
    parser.add_argument("output", help="Path to output TeX file")
    parser.add_argument("--photo", help="Path to profile photo (optional)")
    
    args = parser.parse_args()
    generate_resume(args.config, args.template, args.output, args.photo)
