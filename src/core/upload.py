"""
src/core/upload.py
Cloudflare R2 upload helpers.
"""
import os
import hashlib
import sys
from pathlib import Path

import boto3
from botocore.client import Config

# Add project root to sys.path to allow running the script directly
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.core.config import ENV_FILE, DIST_DIR

try:
    from dotenv import load_dotenv
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
except ImportError:
    pass

BUCKET = os.environ.get("R2_BUCKET_NAME", "dev-n1")


def get_r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not all([account_id, access_key, secret_key]):
        return None
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4", connect_timeout=3, read_timeout=3),
        region_name="auto",
    )


def md5_of_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()


_r2_cache = None
_r2_cache_time = 0

def list_r2_objects(ttl: int = 30) -> dict[str, str]:
    """Return {key: etag} for all objects in the R2 bucket."""
    global _r2_cache, _r2_cache_time
    import time
    now = time.time()
    if _r2_cache is not None and (now - _r2_cache_time) < ttl:
        return _r2_cache

    client = get_r2_client()
    if not client:
        return {}
    try:
        resp = client.list_objects_v2(Bucket=BUCKET)
        res = {
            obj["Key"]: obj["ETag"].strip('"')
            for obj in resp.get("Contents", [])
        }
        _r2_cache = res
        _r2_cache_time = now
        return res
    except Exception:
        return {}


def upload_pdf(filename: str) -> dict:
    """Upload a single PDF from DIST_DIR to R2. Returns {ok, error?}."""
    global _r2_cache
    _r2_cache = None
    file_path = DIST_DIR / filename
    client = get_r2_client()
    if not client:
        return {"ok": False, "error": "R2 not configured"}
    try:
        client.upload_file(
            str(file_path), BUCKET, filename,
            ExtraArgs={"ContentType": "application/pdf"},
        )
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
