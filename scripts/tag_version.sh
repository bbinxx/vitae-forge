#!/bin/bash

# Usage: ./scripts/tag_version.sh 1.7.0

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: ./scripts/tag_version.sh <version>"
    echo "Example: ./scripts/tag_version.sh 1.7.0"
    exit 1
fi

# Ensure version starts with 'v'
if [[ ! "$VERSION" =~ ^v ]]; then
    TAG="v$VERSION"
else
    TAG="$VERSION"
fi

echo "🏷️  Tagging current commit as $TAG..."

git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

echo "✅ Success: Pushed tag $TAG to origin. CI/CD will build and upload."
