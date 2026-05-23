#!/usr/bin/env python3
import sys
import subprocess

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 src/tag_version.py <version>")
        print("Example: python3 src/tag_version.py 1.7.0")
        sys.exit(1)
        
    version = sys.argv[1]
    
    if not version.startswith("v"):
        tag = f"v{version}"
    else:
        tag = version
        
    print(f"  Tagging current commit as {tag}...")
    
    subprocess.run(["git", "tag", "-a", tag, "-m", f"Release {tag}"], check=True)
    subprocess.run(["git", "push", "origin", tag], check=True)
    
    print(f" Success: Pushed tag {tag} to origin. CI/CD will build and upload.")

if __name__ == "__main__":
    main()
