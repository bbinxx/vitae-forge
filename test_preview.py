import requests
import json

payload = {
    "config": {"role_title": "Test Role"},
    "pdf_name": "test.pdf",
    "type": "resume"
}
res = requests.post("http://127.0.0.1:5050/api/preview-pdf", json=payload)
print(res.status_code)
print(res.text)
