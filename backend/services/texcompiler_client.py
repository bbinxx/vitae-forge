"""Server-only TexCompiler v2 transport. Never echo upstream bodies or credentials."""
import base64
import json
import os
from pathlib import PurePosixPath
import re
from urllib.parse import urlsplit

from fastapi import HTTPException
import requests


class TexCompilerError(HTTPException):
    """Safe, user-facing gateway failure; never contains document diagnostics."""


class TexCompilerClient:
    def __init__(self, url: str, token: str, *, read_timeout: float = 165):
        parsed = urlsplit(url)
        if (parsed.scheme not in {'http', 'https'} or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or not token or any(ord(c) < 33 or ord(c) > 126 for c in token)):
            raise TexCompilerError(503, 'TexCompiler is not configured. Contact the administrator.')
        self.url = url.rstrip('/')
        self._token = token
        self.read_timeout = read_timeout

    @classmethod
    def from_env(cls):
        return cls(os.environ.get('TEXCOMPILER_URL', ''), os.environ.get('TEXCOMPILER_API_TOKEN', ''))

    @staticmethod
    def validate_path(path: str):
        parts = PurePosixPath(path).parts
        if (not path or len(path.encode()) > 2048 or not parts or path.startswith('/')
                or any(p in {'.', '..'} or p.startswith('-') or len(p.encode()) > 255 for p in path.split('/'))
                or re.search(r'[\\\x00-\x20\x7f:;|&$`<>"\'!*?{}()]', path)):
            raise TexCompilerError(422, 'Document contains an unsupported project asset path.')

    def compile(self, code: str, *, compiler: str = 'pdflatex', files: dict | None = None) -> bytes:
        if compiler not in {'pdflatex', 'xelatex', 'lualatex'}:
            raise TexCompilerError(422, 'Document requests an unsupported LaTeX engine.')
        if files:
            encoded = {'resume.tex': code}
            decoded_size = len(code.encode())
            for path, value in files.items():
                self.validate_path(path)
                if path == 'resume.tex':
                    raise TexCompilerError(422, 'Document asset collides with the main file.')
                decoded_size += len(value if isinstance(value, bytes) else value.encode())
                encoded[path] = base64.b64encode(value).decode('ascii') if isinstance(value, bytes) else value
            if len(encoded) > 256 or decoded_size > 20 * 1024 * 1024:
                raise TexCompilerError(413, 'Document project exceeds the compilation service limits.')
            payload = {'main_file': 'resume.tex', 'compiler': compiler, 'files': encoded}
        else:
            payload = {'code': code, 'compiler': compiler}
        data = json.dumps(payload).encode()
        if len(data) > 32 * 1024 * 1024:
            raise TexCompilerError(413, 'Document project exceeds the compilation service limits.')
        try:
            # No ambient proxy, .netrc auth, redirects, retries, or source logging.
            with requests.Session() as session:
                session.trust_env = False
                with session.post(self.url + '/compile', data=data,
                                  headers={'Authorization': 'Bearer ' + self._token, 'Content-Type': 'application/json'},
                                  timeout=(5, self.read_timeout), allow_redirects=False, stream=True) as response:
                    status = response.status_code
                    if status != 200:
                        mappings = {
                            400: (422, 'LaTeX compilation failed. Check the document and template.'),
                            422: (422, 'TexCompiler rejected the document project.'),
                            401: (502, 'TexCompiler authentication failed. Contact the administrator.'),
                            403: (502, 'TexCompiler authentication failed. Contact the administrator.'),
                            413: (413, 'Document project exceeds the compilation service limits.'),
                            429: (503, 'TexCompiler workers are busy. Try again shortly.'),
                            503: (503, 'TexCompiler is unavailable. Try again shortly.'),
                            408: (504, 'TexCompiler timed out. Try again or simplify the document.'),
                            504: (504, 'TexCompiler timed out. Try again or simplify the document.'),
                        }
                        raise TexCompilerError(*mappings.get(status, (502, 'TexCompiler returned an unexpected response.')))
                    if response.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/pdf':
                        raise TexCompilerError(502, 'TexCompiler did not return a PDF.')
                    content = bytearray()
                    for chunk in response.iter_content(65536):
                        content.extend(chunk)
                        if len(content) > 16 * 1024 * 1024:
                            raise TexCompilerError(502, 'TexCompiler returned an oversized PDF.')
                    if not content.startswith(b'%PDF-'):
                        raise TexCompilerError(502, 'TexCompiler did not return a valid PDF.')
                    return bytes(content)
        except requests.Timeout:
            raise TexCompilerError(504, 'TexCompiler timed out. Try again or simplify the document.') from None
        except requests.ConnectionError as exc:
            # requests wraps timeouts during streamed response reads as ConnectionError.
            if isinstance(exc.args[0] if exc.args else None, requests.packages.urllib3.exceptions.ReadTimeoutError):
                raise TexCompilerError(504, 'TexCompiler timed out. Try again or simplify the document.') from None
            raise TexCompilerError(503, 'TexCompiler is unreachable. Contact the administrator.') from None
        except requests.RequestException:
            raise TexCompilerError(502, 'TexCompiler request failed. Try again shortly.') from None
