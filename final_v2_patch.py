import json, re

with open('configs/ai_prompt.json', 'r') as f:
    data = json.load(f)

mi = data["master_instruction"]
rules = mi["resume_generation_rules"]

# ── Summary: smart limits ─────────────────────────────────────────────────────
rules["summary"] = {
    "required": True,
    "sentences": {"minimum": 2, "maximum": 3},
    "words": {
        "minimum": 35,
        "preferred_range": [38, 45],
        "maximum": 45
    },
    "focus": "Target role, strongest qualifications, measurable strengths, and ATS keywords."
}

# ── Projects: smart limits ────────────────────────────────────────────────────
rules["projects"] = {
    "required": True,
    "exact_projects": 5,
    "bullet_distribution": {"preferred": [4, 4, 3, 3, 3]},
    "total_bullets": {"minimum": 15, "default": 17, "maximum": 17},
    "reduce_bullets_only_if_page_exceeds_target": True,
    "max_words_per_bullet": 12,
    "ordering": "Most relevant first.",
    "expansion_priority": [
        "Add measurable outcomes.",
        "Add implementation details.",
        "Add optimization impact.",
        "Add collaboration details."
    ],
    "compression_priority": [
        "Remove generic wording.",
        "Remove least relevant detail.",
        "Remove secondary metrics.",
        "Never remove technologies."
    ],
    "rules": [
        "Use action verbs.",
        "Include measurable outcomes when possible.",
        "Mention technologies used.",
        "Avoid generic descriptions.",
        "Tailor highlights to JD keywords."
    ]
}

# ── Certifications: smart limits ──────────────────────────────────────────────
rules["certifications"] = {
    "required": True,
    "minimum_items": 4,
    "maximum_items": 5,
    "use_maximum_only_if_below_fill_target": True,
    "structure": {"name": True, "issuer": True, "year": True},
    "focus": "Prefer certifications matching the JD.",
    "priority": [
        "Direct JD relevance",
        "Programming",
        "Cloud",
        "Database",
        "General technical"
    ]
}

# ── Achievements: keep exact 3 ────────────────────────────────────────────────
rules["achievements"] = {
    "required": True,
    "exact_items": 3,
    "structure": {"name": True, "issuer": True, "year": True},
    "focus": "Short, recognizable, and concise."
}

# ── Additional Info ───────────────────────────────────────────────────────────
rules["additional_info"] = {
    "required": True,
    "exact_items": 2,
    "structure": {"areas_of_interest": True, "languages": True},
    "areas_of_interest": {
        "exact_keywords": 4,
        "focus": "Use exactly 4 role-specific keywords (e.g. Java Development, Backend Systems, Databases, Problem Solving)."
    },
    "languages": {
        "exact_value": "English, Malayalam"
    }
}

# ── Layout rules: page fill engine + visual balance ───────────────────────────
mi["layout_rules"] = {
    "exactly_one_page": True,
    "section_order": [
        "Header", "Professional Summary", "Skills", "Projects",
        "Education", "Certifications", "Achievements", "Languages"
    ],
    "page_fill_engine": {
        "target_fill_percent": 98,
        "acceptable_range": [96, 99],
        "auto_adjust": True,
        "expand_order": [
            "ProjectHighlights", "Summary", "Certifications", "AreasOfInterest"
        ],
        "compress_order": [
            "Certifications", "AreasOfInterest", "Summary", "ProjectHighlights"
        ],
        "step_size": "one bullet or one item at a time",
        "max_revision_cycles": 5
    },
    "visual_balance_rules": {
        "avoid_large_empty_sections": True,
        "maintain_similar_section_density": True,
        "prefer_expanding_existing_sections_over_new_sections": True,
        "maximum_unused_vertical_space_percent": 5,
        "avoid_overcrowding": True
    }
}

# ── ATS distribution ──────────────────────────────────────────────────────────
mi["ats_distribution"] = {
    "skills": 50,
    "projects": 35,
    "summary": 10,
    "cover_letter": 5
}
mi["required_keyword_coverage_percent"] = 80

# ── Variant resolution ────────────────────────────────────────────────────────
mi["resume_variant_selection"]["default_resume_variant"] = "BIBIN_RAJU_SD.pdf"
mi["variant_resolution_rule"] = (
    "Choose the most specialized variant. "
    "If multiple qualify equally, use BIBIN_RAJU_SD.pdf."
)

# ── Email rules ───────────────────────────────────────────────────────────────
mi["email_rules"]["required_fields"] = ["subject", "body", "signature"]
mi["email_rules"]["greeting_rule"] = (
    "Use 'Dear Hiring Team' by default. "
    "Use 'Dear Mr./Ms. [Surname]' only if the surname is explicitly provided in the JD."
)

# ── Hard validation ───────────────────────────────────────────────────────────
mi["hard_validation"] = [
    "Return valid JSON only.",
    "Schema preserved exactly — no extra fields, no missing fields.",
    "Correct assigned PDF selected.",
    "Exactly 6 skill categories.",
    "Exactly 5 projects.",
    "Exactly 3 achievements.",
    "Exactly 1 education entry.",
    "Additional Info contains only Areas of Interest and Languages.",
    "Areas of Interest contains exactly 4 role-specific keywords.",
    "Summary is 35–45 words.",
    "Projects contain 15–17 bullets total.",
    "Each bullet is at most 12 words.",
    "Certifications contain 4–5 items.",
    "Email subject and body are generated.",
    "Cover letter is generated.",
    "ATS keyword coverage is at least 80%.",
    "Resume estimated utilization is between 96–99%.",
    "Maximum revision cycles: 5."
]

# ── Ultimate directive ────────────────────────────────────────────────────────
mi["ultimate_directive"] = (
    "Generate the strongest ATS-optimized application package possible. "
    "Preserve schema integrity and ATS compliance first. "
    "Then optimize visual balance using renderer-estimated page utilization "
    "until the resume occupies 96–99% of one page with minimal whitespace, "
    "no overcrowding, and consistent section density. "
    "If constraints conflict, preserve schema and ATS relevance first, "
    "then adjust content dynamically until all validations pass."
)

# ── Validation checklist ──────────────────────────────────────────────────────
mi["validation_checklist"] = {
    "valid_json": True,
    "schema_preserved": True,
    "correct_assigned_pdf": True,
    "exactly_one_page": True,
    "ats_keyword_coverage_percent": 80,
    "summary_word_range": [35, 45],
    "skill_categories": 6,
    "keywords_per_skill_category": 4,
    "project_count": 5,
    "project_total_bullets_range": [15, 17],
    "project_bullet_distribution_preferred": [4, 4, 3, 3, 3],
    "project_bullet_word_limit": 12,
    "certification_count_range": [4, 5],
    "achievement_count": 3,
    "education_entries": 1,
    "additional_info_items": 2,
    "areas_of_interest_keywords": 4,
    "cover_letter_generated": True,
    "email_generated": True,
    "auto_revise_until_valid": True,
    "max_revision_cycles": 5
}

# Remove old/conflicting keys
for old_key in [
    "primary_directive", "content_density_directive", "layout_decision_rule",
    "revision_termination", "project_adjustment_rules", "certification_priority",
    "project_selection_priority", "final_revision_rule"
]:
    mi.pop(old_key, None)

with open('configs/ai_prompt.json', 'w') as f:
    json.dump(data, f, indent=2)
print("ai_prompt.json: done")

# ── Update tracker.js ─────────────────────────────────────────────────────────
master_inst_str = "const MASTER_INSTRUCTION = " + json.dumps({"master_instruction": data["master_instruction"]}, indent=4) + ";"
app_schema_str  = "const APPLICATION_SCHEMA = "  + json.dumps(data["application_schema"],  indent=4) + ";"

replacement_block = (
    "// ── Master Instruction for AI Job Application Processing ─────────────────────\n"
    + master_inst_str + "\n\n"
    + "// ── Application JSON Schema Template ─────────────────────────────────────────\n"
    + app_schema_str
)

with open('static/js/tracker.js', 'r') as f:
    tracker = f.read()

pattern = re.compile(
    r'// ── Master Instruction for AI Job Application Processing ─────────────────────.*?const APPLICATION_SCHEMA = \{.*?\n\};',
    re.DOTALL
)
if pattern.search(tracker):
    tracker = pattern.sub(lambda m: replacement_block, tracker)
    with open('static/js/tracker.js', 'w') as f:
        f.write(tracker)
    print("tracker.js: done")
else:
    print("tracker.js: ERROR - block not found")

# ── Update ATS_Prompt.md ──────────────────────────────────────────────────────
md = (
    "# ATS Resume & Application Generator Prompt\n\n"
    "Copy the content below and paste it into an AI assistant (like ChatGPT, Claude, or Gemini) "
    "along with a Job Description. It will output a fully structured JSON file that you can "
    "directly import into Resume Studio.\n\n---\n\n"
    "**System Instruction / Prompt:**\n\n"
    "```json\n"
    + json.dumps(data, indent=2)
    + "\n```\n"
)
with open('prompts/ATS_Prompt.md', 'w') as f:
    f.write(md)
print("ATS_Prompt.md: done")

