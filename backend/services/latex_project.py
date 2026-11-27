"""Generate portable LaTeX projects. No compiler execution belongs in this module."""
from dataclasses import dataclass
import json
from pathlib import Path
import re
import tempfile

from backend.core.generate import generate_resume
from backend.db import db
from backend.services.texcompiler_client import TexCompilerClient, TexCompilerError

TEXT_EXTENSIONS = {'.tex', '.sty', '.cls', '.bib', '.bst', '.bbx', '.cbx', '.def', '.cfg', '.txt', '.csv'}
BINARY_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.ttf', '.otf', '.woff', '.woff2'}


@dataclass
class LatexProject:
    code: str
    compiler: str
    files: dict[str, str | bytes]

    def pdf(self) -> bytes:
        return TexCompilerClient.from_env().compile(self.code, compiler=self.compiler, files=self.files)


def render_project(config: dict, template: Path, *, photo: Path | None = None,
                   user_id: str | None = None) -> LatexProject:
    files = {}
    root = template.parent.resolve()
    total = 0
    # Only explicit document assets under the template directory are eligible.
    # Never crawl /app, user uploads, environment files, or arbitrary host paths.
    for path in sorted(root.rglob('*')):
        if (path == template.resolve()
                or path.name in {'template.tex', 'template_photo.tex', 'cover_letter.tex'}
                or path.suffix.lower() not in TEXT_EXTENSIONS | BINARY_EXTENSIONS):
            continue
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise TexCompilerError(422, 'Document assets must stay inside the template project.')
        if not path.is_file() or any(p.startswith('.') for p in path.relative_to(root).parts):
            continue
        relative = path.relative_to(root).as_posix()
        TexCompilerClient.validate_path(relative)
        total += path.stat().st_size
        if total > 20 * 1024 * 1024 or len(files) >= 254:
            raise TexCompilerError(413, 'Document project exceeds the compilation service limits.')
        files[relative] = path.read_bytes() if path.suffix.lower() in BINARY_EXTENSIONS else path.read_text(encoding='utf-8')
    photo_name = None
    if photo and photo.is_file():
        if photo.suffix.lower() not in BINARY_EXTENSIONS:
            raise TexCompilerError(422, 'Unsupported profile image format.')
        photo_name = 'assets/profile-photo' + photo.suffix.lower()
        if photo.stat().st_size + total > 20 * 1024 * 1024:
            raise TexCompilerError(413, 'Document project exceeds the compilation service limits.')
        files[photo_name] = photo.read_bytes()
    with tempfile.TemporaryDirectory(prefix='vitae_source_') as directory:
        source = Path(directory) / 'config.json'
        output = Path(directory) / 'resume.tex'
        source.write_text(json.dumps(config), encoding='utf-8')
        template_source = db.get_template_override(user_id, template.name) if user_id else None
        generate_resume(str(source), str(template), str(output), photo_path=photo_name,
                        self_contained=True, template_source=template_source)
        code = output.read_text(encoding='utf-8')
    directive = re.search(r'^\s*%\s*!TEX\s+(?:program|TS-program)\s*=\s*(\w+)', code, re.I | re.M)
    engine_source = code + '\n' + '\n'.join(v for k, v in files.items() if k.endswith(('.tex', '.sty', '.cls')) and isinstance(v, str))
    if directive:
        compiler = directive.group(1).lower()
    elif re.search(r'\\directlua\b', engine_source):
        compiler = 'lualatex'
    elif re.search(r'\\(?:usepackage(?:\[[^]]*\])?\{[^}]*(?:fontspec|unicode-math|polyglossia)|setmainfont|setsansfont|setmonofont)', engine_source):
        compiler = 'xelatex'
    else:
        compiler = 'pdflatex'
    if compiler not in {'pdflatex', 'xelatex', 'lualatex'}:
        raise TexCompilerError(422, 'Template requests an unsupported LaTeX engine.')
    return LatexProject(code, compiler, files)
