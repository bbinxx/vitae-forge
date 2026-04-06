import os
import boto3
from botocore.config import Config

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
            # Use role name for public URL: resume.bibin.dev/backend
            object_name = filename.replace(".pdf", "")
            
            print(f"🚀 Uploading {filename} to R2 as {object_name}...")
            try:
                s3.upload_file(
                    file_path, 
                    bucket_name, 
                    object_name,
                    ExtraArgs={'ContentType': 'application/pdf'}
                )
                print(f"✅ Uploaded: {filename}")
            except Exception as e:
                print(f"❌ Failed to upload {filename}: {e}")

if __name__ == "__main__":
    upload_to_r2()
