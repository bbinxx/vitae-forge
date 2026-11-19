import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

try:
    from backend.services.latex_project import render_project
except ImportError:
    render_project = None


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(render_project, 'Portable document project renderer is missing')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.template = self.root / 'template.tex'
        self.template.write_text(r'\documentclass{article}\begin{document}<<NAME>> <<PHOTO_PATH>>\end{document}')

    def test_generator_keeps_personal_data_and_packages_photo_without_host_path(self):
        photo = self.root / 'outside.jpg'
        photo.write_bytes(b'image bytes')
        project = render_project({'personal':{'name':'Alex & Example'}}, self.template, photo=photo)
        self.assertIn(r'Alex \& Example', project.code)
        self.assertIn('assets/profile-photo.jpg', project.code)
        self.assertNotIn(str(self.root), project.code)
        self.assertEqual(project.files['assets/profile-photo.jpg'], b'image bytes')
        self.assertEqual(project.compiler, 'pdflatex')

    def test_fonts_nested_text_and_engine_are_preserved(self):
        (self.root / 'fonts').mkdir()
        (self.root / 'parts').mkdir()
        (self.root / 'fonts' / 'MyFont.ttf').write_bytes(b'font')
        (self.root / 'parts' / 'body.tex').write_text('Custom body')
        self.template.write_text(r'\usepackage{fontspec}\input{parts/body.tex} <<NAME>>')
        project = render_project({'name':'Alex'}, self.template)
        self.assertEqual(project.compiler, 'xelatex')
        self.assertEqual(project.files['fonts/MyFont.ttf'], b'font')
        self.assertEqual(project.files['parts/body.tex'], 'Custom body')

    def test_project_uses_only_supplied_resume_data(self):
        with patch('backend.core.generate.load_resume_config', side_effect=AssertionError('Unexpected fallback')):
            project = render_project({'personal': {'name': 'Synthetic Person'}}, self.template)
        self.assertIn('Synthetic Person', project.code)

    def test_template_engine_directive_is_honored(self):
        self.template.write_text('% !TEX program = lualatex\n<<NAME>>')
        self.assertEqual(render_project({'name':'Alex'}, self.template).compiler,'lualatex')

    def test_credentials_and_json_are_never_collected(self):
        (self.root / '.env').write_text('PRIVATE=secret')
        (self.root / 'profile.json').write_text('{"private":"resume"}')
        project = render_project({'name':'Alex'}, self.template)
        self.assertNotIn('.env',project.files)
        self.assertNotIn('profile.json',project.files)

    def test_symlink_cannot_send_outside_file(self):
        (self.root / 'stolen.tex').symlink_to('/etc/passwd')
        with self.assertRaises(Exception) as caught:
            render_project({'name':'Alex'}, self.template)
        self.assertEqual(caught.exception.status_code,422)

    def test_engine_detection_includes_template_dependencies(self):
        self.template.write_text(r'\input{preamble.tex} <<NAME>>')
        (self.root/'preamble.tex').write_text(r'\usepackage{fontspec}')
        self.assertEqual(render_project({'name':'Alex'},self.template).compiler,'xelatex')
