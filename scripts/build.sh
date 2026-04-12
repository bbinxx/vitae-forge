#!/bin/bash

# Ensure we are in the repository root
cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# Configuration
CONFIG_DIR="configs"
TEMPLATE_NO_PHOTO="shared/template.tex"
TEMPLATE_PHOTO="shared/template_photo.tex"
PHOTO_PATH="assets/profile-photo.jpg"
DIST_DIR="dist"
LOG_DIR="logs"

mkdir -p "$DIST_DIR"
mkdir -p "$LOG_DIR"

# Per-role build option
SINGLE_ROLE=$1

build_variant() {
    local config=$1
    local role_name=$2
    local template=$3
    local suffix=$4
    local photo=$5
    
    local tex_file="${role_name}${suffix}_temp.tex"
    local pdf_file="${role_name}${suffix}.pdf"
    
    echo "  → Variant: ${suffix:-Standard}"
    
    # 1. Generate LaTeX
    if [ -n "$photo" ]; then
        python3 scripts/generate.py "$config" "$template" "$tex_file" --photo "$photo"
    else
        python3 scripts/generate.py "$config" "$template" "$tex_file"
    fi
    
    if [ $? -ne 0 ]; then
        echo "    ❌ Error: Generator failed for $role_name $suffix"
        return 1
    fi
    
    # 2. Compile to PDF
    # pdflatex needs the image path relative to its execution location
    pdflatex -interaction=nonstopmode -output-directory="$DIST_DIR" "$tex_file" > "$LOG_DIR/${role_name}${suffix}_build.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "    ✅ Success: ${pdf_file} generated"
        mv "$DIST_DIR/${role_name}${suffix}_temp.pdf" "$DIST_DIR/${pdf_file}"
        rm "$tex_file" "$DIST_DIR/${role_name}${suffix}_temp".*
    else
        echo "    ❌ Error: pdflatex failed. Check $LOG_DIR/${role_name}${suffix}_build.log"
        return 1
    fi
}

build_role() {
    local config=$1
    
    # Extract name and short_code dynamically from JSON
    local name_raw=$(python3 -c "import json; print(json.load(open('$config')).get('name', 'YOUR NAME'))")
    local name_slug=$(echo "$name_raw" | tr '[:lower:]' '[:upper:]' | tr ' ' '_')
    local short_code=$(python3 -c "import json; print(json.load(open('$config')).get('short_name', ''))")
    
    # Fallback to config filename if short_name is missing
    if [ -z "$short_code" ]; then
        short_code=$(basename "$config" .json)
    fi

    local role_display_name="${name_slug}_${short_code}"

    echo "----------------------------------------"
    echo "🏗️  Building Resume: $role_display_name"
    echo "----------------------------------------"

    # Variant 1: Standard (No Photo)
    build_variant "$config" "$role_display_name" "$TEMPLATE_NO_PHOTO" "" ""
    
    # Variant 2: With Photo (_X suffix)
    build_variant "$config" "$role_display_name" "$TEMPLATE_PHOTO" "_X" "assets/profile-photo.jpg"
}

if [ -n "$SINGLE_ROLE" ]; then
    if [ -f "$CONFIG_DIR/$SINGLE_ROLE.json" ]; then
        build_role "$CONFIG_DIR/$SINGLE_ROLE.json"
    else
        echo "❌ Error: Config for role '$SINGLE_ROLE' not found in $CONFIG_DIR"
        exit 1
    fi
else
    for config in "$CONFIG_DIR"/*.json; do
        # Do not build the template or personal json files
        config_name=$(basename "$config")
        if [[ "$config_name" == "template.json" || "$config_name" == "personal.json" ]]; then
            continue
        fi
        build_role "$config"
    done
fi

echo "----------------------------------------"
echo "🎉 Full Build Process Complete"
echo "----------------------------------------"
