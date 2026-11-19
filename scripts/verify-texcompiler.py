"""Real remote integration check with synthetic Vitae data; no local TeX execution.

Run inside the backend image with server-side TexCompiler environment configured.
Optional TEXCOMPILER_TEST_FONT points to a mounted .ttf for the custom-font check.
Artifacts are synthetic and written under TEXCOMPILER_VERIFICATION_DIR (/tmp by default).
"""
import os
from pathlib import Path
import shutil
import tempfile
from unittest.mock import patch
import requests

from fastapi.testclient import TestClient
from jose import jwt
from PIL import Image
from backend.app import app
from backend.api.auth import SECRET_KEY, ALGORITHM
from backend.core.config import load_resume_config, TEMPLATE_PLAIN
from backend.services.texcompiler_client import TexCompilerClient, TexCompilerError
from backend.services import document_service
from backend.services.latex_project import render_project

output=Path(os.environ.get('TEXCOMPILER_VERIFICATION_DIR','/tmp/vitae-remote-verification'))
output.mkdir(parents=True,exist_ok=True)
if os.environ.get('EXPECT_NO_TEX')=='1':
    for binary in ['pdflatex','xelatex','lualatex','latexmk','bibtex','biber']:
        assert shutil.which(binary) is None, 'Unexpected local compiler: '+binary
    assert not Path('/app/backend/core/build.py').exists()
    print('No local compiler modules or binaries')
remote=TexCompilerClient.from_env()
with requests.Session() as session:
    session.trust_env = False
    ready = session.get(remote.url + '/ready', timeout=10, allow_redirects=False)
    assert ready.status_code == 200, f'TexCompiler readiness returned HTTP {ready.status_code}'
print('TexCompiler /ready reachable inside backend container')
config=load_resume_config()
config.update(personal={'name':'Alex Example','email':'alex@example.org','phone':'+1 555 0100','linkedin':'alex-example','github':'alex-example'},
              role_title='Software Engineer', summary='Builds reliable services and accessible tools.',
              skills=[{'name':'Languages','keywords':'Python, TypeScript, SQL'}],
              experience=[{'role':'Software Engineer','company':'Example Labs','date':'2022 - Present','points':['Built reliable APIs for 100 users.']}],
              cover_letter='Dear Hiring Manager,\nI build reliable document services.\nSincerely,\nAlex Example')
photo=output/'photo.jpg'
Image.new('RGB',(120,160),(70,100,130)).save(photo)
patches=[]
for target,value in [
    ('backend.db.db.list_users',[]),
    ('backend.api.preview.get_full_config',config),('backend.api.studio.get_full_config',config),
    ('backend.services.document_service.get_full_config',config),('backend.services.resume_service.get_full_config',config),
    ('backend.api.studio.db.get_settings',{'export_folder':str(output/'exports')}),
]:
    p=patch(target,return_value=value);p.start();patches.append(p)
for target,value in [('backend.api.preview.PROFILE_PHOTO',photo),('backend.api.studio.PROFILE_PHOTO',photo),('backend.services.document_service.PROFILE_PHOTO',photo),('backend.services.document_service.DIST_DIR',output),('backend.api.studio.DIST_DIR',output),('backend.api.tracker.DIST_DIR',output)]:
    p=patch(target,value);p.start();patches.append(p)

try:
    with TestClient(app) as browser:
        browser.headers['Authorization']='Bearer '+jwt.encode({'sub':'synthetic-verification-user'},SECRET_KEY,algorithm=ALGORITHM)
        for kind,include_photo,label in [('resume',False,'plain'),('resume',True,'photo'),('cover_letter',False,'letter')]:
            response=browser.post('/api/preview-pdf',json={'config':config,'type':kind,'include_photo':include_photo})
            assert response.status_code==200, 'Preview failed: '+str(response.status_code)
            assert response.content.startswith(b'%PDF-')
            (output/f'preview-{label}.pdf').write_bytes(response.content)
            response=browser.post('/compile-direct',json={'config':config,'type':kind,'include_photo':include_photo,'name':'export-'+label})
            assert response.status_code==200, 'Direct export failed: '+str(response.status_code)
            assert (output/response.json()['pdf']).read_bytes().startswith(b'%PDF-')
            print(label+' preview and direct export OK')
        response=browser.post('/api/export-pdf-local',json={'config':config,'type':'cover_letter','pdf_name':'folder-letter.pdf'})
        assert response.status_code==200
        assert Path(response.json()['path']).read_bytes().startswith(b'%PDF-')
        with patch('backend.api.studio._load_bookmarks',return_value=[{'id':'synthetic','name':'Saved Resume','data':config}]):
            response=browser.post('/bookmarks/synthetic/compile-pdf')
            assert response.status_code==200, 'Bookmark export failed'
        item={'id':'synthetic','role':'Engineer','company':'Example Labs'}
        with patch('backend.api.tracker.db.get_application',return_value=item), patch('backend.api.tracker.db.save_application'), patch('backend.services.tracker_service._get_name_prefix',return_value='SYNTH_'):
            response=browser.post('/applications/synthetic/compile-pdf',json={'config':config,'pdf_name':'application'})
            assert response.status_code==200, 'Application export failed: '+str(response.status_code)
            assert response.json()['cover_letter']=='application_Cover_Letter.pdf'
        print('Folder, saved resume, application resume and cover-letter exports OK')
    font=os.environ.get('TEXCOMPILER_TEST_FONT')
    if font:
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'fonts').mkdir();(root/'images').mkdir();(root/'parts').mkdir()
            shutil.copyfile(font,root/'fonts/Custom.ttf');shutil.copyfile(photo,root/'images/photo.jpg')
            (root/'parts/footer.tex').write_text('Custom font and image project verification.')
            template=root/'custom.tex'
            template.write_text('% !TEX program = xelatex\n'+TEMPLATE_PLAIN.read_text().replace(r'\usepackage{parskip}',r'\usepackage{parskip}'+'\n'+r'\usepackage{fontspec}\usepackage{graphicx}\setmainfont[Path=fonts/]{Custom.ttf}').replace('<<DYNAMIC_SECTIONS>>',r'<<DYNAMIC_SECTIONS>>\includegraphics[width=1cm]{images/photo.jpg}\input{parts/footer.tex}'))
            project=render_project(config,template)
            (output/'custom-font-image.pdf').write_bytes(project.pdf())
            print('XeLaTeX custom font, relative image and nested input OK')
    else:
        print('Custom-font check skipped: TEXCOMPILER_TEST_FONT not supplied')
    for client,source,want in [(remote,r'\documentclass{article}\begin{document}\undefinedcommand\end{document}',422),(TexCompilerClient(remote.url,'invalid-verification-token'),r'\documentclass{article}\begin{document}Test\end{document}',502)]:
        try:
            client.compile(source)
            raise AssertionError('Expected service failure')
        except TexCompilerError as exc:
            assert exc.status_code==want
    print('Real TeX error and service authentication error mapped safely')
finally:
    for p in reversed(patches):p.stop()
print('Remote export verification passed')
