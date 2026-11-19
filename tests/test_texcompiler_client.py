"""Client boundary tests: changing auth, payload, or failure mappings must break these."""
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import time
import unittest
from unittest.mock import patch

try:
    from backend.services.texcompiler_client import TexCompilerClient, TexCompilerError
except ImportError:
    TexCompilerClient = None

PDF = b'%PDF-1.4\nsynthetic test PDF\n%%EOF'


class ClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                cls.received = (self.path, self.headers.get('Authorization'), json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                if cls.delay:
                    time.sleep(cls.delay)
                self.send_response(cls.status)
                self.send_header('Content-Type', cls.content_type)
                self.end_headers()
                try:
                    self.wfile.write(cls.body)
                except BrokenPipeError:
                    pass
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.assertIsNotNone(TexCompilerClient, 'TexCompiler HTTP client is not implemented')
        self.status, self.body, self.content_type, self.delay = 200, PDF, 'application/pdf', 0
        type(self).status, type(self).body, type(self).content_type, type(self).delay = self.status, self.body, self.content_type, self.delay
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        self.client = TexCompilerClient(self.url, 'server-side-test-token', read_timeout=0.2)

    def test_source_returns_raw_pdf_and_sends_bearer_header(self):
        self.assertEqual(self.client.compile('private source'), PDF)
        self.assertEqual(type(self).received, ('/compile', 'Bearer server-side-test-token', {'code':'private source', 'compiler':'pdflatex'}))

    def test_project_preserves_paths_and_encodes_binary_assets(self):
        self.assertEqual(self.client.compile('main', compiler='xelatex', files={'fonts/test.ttf':b'\x00\xff', 'parts/body.tex':'Hello', 'images/photo.png':b'\x89PNG'}), PDF)
        body = type(self).received[2]
        self.assertEqual(body, {'main_file':'resume.tex','compiler':'xelatex','files':{'resume.tex':'main','fonts/test.ttf':'AP8=','parts/body.tex':'Hello','images/photo.png':'iVBORw=='}})

    def test_service_errors_are_safe_and_keep_meaning(self):
        for upstream, downstream in [(400,422),(422,422),(401,502),(403,502),(429,503),(503,503),(500,502),(408,504),(504,504),(413,413)]:
            with self.subTest(upstream=upstream):
                type(self).status, type(self).content_type = upstream, 'application/json'
                type(self).body = b'{"error":"private source server-side-test-token"}'
                with self.assertRaises(TexCompilerError) as caught:
                    self.client.compile('private source')
                self.assertEqual(caught.exception.status_code, downstream)
                self.assertNotIn('private source', str(caught.exception))
                self.assertNotIn('server-side-test-token', str(caught.exception))

    def test_timeout_has_safe_gateway_timeout(self):
        type(self).delay = 0.5
        with self.assertRaises(TexCompilerError) as caught:
            self.client.compile('private source')
        self.assertEqual(caught.exception.status_code, 504)
        self.assertNotIn(self.url, str(caught.exception))

    def test_html_or_fake_pdf_is_never_saved_as_pdf(self):
        for content_type, body in [('text/html',PDF),('application/pdf',b'not a PDF')]:
            type(self).content_type, type(self).body = content_type, body
            with self.assertRaises(TexCompilerError) as caught:
                self.client.compile('source')
            self.assertEqual(caught.exception.status_code, 502)

    def test_redirect_does_not_forward_secret(self):
        type(self).status = 302
        with self.assertRaises(TexCompilerError):
            self.client.compile('source')

    def test_configuration_requires_server_secret_and_clean_url(self):
        for url, token in [('', 'token'),(self.url,''),('http://user:secret@example.com','token'),(self.url+'?token=secret','token'),('file:///tmp/api','token')]:
            with self.subTest(url=url):
                with self.assertRaises(TexCompilerError):
                    TexCompilerClient(url, token)

    def test_default_deadline_exceeds_service_whole_request_limit(self):
        with patch.dict('os.environ', {'TEXCOMPILER_URL':self.url,'TEXCOMPILER_API_TOKEN':'server-only'}):
            client = TexCompilerClient.from_env()
            self.assertGreater(client.read_timeout, 150)

    def test_project_rejects_paths_outside_project(self):
        for path in ['../secret.txt','/etc/passwd','a/../b.tex','a\\b.tex','-option.tex','resume.tex']:
            with self.subTest(path=path):
                with self.assertRaises(TexCompilerError):
                    self.client.compile('source', files={path:'bad'})


if __name__ == '__main__':
    unittest.main()
