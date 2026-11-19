import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backend.core.config import load_resume_config
from backend.services.texcompiler_client import TexCompilerError
try:
    from backend.services import document_service as documents
except ImportError:
    documents = None

PDF = b'%PDF-1.4\nsynthetic\n%%EOF'


class DocumentTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(documents, 'Remote document service is missing')
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name, value in [('DIST_DIR', self.root), ('get_full_config', None)]:
            if name == 'DIST_DIR':
                p=patch.object(documents,name,value)
            else:
                p=patch.object(documents,name,return_value=load_resume_config())
            p.start();self.addCleanup(p.stop)

    def test_custom_resume_and_cover_letter_keep_output_names_and_tex(self):
        with patch('backend.services.texcompiler_client.TexCompilerClient.from_env') as client:
            client.return_value.compile.return_value=PDF
            result=documents.build_custom_version({'name':'Alex','summary':'Synthetic resume','cover_letter':'Dear Team, Hello.'},'ALEX_ENGINEER',False)
        self.assertTrue(result)
        for name in ['ALEX_ENGINEER','ALEX_ENGINEER_Cover_Letter']:
            self.assertEqual((self.root/(name+'.pdf')).read_bytes(),PDF)
            self.assertIn('Dear Team' if name.endswith('Cover_Letter') else 'Alex', (self.root/(name+'.tex')).read_text())

    def test_failure_does_not_publish_a_pdf_or_use_local_fallback(self):
        with patch('backend.services.texcompiler_client.TexCompilerClient.from_env') as client:
            client.return_value.compile.side_effect=TexCompilerError(503,'Busy')
            with self.assertRaises(TexCompilerError):
                documents.build_custom_version({'name':'Alex'},'FAILED',False)
        self.assertFalse((self.root/'FAILED.pdf').exists())

    def test_source_export_needs_no_service_configuration(self):
        with patch.dict('os.environ',{'TEXCOMPILER_URL':'','TEXCOMPILER_API_TOKEN':''}):
            latex=documents.generate_latex_source({'name':'Alex'},'SOURCE',False)
        self.assertIn('Alex',latex)
        self.assertIn(r'\begin{document}',latex)

    def test_output_names_cannot_escape_download_directory(self):
        for name in ['../escape','/tmp/escape','a/b','']:
            with self.subTest(name=name):
                with self.assertRaises(TexCompilerError):
                    documents.build_custom_version({'name':'Alex'},name,False)

    def test_nested_recipe_preserves_profile_and_overrides(self):
        config=documents.prepare_config({'recipe':{'personal':{'name':'Custom'},'summary':'Tailored'}},'test-user')
        self.assertEqual(config['personal']['name'],'Custom')
        self.assertEqual(config['summary'],'Tailored')
        self.assertEqual(config['personal']['email'],'your.email@example.com')

    def test_role_build_selects_requested_recipe_instead_of_first_recipe(self):
        main={'personal':{'name':'Alex'},'library':{},'recipes':{'first':{'summary':'Wrong first role'},'second':{'summary':'Chosen second role'}}}
        with patch.object(documents,'get_full_config',return_value=main), patch('backend.services.texcompiler_client.TexCompilerClient.from_env') as client:
            client.return_value.compile.return_value=PDF
            documents.build_role('second','user')
        source=(self.root/'ALEX_second.tex').read_text()
        self.assertIn('Chosen second role',source)
        self.assertNotIn('Wrong first role',source)
