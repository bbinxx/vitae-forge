#!/bin/bash

# Ensure we are in the repository root
cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# Configuration
CONFIG_FILE="configs/resume_config.json"
TEMPLATE_NO_PHOTO="templates/tex/template.tex"
TEMPLATE_PHOTO="templates/tex/template_photo.tex"
PHOTO_PATH="assets/profile-photo.jpg"
DIST_DIR="dist"
LOG_DIR="logs"

mkdir -p "$DIST_DIR"
mkdir -p "$LOG_DIR"

COMMAND=$1

case $COMMAND in
    "clean")
        echo "🧹 Cleaning up..."
        rm -rf "$LOG_DIR"
        rm -f dist/*.aux dist/*.log dist/*.out dist/*.pdf
        rm -f *_temp.tex
        mkdir -p "$LOG_DIR"
        echo "✅ Done."
        exit 0
        ;;
    "help")
        echo "Usage: ./run.sh [role_id|clean|help]"
        exit 0
        ;;
esac

SINGLE_ROLE=$COMMAND

build_variant() {
    local source=$1
    local role_name=$2
    local template=$3
    local suffix=$4
    local photo=$5
    
    local tex_file="${role_name}${suffix}_temp.tex"
    local pdf_file="${role_name}${suffix}.pdf"
    
    echo "  → Variant: ${suffix:-Standard}"
    
    if [ -n "$photo" ]; then
        python3 src/generate.py "$source" "$template" "$tex_file" --photo "$photo"
    else
        python3 src/generate.py "$source" "$template" "$tex_file"
    fi
    
    pdflatex -interaction=nonstopmode -output-directory="$DIST_DIR" "$tex_file" > "$LOG_DIR/${role_name}${suffix}_build.log" 2>&1
    
    if [ $? -eq 0 ]; then
        local pages=$(grep -a "Output written on" "$LOG_DIR/${role_name}${suffix}_build.log" | grep -oE "[0-9]+ page[s]?")
        echo "    ✅ Success: ${pdf_file} ($pages)"
        mv "$DIST_DIR/${role_name}${suffix}_temp.pdf" "$DIST_DIR/${pdf_file}"
        mv "$tex_file" "$DIST_DIR/${role_name}${suffix}.tex"
        rm "$DIST_DIR/${role_name}${suffix}_temp".* 2>/dev/null
    else
        echo "    ❌ Error: Check $LOG_DIR/${role_name}${suffix}_build.log"
    fi
}

build_role() {
    local role_id=$1
    
    # Extract metadata using Python from the single master config
    local name_raw=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d['personal'].get('name', 'Bibin Raju'))")
    local short_code=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d['recipes'].get('$role_id', {}).get('short_name', '$role_id'))")
    
    local name_slug=$(echo "$name_raw" | tr '[:lower:]' '[:upper:]' | tr ' ' '_')
    local role_display_name="${name_slug}_${short_code}"

    echo "----------------------------------------"
    echo "🏗️  Building Resume: $role_display_name"
    echo "----------------------------------------"

    build_variant "$role_id" "$role_display_name" "$TEMPLATE_NO_PHOTO" "" ""
    build_variant "$role_id" "$role_display_name" "$TEMPLATE_PHOTO" "_X" "$PHOTO_PATH"
}

if [ -n "$SINGLE_ROLE" ]; then
    build_role "$SINGLE_ROLE"
else
    # Build all roles defined in the master config
    ROLES=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(*(d['recipes'].keys()))")
    for role in $ROLES; do
        build_role "$role"
    done
fi

echo "----------------------------------------"
echo "🎉 Complete"
echo "----------------------------------------"
