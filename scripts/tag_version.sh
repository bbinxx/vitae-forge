#!/bin/bash

# Usage: ./scripts/tag_version.sh backend v1.0.0

ROLE=$1
VERSION=$2

if [ -z "$ROLE" ] || [ -z "$VERSION" ]; then
    echo "Usage: ./scripts/tag_version.sh <role> <version>"
    echo "Example: ./scripts/tag_version.sh backend v1.0.0"
    exit 1
fi

TAG="${ROLE}-${VERSION}"

echo "🏷️  Tagging current commit as $TAG..."

git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

echo "✅ Success: Pushed tag $TAG to origin. CI/CD will build and upload."
