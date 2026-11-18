"""Run inside the built image: docker run --rm -i --entrypoint python IMAGE < this-file."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

from backend.core.config import load_resume_config
from backend.core.generate import generate_resume

assert os.getuid() == 10001, "Image must run as the app user"
assert not Path('/app/.env').exists(), "Local environment must not be baked in"
assert not Path('/app/frontend/node_modules').exists()
for directory in ['/app', '/app/assets', '/tmp/resume_dist', '/tmp/resume_logs']:
    with tempfile.TemporaryFile(dir=directory) as handle:
        handle.write(b'writable')
for module in ['build', 'generate']:
    assert Path(f'/app/backend/core/{module}.py').is_file()

with tempfile.TemporaryDirectory() as temp:
    source = Path(temp) / 'synthetic.json'
    source.write_text(json.dumps(load_resume_config()))
    for name in ['template', 'template_photo', 'cover_letter']:
        output = Path(temp) / f'{name}.tex'
        generate_resume(str(source), f'/app/backend/templates/tex/{name}.tex', str(output))
        result = subprocess.run(
            ['pdflatex', '-interaction=nonstopmode', '-halt-on-error',
             f'-output-directory={temp}', str(output)],
            capture_output=True, text=True, timeout=60,
        )
        assert result.returncode == 0, result.stdout[-5000:]
        assert output.with_suffix('.pdf').read_bytes().startswith(b'%PDF')
        print(f'Compiled {name}')

env = dict(os.environ, PORT='5099', AUTH_REQUIRED='true', JWT_SECRET='synthetic-smoke-secret')
with tempfile.TemporaryFile(mode='w+') as log:
    server = subprocess.Popen(
        ['sh', '-c', 'exec uvicorn backend.app:app --host 127.0.0.1 --port ${PORT}'],
        env=env, stdout=log, stderr=subprocess.STDOUT,
    )
    try:
        base = 'http://127.0.0.1:5099'
        deadline = time.monotonic() + 30
        while True:
            try:
                with urllib.request.urlopen(base + '/login', timeout=1) as response:
                    html = response.read().decode()
                break
            except (OSError, urllib.error.URLError):
                if server.poll() is not None or time.monotonic() > deadline:
                    log.seek(0)
                    raise AssertionError('Server failed to start: ' + log.read())
                time.sleep(0.2)
        assert 'id="root"' in html
        for asset in Path('/app/frontend/dist/assets').iterdir():
            with urllib.request.urlopen(base + '/assets/' + asset.name, timeout=3) as response:
                assert response.status == 200
        try:
            urllib.request.urlopen(base + '/api/checkpoints', timeout=3)
            raise AssertionError('Protected API allowed an unauthenticated request')
        except urllib.error.HTTPError as exc:
            assert exc.code == 401, exc.code
        print('SPA, static assets, authentication, and custom port verified')
    finally:
        server.terminate()
        server.wait(timeout=15)
        assert server.returncode == -15 or server.returncode == 0, server.returncode

print('Docker smoke checks passed')
