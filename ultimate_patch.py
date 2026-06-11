import json
import re

with open('configs/ai_prompt.json', 'r') as f:
    data = json.load(f)

mi = data["master_instruction"]

# 1. Soften hard_validation - replace exact rendered page line
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
    "Areas of Interest must contain exactly 4 specific keywords.",
    "Additional info must contain only Areas of Interest and Languages.",
    "Resume should visually occupy 96–99% of one page after renderer estimation."
]

# 2. Layout decision rule
mi["layout_decision_rule"] = "When conflicts occur between exact counts and page utilization targets, preserve ATS compliance first, then use page_fill_engine to revise content while keeping schema intact."

# 3. Revision termination
mi["revision_termination"] = {
    "maximum_cycles": 3,
    "accept_if_fill_between": [96, 99]
}

# 4. Project adjustment rules
mi["project_adjustment_rules"] = {
    "expand": "Add specificity, metrics, implementation details.",
    "compress": "Remove least relevant detail first.",
    "never_remove_core_technologies": True
}

# 5. Certification selection priority
mi["certification_priority"] = [
    "Direct JD relevance",
    "Programming",
    "Cloud",
    "Database",
    "General technical"
]

# 6. Project selection priority
mi["project_selection_priority"] = [
    "Direct JD match",
    "Technology overlap",
    "Backend complexity",
    "Measurable outcomes",
    "Recency"
]

# 7. ATS keyword distribution
mi["ats_distribution"] = {
    "skills": "50%",
    "projects": "35%",
    "summary": "10%",
    "cover_letter": "5%"
}

# 8. Variant resolution rule
mi["variant_resolution_rule"] = "If multiple variants qualify, choose the most specialized variant. If specialization is equal, choose YOUR_NAME_SD.pdf."

# 9. Update email greeting rule
mi["email_rules"]["greeting_rule"] = "Use 'Dear Hiring Team'. Use 'Dear Mr./Ms. [Surname]' only when the surname is explicitly provided and verified from the JD."

# 10. Ultimate directive (highest priority)
mi["ultimate_directive"] = "Generate the strongest ATS-optimized resume possible while maintaining schema integrity, readability, and a visually balanced one-page layout with minimal whitespace. When constraints conflict, preserve ATS relevance and schema first, then optimize page utilization."

with open('configs/ai_prompt.json', 'w') as f:
    json.dump(data, f, indent=2)
print("ai_prompt.json: done")

# --- Update tracker.js ---
master_inst_str = "const MASTER_INSTRUCTION = " + json.dumps({"master_instruction": data["master_instruction"]}, indent=4) + ";"
app_schema_str  = "const APPLICATION_SCHEMA = "  + json.dumps(data["application_schema"],  indent=4) + ";"

replacement_block = (
    "// ── Master Instruction for AI Job Application Processing ─────────────────────\n"
    + master_inst_str + "\n\n"
    + "// ── Application JSON Schema Template ─────────────────────────────────────────\n"
    + app_schema_str
)

with open('static/js/tracker.js', 'r') as f:
    tracker_content = f.read()

pattern = re.compile(
    r'// ── Master Instruction for AI Job Application Processing ─────────────────────.*?const APPLICATION_SCHEMA = \{.*?\n\};',
    re.DOTALL
)

if pattern.search(tracker_content):
    new_content = pattern.sub(lambda m: replacement_block, tracker_content)
    with open('static/js/tracker.js', 'w') as f:
        f.write(new_content)
    print("tracker.js: done")
else:
    print("tracker.js: ERROR - block not found")

# --- Update ATS_Prompt.md ---
md_content = (
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
    f.write(md_content)
print("ATS_Prompt.md: done")

