import re
import json
import os

def extract_content():
    tex_path = os.environ.get("RESUME_TEX", "roles/standard/YOUR_NAME_Raju_Resume.tex")
    if not os.path.exists(tex_path):
        print(f"Error: {tex_path} not found.")
        return

    with open(tex_path, "r") as f:
        content = f.read()

    # Basic extraction using regex
    resume_data = {
        "name": "",
        "contact": {},
        "skills": {},
        "projects": [],
        "education": [],
    }

    # Extract Name
    name_match = re.search(r"\\textbf\{(.+?)\}", content)
    if name_match:
        resume_data["name"] = name_match.group(1)

    # Extract Skills
    skills_table_match = re.search(r"\\section\*\{Skills\}.*?\\begin\{tabular\}(.*?)\\end\{tabular\}", content, re.S)
    if skills_table_match:
        table_content = skills_table_match.group(1)
        for line in table_content.splitlines():
            if "&" in line:
                key, val = line.split("&", 1)
                key = key.strip().replace("\\", "")
                val = val.strip().replace("\\\\", "").replace("\\", "").replace(" ", "")
                resume_data["skills"][key] = val.split(",")

    # Extract Projects
    projects_match = re.findall(r"\\textbf\{(.+?)\}.*?\\textit\{(.+?)\}.*?\\begin\{itemize\}(.*?)\\end\{itemize\}", content, re.S)
    for p_name, p_tech, p_bullets in projects_match:
        bullets = [b.strip() for b in re.findall(r"\\item (.*?)\n", p_bullets)]
        resume_data["projects"].append({
            "name": p_name,
            "tech": p_tech,
            "description": bullets
        })

    # Save to JSON
    with open("resume.json", "w") as f:
        json.dump(resume_data, f, indent=4)
    print("Extracted resume data to resume.json")

if __name__ == "__main__":
    extract_content()
