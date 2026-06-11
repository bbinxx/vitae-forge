import json

with open('configs/ai_prompt.json', 'r') as f:
    prompt_data = f.read()

md_content = f"""# ATS Resume & Application Generator Prompt

Copy the content below and paste it into an AI assistant (like ChatGPT, Claude, or Gemini) along with a Job Description. It will output a fully structured JSON file that you can directly import into Resume Studio.

---

**System Instruction / Prompt:**

```json
{prompt_data.strip()}
```
"""

with open('prompts/ATS_Prompt.md', 'w') as f:
    f.write(md_content)

print("Updated prompts/ATS_Prompt.md")
