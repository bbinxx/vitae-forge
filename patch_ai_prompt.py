import json

with open("configs/ai_prompt.json", "r") as f:
    data = json.load(f)

# 1. Primary directive
data["master_instruction"]["primary_directive"] = "One-page visual balance takes priority after ATS compliance. The AI must dynamically expand or compress content until only minimal whitespace remains while preserving readability."

# 2. Final revision rule
data["master_instruction"]["final_revision_rule"] = "After generating the resume JSON, estimate page utilization. If fill is below 96%, automatically expand sections following expand_order. If fill exceeds 99%, compress sections following compress_order. Repeat until utilization falls between 96% and 99%."

# 3. Hard validation
data["master_instruction"]["hard_validation"] = [
  "Return valid JSON only.",
  "Do not change schema.",
  "Do not omit required sections.",
  "Exactly one education entry.",
  "Exactly six skill categories.",
  "Exactly five projects.",
  "Exactly three achievements.",
  "Additional info must contain only Areas of Interest and Languages.",
  "Resume must visually occupy 96–99% of one page."
]

# 4. Summary
data["master_instruction"]["resume_generation_rules"]["summary"] = {
  "required": True,
  "max_sentences": 3,
  "min_words": 35,
  "max_words": 45,
  "focus": "Target role, strongest qualifications, measurable strengths, and ATS keywords."
}

# 5. Skills
data["master_instruction"]["resume_generation_rules"]["skills"] = {
  "required": True,
  "exact_categories": 6,
  "keywords_per_category": 4,
  "preferred_categories": [
    "Languages", "Web Development", "Frameworks", "Databases", "Developer Tools", "Deployment"
  ],
  "focus": "Concentrate ATS keywords here."
}

# 6. Education
data["master_instruction"]["resume_generation_rules"]["education"] = {
  "required": True,
  "exact_entries": 1,
  "structure": { "degree": True, "institution": True, "year": True }
}

# 7. Achievements
data["master_instruction"]["resume_generation_rules"]["achievements"] = {
  "required": True,
  "exact_items": 3,
  "structure": { "name": True, "issuer": True, "year": True },
  "focus": "Short, recognizable, and concise."
}

# 8. Additional Info
data["master_instruction"]["resume_generation_rules"]["additional_info"] = {
  "required": True,
  "exact_items": 2,
  "structure": { "areas_of_interest": True, "languages": True },
  "areas_of_interest_focus": "Match role and improve page fill.",
  "languages_default": "English, Malayalam"
}

# 9. Projects
old_projects = data["master_instruction"]["resume_generation_rules"]["projects"]
data["master_instruction"]["resume_generation_rules"]["projects"] = {
  "required": True,
  "exact_projects": 5,
  "bullet_distribution": [4, 4, 3, 3, 3],
  "max_total_bullets": 17,
  "max_words_per_bullet": old_projects.get("max_words_per_bullet", 12),
  "ordering": old_projects.get("ordering", "Most relevant first."),
  "rules": old_projects.get("rules", [])
}

# 10. Certifications
old_certs = data["master_instruction"]["resume_generation_rules"]["certifications"]
data["master_instruction"]["resume_generation_rules"]["certifications"] = {
  "required": True,
  "minimum_items": 4,
  "maximum_items": 5,
  "expand_if_space": True,
  "structure": old_certs.get("structure", {}),
  "focus": old_certs.get("focus", "Prefer certifications matching the JD.")
}

# 11. Page Fill Engine (Layout Rules)
layout_rules = data["master_instruction"]["layout_rules"]
layout_rules["exactly_one_page"] = True

# remove old engine configs
for key in ["target_page_fill_percent", "page_fill_strategy", "adaptive_spacing_engine", "density_mode", "density_rules", "spacing_engine"]:
    layout_rules.pop(key, None)

layout_rules["page_fill_engine"] = {
  "target_fill_percent": 97,
  "acceptable_range": [96, 99],
  "auto_adjust": True,
  "expand_order": [
    "Projects", "Summary", "Certifications", "AreasOfInterest"
  ],
  "compress_order": [
    "Certifications", "AreasOfInterest", "Summary", "Projects"
  ]
}

# Clean up validation checklist to be consistent with the user request
data["master_instruction"]["validation_checklist"] = {
  "valid_json": True,
  "schema_preserved": True,
  "correct_assigned_pdf": True,
  "exactly_one_page": True,
  "ats_keywords_present": True,
  "auto_revise_until_valid": True
}

with open("configs/ai_prompt.json", "w") as f:
    json.dump(data, f, indent=2)

print("Patch complete.")
