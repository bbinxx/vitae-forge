import json
import re

with open('configs/ai_prompt.json', 'r') as f:
    data = json.load(f)

mi = data["master_instruction"]
rules = mi["resume_generation_rules"]

# 1. Projects - exact_total_bullets instead of max_total_bullets
rules["projects"] = {
    "required": True,
    "exact_projects": 5,
    "bullet_distribution": [4, 4, 3, 3, 3],
    "exact_total_bullets": 17,
    "max_words_per_bullet": 12,
    "ordering": "Most relevant first.",
    "rules": [
        "Use action verbs.",
        "Include measurable outcomes when possible.",
        "Mention technologies used.",
        "Avoid generic descriptions.",
        "Tailor highlights to JD keywords."
    ]
}

# 2. Certifications - back to exact_items: 5
rules["certifications"] = {
    "required": True,
    "exact_items": 5,
    "structure": {"name": True, "issuer": True, "year": True},
    "focus": "Prefer certifications matching the JD."
}

# 3. Skills - keep as-is (exact_categories: 6, keywords_per_category: 4)
# Already correct.

# 4. Summary - exact_word_range
rules["summary"] = {
    "required": True,
    "max_sentences": 3,
    "exact_word_range": [38, 45],
    "focus": "Target role, strongest qualifications, measurable strengths, and ATS keywords."
}

# 5. Additional Info - add areas_of_interest_keywords: 4
rules["additional_info"] = {
    "required": True,
    "exact_items": 2,
    "structure": {"areas_of_interest": True, "languages": True},
    "areas_of_interest_keywords": 4,
    "areas_of_interest_focus": "Match role and improve page fill. Use exactly 4 specific keywords (e.g. Java Development, Backend Systems, Databases, Problem Solving).",
    "languages_default": "English, Malayalam"
}

# 6. Layout rules - update page_fill_engine, add renderer_validation
mi["layout_rules"]["page_fill_engine"] = {
    "target_fill_percent": 97,
    "preferred_fill_percent": 98,
    "acceptable_range": [96, 99],
    "auto_adjust": True,
    "expand_order": ["Projects", "Summary", "Certifications", "AreasOfInterest"],
    "compress_order": ["Certifications", "AreasOfInterest", "Summary", "Projects"]
}

mi["layout_rules"]["renderer_validation"] = {
    "estimate_page_after_render": True,
    "auto_recalculate": True,
    "max_revision_cycles": 3
}

# 7. Final revision rule - updated
mi["final_revision_rule"] = "Generate resume. Estimate rendered utilization. If utilization <96%, expand sections following expand_order until 98% target is reached. If utilization >99%, compress sections following compress_order. Stop after three revision cycles or when utilization falls between 96–99%."

# 8. Hard validation - add new rules
mi["hard_validation"] = [
    "Return valid JSON only.",
    "Do not change schema.",
    "Do not omit required sections.",
    "Exactly one education entry.",
    "Exactly six skill categories.",
    "Exactly five projects.",
    "Exactly 17 project bullets across all five projects.",
    "Exactly three achievements.",
    "Exactly five certifications.",
    "Summary must contain 38–45 words.",
    "Additional info must contain only Areas of Interest and Languages.",
    "Areas of Interest must contain exactly 4 specific keywords.",
    "Rendered page utilization must be 96–99%.",
    "Resume must visually occupy 96–99% of one page."
]

# 9. Validation checklist - update to match
mi["validation_checklist"] = {
    "valid_json": True,
    "schema_preserved": True,
    "correct_assigned_pdf": True,
    "exactly_one_page": True,
    "ats_keywords_present": True,
    "summary_word_range": [38, 45],
    "skill_categories": 6,
    "keywords_per_skill_category": 4,
    "project_count": 5,
    "project_total_bullets": 17,
    "project_bullet_distribution": [4, 4, 3, 3, 3],
    "project_bullet_word_limit": 12,
    "certification_count": 5,
    "achievement_count": 3,
    "education_entries": 1,
    "additional_info_items": 2,
    "areas_of_interest_keywords": 4,
    "cover_letter_generated": True,
    "email_generated": True,
    "auto_revise_until_valid": True,
    "max_revision_cycles": 3
}

# 10. Content density directive
mi["content_density_directive"] = "Content density consistency takes precedence over maximizing content. The AI must maintain uniform visual balance across sections and avoid large whitespace even when all validation constraints are satisfied."

with open('configs/ai_prompt.json', 'w') as f:
    json.dump(data, f, indent=2)

print("ai_prompt.json patched.")

# --- Now update tracker.js ---
master_inst_str = "const MASTER_INSTRUCTION = " + json.dumps({"master_instruction": data["master_instruction"]}, indent=4) + ";"
app_schema_str = "const APPLICATION_SCHEMA = " + json.dumps(data["application_schema"], indent=4) + ";"

replacement_block = f"""// ── Master Instruction for AI Job Application Processing ─────────────────────
{master_inst_str}

// ── Application JSON Schema Template ─────────────────────────────────────────
{app_schema_str}"""

with open('static/js/tracker.js', 'r') as f:
    tracker_content = f.read()

pattern = re.compile(r'// ── Master Instruction for AI Job Application Processing ─────────────────────.*?const APPLICATION_SCHEMA = \{.*?\n\};\n', re.DOTALL)

if pattern.search(tracker_content):
    new_content = pattern.sub(lambda m: replacement_block + "\n", tracker_content)
    with open('static/js/tracker.js', 'w') as f:
        f.write(new_content)
    print("tracker.js patched.")
else:
    print("ERROR: Could not find block in tracker.js.")

# --- Now update ATS_Prompt.md ---
md_content = f"""# ATS Resume & Application Generator Prompt

Copy the content below and paste it into an AI assistant (like ChatGPT, Claude, or Gemini) along with a Job Description. It will output a fully structured JSON file that you can directly import into Resume Studio.

---

**System Instruction / Prompt:**

```json
{json.dumps(data, indent=2)}
```
"""

with open('prompts/ATS_Prompt.md', 'w') as f:
    f.write(md_content)

print("ATS_Prompt.md patched.")

