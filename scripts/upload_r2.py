import os
import boto3
from botocore.config import Config

def upload_to_r2():
    # Load from environment variables
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET_NAME", "resume-bucket")
    
    # Custom domain logic if needed
    # endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    # Actually, R2 usually needs the full endpoint
    endpoint_url = os.environ.get("R2_ENDPOINT_URL")

    if not all([access_key, secret_key, endpoint_url]):
        print("❌ Error: Missing R2 credentials. Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT_URL.")
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
