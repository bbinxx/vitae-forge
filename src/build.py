#!/usr/bin/env python3
import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
import re

ROOT_DIR = Path(__file__).parent.parent
CONFIG_FILE = ROOT_DIR / "configs/resume_config.json"
TEMPLATE_NO_PHOTO = ROOT_DIR / "templates/tex/template.tex"
TEMPLATE_PHOTO = ROOT_DIR / "templates/tex/template_photo.tex"
PHOTO_PATH = ROOT_DIR / "assets/profile-photo.jpg"
DIST_DIR = ROOT_DIR / "dist"
LOG_DIR = ROOT_DIR / "logs"

DIST_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

def clean():
    print("🧹 Cleaning up...")
    if LOG_DIR.exists():
        shutil.rmtree(LOG_DIR)
    LOG_DIR.mkdir(exist_ok=True)
    
    if DIST_DIR.exists():
        for f in DIST_DIR.glob("*"):
            if f.suffix in [".aux", ".log", ".out", ".pdf", ".tex"]:
                f.unlink()
    
    for f in ROOT_DIR.glob("*_temp.tex"):
        f.unlink()
        
    print("✅ Done.")

def build_variant(source_role, role_display_name, template, suffix, photo=None):
    tex_file = f"{role_display_name}{suffix}_temp.tex"
    pdf_file = f"{role_display_name}{suffix}.pdf"
    
    print(f"  → Variant: {suffix if suffix else 'Standard'}")
    
    gen_cmd = [sys.executable, str(ROOT_DIR / "src/generate.py"), source_role, str(template), tex_file]
    if photo:
        gen_cmd.extend(["--photo", str(photo)])
        
    subprocess.run(gen_cmd, cwd=str(ROOT_DIR), check=True)
    
    log_file = LOG_DIR / f"{role_display_name}{suffix}_build.log"
    
    # Run pdflatex
    print(f"  → Compiling with pdflatex...")
    with open(log_file, "w") as lf:
        res = subprocess.run([
            "pdflatex", 
            "-interaction=nonstopmode", 
            f"-output-directory={DIST_DIR}", 
            tex_file
        ], cwd=str(ROOT_DIR), stdout=lf, stderr=lf)
        
    if res.returncode == 0:
        pages = "?"
        with open(log_file, "r", encoding="utf-8", errors="ignore") as lf:
            content = lf.read()
            match = re.search(r"Output written on.*?\(([0-9]+) page[s]?", content)
            if match:
                pages = match.group(1)
                
        print(f"    ✅ Success: {pdf_file} ({pages} pages)")
        
        # move temp to final
        temp_pdf = DIST_DIR / f"{role_display_name}{suffix}_temp.pdf"
        if temp_pdf.exists():
            temp_pdf.rename(DIST_DIR / pdf_file)
            
        tex_path = ROOT_DIR / tex_file
        if tex_path.exists():
            tex_path.rename(DIST_DIR / f"{role_display_name}{suffix}.tex")
            
        # cleanup other temp files
        for ext in [".aux", ".log", ".out"]:
            temp_file = DIST_DIR / f"{role_display_name}{suffix}_temp{ext}"
            if temp_file.exists():
                temp_file.unlink()
    else:
        print(f"    ❌ Error: Check {log_file}")

def build_role(role_id):
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)
        
    name_raw = config.get("personal", {}).get("name", "YOUR NAME")
    short_code = config.get("recipes", {}).get(role_id, {}).get("short_name", role_id)
    
    name_slug = name_raw.upper().replace(" ", "_")
    role_display_name = f"{name_slug}_{short_code}"
    
    print("-" * 40)
    print(f"🏗️  Building Resume: {role_display_name}")
    print("-" * 40)
    
    build_variant(role_id, role_display_name, TEMPLATE_NO_PHOTO, "")
    build_variant(role_id, role_display_name, TEMPLATE_PHOTO, "_X", PHOTO_PATH)

def main():
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "clean":
            clean()
        elif command == "help":
            print("Usage: python3 build.py [role_id|clean|help]")
        else:
            build_role(command)
    else:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
        for role in config.get("recipes", {}).keys():
            build_role(role)
            
    if len(sys.argv) <= 1 or (len(sys.argv) > 1 and sys.argv[1] not in ["clean", "help"]):
        print("-" * 40)
        print("🎉 Complete")
        print("-" * 40)

if __name__ == "__main__":
    main()
