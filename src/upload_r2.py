import os
import boto3
from botocore.config import Config
from pathlib import Path

# Try to load env safely
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs): pass

# Load environment variables from .env file
ROOT = Path(__file__).parent.parent
ENV_PATH = ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

def upload_to_r2():
    # Load from environment variables and trim whitespace
    account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket_name = os.environ.get("R2_BUCKET_NAME", "resume-bucket").strip()
    endpoint_url = os.environ.get("R2_ENDPOINT_URL", "").strip()

    if not all([access_key, secret_key, endpoint_url]):
        print(f"❌ Error: Missing R2 credentials.")
        print(f"   Access Key: {'Set' if access_key else 'Missing'}")
        print(f"   Secret Key: {'Set' if secret_key else 'Missing'}")
        print(f"   Endpoint URL: {'Set' if endpoint_url else 'Missing'}")
        return

    if not endpoint_url.startswith("http"):
        print(f"❌ Error: R2_ENDPOINT_URL must start with http:// or https://. Current value starts with: {endpoint_url[:10]}...")
        return

    s3 = boto3.client(
        service_name='s3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='auto' 
    )

    dist_dir = "dist"
    if not os.path.exists(dist_dir):
        print(f"❌ Error: {dist_dir} directory not found.")
        return

    for filename in os.listdir(dist_dir):
        if filename.endswith(".pdf"):
            file_path = os.path.join(dist_dir, filename)
            # Keeping the extension: standard.pdf stays standard.pdf in R2
            object_name = filename
            
            print(f"🚀 Uploading {filename} to R2 (overwriting if exists)...")
            try:
                s3.upload_file(
                    file_path, 
                    bucket_name, 
                    object_name,
                    ExtraArgs={'ContentType': 'application/pdf'}
                )
                print(f"✅ Success: {filename} is now live.")
            except Exception as e:
                print(f"❌ Failed to upload {filename}: {e}")

if __name__ == "__main__":
    upload_to_r2()
