import io
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

from fastapi.testclient import TestClient
from jose import jwt
from backend.app import app
from backend.api.auth import SECRET_KEY, ALGORITHM
from backend.core.config import load_resume_config
from backend.services.texcompiler_client import TexCompilerError

PDF=b'%PDF-1.4\nsynthetic-route\n%%EOF'


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.config=load_resume_config()
        self.config['personal']['name']='Synthetic Person'
        self.client=TestClient(app)
        self.addCleanup(self.client.close)
        self.client.headers['Authorization']='Bearer '+jwt.encode({'sub':'synthetic-user'},SECRET_KEY,algorithm=ALGORITHM)
        for target in ['backend.api.preview.get_full_config','backend.api.studio.get_full_config','backend.services.document_service.get_full_config']:
            p=patch(target,return_value=self.config);p.start();self.addCleanup(p.stop)
        p=patch('backend.services.texcompiler_client.TexCompilerClient.from_env')
        self.remote=p.start();self.addCleanup(p.stop)
        self.remote.return_value.compile.return_value=PDF

    def test_preview_returns_pdf_and_keeps_auth_requirement(self):
        response=self.client.post('/api/preview-pdf',json={'config':self.config,'type':'resume'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.content,PDF)
        self.assertEqual(response.headers['content-type'],'application/pdf')
        self.assertIn('inline;',response.headers['content-disposition'])
        response=self.client.post('/api/preview-pdf',headers={'Authorization':''},json={'config':self.config})
        self.assertEqual(response.status_code,401)

    def test_preview_service_auth_failure_does_not_expire_browser_session(self):
        self.remote.return_value.compile.side_effect=TexCompilerError(502,'TexCompiler authentication failed.')
        response=self.client.post('/api/preview-pdf',json={'config':self.config})
        self.assertEqual(response.status_code,502,response.text)
        self.assertIn('TexCompiler',response.json()['detail'])

    def test_direct_resume_and_cover_letter_export_keep_filenames(self):
        from backend.services import document_service
        with patch.object(document_service,'DIST_DIR',self.root):
            for kind,name in [('resume','resume'),('cover_letter','resume_Cover_Letter')]:
                response=self.client.post('/compile-direct',json={'config':self.config,'name':'resume','type':kind})
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual(response.json(),{'pdf':name+'.pdf'})
                self.assertEqual((self.root/(name+'.pdf')).read_bytes(),PDF)

    def test_export_to_folder_writes_requested_destination_and_download_copy(self):
        with patch('backend.api.studio.db.get_settings',return_value={'export_folder':str(self.root/'export')}), patch('backend.api.studio.DIST_DIR',self.root):
            response=self.client.post('/api/export-pdf-local',json={'config':self.config,'pdf_name':'test export.pdf','type':'cover_letter'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json(),{'ok':True,'path':str(self.root/'export/TEST_EXPORT.pdf')})
        self.assertEqual((self.root/'TEST_EXPORT.pdf').read_bytes(),PDF)

    def test_source_and_zip_downloads_do_not_call_compilation_service(self):
        self.remote.side_effect=AssertionError('Source downloads must not compile')
        response=self.client.post('/download-latex-direct',json={'config':self.config,'name':'source'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertIn(b'\\begin{document}',response.content)
        response=self.client.post('/download-zip-direct',json={'config':self.config,'name':'source'})
        self.assertEqual(response.status_code,200,response.text)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            self.assertIn('resume.tex',archive.namelist())

    def test_application_config_is_saved_before_remote_failure(self):
        item={'id':'test','role':'Engineer'}
        with patch('backend.api.tracker.db.get_application',return_value=item), patch('backend.api.tracker.db.save_application') as save, patch('backend.services.tracker_service._get_name_prefix',return_value='SYNTHETIC_'):
            self.remote.return_value.compile.side_effect=TexCompilerError(504,'TexCompiler timed out.')
            response=self.client.post('/applications/test/compile-pdf',json={'config':self.config,'pdf_name':'test'})
        self.assertEqual(response.status_code,504,response.text)
        self.assertEqual(item['resume_template'],self.config)
        self.assertTrue(save.called)

    def test_source_cover_letter_export_uses_cover_letter_template(self):
        response=self.client.post('/download-latex-direct',json={'config':self.config,'name':'letter','type':'cover_letter'})
        self.assertEqual(response.status_code,200)
        self.assertIn(b'\\begin{letter}',response.content)

    def test_bookmark_zip_uses_authenticated_user(self):
        bookmark={'id':'test','name':'Saved','data':self.config}
        with patch('backend.api.studio._load_bookmarks',side_effect=lambda user_id=None: [bookmark] if user_id=='synthetic-user' else []):
            response=self.client.get('/bookmarks/test/download-zip')
        self.assertEqual(response.status_code,200)
