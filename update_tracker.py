import json
import re

# Load the updated ai_prompt
with open('configs/ai_prompt.json', 'r') as f:
    ai_prompt = json.load(f)

# Format the variables
master_inst_str = "const MASTER_INSTRUCTION = " + json.dumps({"master_instruction": ai_prompt["master_instruction"]}, indent=4) + ";"
app_schema_str = "const APPLICATION_SCHEMA = " + json.dumps(ai_prompt["application_schema"], indent=4) + ";"

replacement_block = f"""// ── Master Instruction for AI Job Application Processing ─────────────────────
{master_inst_str}

// ── Application JSON Schema Template ─────────────────────────────────────────
{app_schema_str}"""

# Read tracker.js
with open('static/js/tracker.js', 'r') as f:
    tracker_content = f.read()

# Use regex to find and replace the hardcoded blocks
pattern = re.compile(r'// ── Master Instruction for AI Job Application Processing ─────────────────────.*?const APPLICATION_SCHEMA = \{.*?\n\};\n', re.DOTALL)

if pattern.search(tracker_content):
    # Using a lambda to prevent parsing of escape characters in the replacement string
    new_content = pattern.sub(lambda m: replacement_block + "\n", tracker_content)
    with open('static/js/tracker.js', 'w') as f:
        f.write(new_content)
    print("Successfully updated tracker.js!")
else:
    print("Failed to find the block to replace in tracker.js.")

