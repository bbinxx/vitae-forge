"""Vitae document orchestration: data, filenames and storage; TexCompiler makes PDFs."""
import copy
import json
from pathlib import Path
import tempfile

from backend.core.config import DIST_DIR, TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER, PROFILE_PHOTO, load_resume_config
from backend.services.resume_service import get_full_config, merge_personal
from backend.services.latex_project import render_project
from backend.services.texcompiler_client import TexCompilerError


def prepare_config(version_data: dict, user_id: str | None = None) -> dict:
    main = get_full_config(user_id) if user_id else load_resume_config()
    full = {'personal': copy.deepcopy(main.get('personal', {})), 'library': copy.deepcopy(main.get('library', {}))}
    recipe = version_data.get('recipe', version_data.get('resume_template'))
    data = copy.deepcopy(recipe if isinstance(recipe, dict) else version_data)
    if isinstance(recipe, dict) and 'cover_letter' not in data:
        letter = version_data.get('email', version_data.get('cover_letter'))
        if letter:
            data['cover_letter'] = letter
    for section, items in data.pop('library', {}).items():
        full['library'].setdefault(section, {}).update(items)
    full.update(data)
    full['personal'] = merge_personal(main.get('personal'), version_data, data)
    return full


def _name(name: str) -> str:
    if not name or name in {'.', '..'} or Path(name).name != name or any(c in name for c in '/\\\r\n\x00'):
        raise TexCompilerError(422, 'Invalid document output filename.')
    return name


def _publish(name: str, code: str, pdf: bytes):
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    # A unique file and rename prevent readers observing partially written PDFs.
    for suffix, data in [('.tex',code.encode()),('.pdf',pdf)]:
        with tempfile.NamedTemporaryFile(dir=DIST_DIR, delete=False) as handle:
            temporary = Path(handle.name)
            try:
                handle.write(data)
                handle.flush()
                temporary.replace(DIST_DIR / (name + suffix))
            finally:
                temporary.unlink(missing_ok=True)


def build_variant(source_role: str, display_name: str, template: Path, suffix: str,
                  photo: Path | None = None, user_id: str | None = None) -> bool:
    name = _name(display_name + suffix)
    if Path(source_role).is_file():
        data = json.loads(Path(source_role).read_text())
    else:
        main = get_full_config(user_id) if user_id else load_resume_config()
        recipes = main.get('recipes', {})
        if source_role not in recipes:
            raise TexCompilerError(404, 'Resume role not found.')
        data = {**main, 'library': main.get('library', {}), 'recipes': {source_role: recipes[source_role]}}
    project = render_project(data, template, photo=photo)
    pdf = project.pdf()
    _publish(name, project.code, pdf)
    return True


def build_custom_version(version_data: dict, display_name: str, include_photo: bool,
                         custom_photo_path: Path | None = None, user_id: str | None = None) -> bool:
    _name(display_name)
    config = prepare_config(version_data, user_id)
    config.setdefault('sections', {})['photo'] = include_photo
    template = TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN
    photo = (custom_photo_path or PROFILE_PHOTO) if include_photo else None
    project = render_project(config, template, photo=photo)
    pdf = project.pdf()
    _publish(display_name + ('_X' if include_photo else ''), project.code, pdf)
    if config.get('cover_letter') and str(config['cover_letter']).strip():
        try:
            letter = render_project(config, TEMPLATE_COVER_LETTER)
            _publish(display_name + '_Cover_Letter', letter.code, letter.pdf())
        except TexCompilerError as error:
            if error.status_code != 422:
                raise
    return True


def source_project(version_data: dict, include_photo: bool, user_id: str | None = None,
                   document_type: str = 'resume'):
    config = prepare_config(version_data, user_id)
    config.setdefault('sections', {})['photo'] = include_photo
    template = TEMPLATE_COVER_LETTER if document_type == 'cover_letter' else (TEMPLATE_PHOTO if include_photo else TEMPLATE_PLAIN)
    return render_project(config, template, photo=PROFILE_PHOTO if include_photo and document_type != 'cover_letter' else None)


def generate_latex_source(version_data: dict, display_name: str, include_photo: bool,
                          user_id: str | None = None, document_type: str = 'resume') -> str:
    # Raw source/ZIP downloads intentionally require no compilation service.
    return source_project(version_data, include_photo, user_id, document_type).code


def build_role(role_id: str, user_id: str):
    main = get_full_config(user_id)
    short = main.get('recipes', {}).get(role_id, {}).get('short_name', role_id)
    display = f"{main.get('personal', {}).get('name', 'Resume').upper().replace(' ', '_')}_{short}"
    build_variant(role_id, display, TEMPLATE_PLAIN, '', user_id=user_id)
    build_variant(role_id, display, TEMPLATE_PHOTO, '_X', PROFILE_PHOTO, user_id=user_id)


def build_all(user_id: str):
    # TexCompiler owns scheduling and concurrency; avoid flooding its two workers.
    for role in get_full_config(user_id).get('recipes', {}):
        build_role(role, user_id)
