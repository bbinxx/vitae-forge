import json
import tempfile
from pathlib import Path
import os
from src.core.generate import generate_resume
from src.core.config import RESUME_CONFIG, TEMPLATE_PLAIN

config = {"role_title": "Test Role"}

main_config = json.loads(RESUME_CONFIG.read_text())
full_config = {
    "personal": main_config.get("personal", {}),
    "library": main_config.get("library", {}),
}
v_data = {k: v for k, v in config.items() if k != "library"}
full_config.update(v_data)

with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
    json.dump(full_config, tmp)
    tmp_config_path = tmp.name

with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_pdf:
    tmp_pdf_path = tmp_pdf.name

with tempfile.NamedTemporaryFile("w", suffix=".tex", delete=False, dir=Path(tmp_pdf_path).parent) as tmp_tex:
    tmp_tex_path = tmp_tex.name

try:
    generate_resume(tmp_config_path, str(TEMPLATE_PLAIN), tmp_tex_path)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()

