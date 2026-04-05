#!/bin/bash

# --- RESUME EXPORT SCRIPT ---
# This script scans role-based subfolders, compiles .tex files, 
# and exports the resulting PDFs to a chosen directory.

# Colors for better UI
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we're in the project root
if [[ ! -d "scripts" ]]; then
    echo -e "${RED}Error: Run this script from the project root.${NC}"
    exit 1
fi

# 1. Scan for role folders containing .tex files
mapfile -t folders < <(find . -maxdepth 1 -type d -not -path '*/.*' -not -path './assets' -not -path './scripts' -not -path '.' -exec sh -c 'ls -1 "{}"/*.tex >/dev/null 2>&1 && echo "{}"' \;)

if [[ ${#folders[@]} -eq 0 ]]; then
    echo -e "${RED}No role folders with .tex files found.${NC}"
    exit 1
fi

echo -e "${BLUE}--- YOUR NAME Resume Exporter ---${NC}"
echo -e "Available roles:"
for i in "${!folders[@]}"; do
    echo -e "$((i+1)). ${folders[i]#./}"
done
echo -e "A. ALL folders"
echo

# 2. Select role
read -rp "Select a role number (or 'A' for all): " selection

targets=()
if [[ "$selection" =~ ^[Aa]$ ]]; then
    targets=("${folders[@]}")
elif [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -le "${#folders[@]}" ]; then
    targets=("${folders[$((selection-1))]}")
else
    echo -e "${RED}Invalid selection.${NC}"
    exit 1
fi

# 3. Choose export folder
read -rp "Enter export directory (default: ./exports): " export_dir
export_dir=${export_dir:-"./exports"}

mkdir -p "$export_dir"
export_dir_abs=$(realpath "$export_dir")

# 4. Compile and move
echo -e "\n${YELLOW}Starting compilation...${NC}"

for folder in "${targets[@]}"; do
    echo -e "\n${BLUE}Processing ${folder#./}...${NC}"
    
    # Process each .tex file in the folder
    for tex_file in "$folder"/*.tex; do
        if [[ -f "$tex_file" ]]; then
            filename=$(basename "$tex_file")
            pdfname="${filename%.tex}.pdf"
            
            echo -e "Compiling ${filename}..."
            
            # Compile using pdflatex (non-interactive, suppress most output)
            pdflatex -interaction=batchmode -output-directory="$folder" "$tex_file" > /dev/null 2>&1
            
            if [[ -f "$folder/$pdfname" ]]; then
                mv "$folder/$pdfname" "$export_dir_abs/"
                echo -e "${GREEN}✓ Exported: $export_dir_abs/$pdfname${NC}"
            else
                echo -e "${RED}✗ Error compiling $filename${NC}"
            fi
            
            # Cleanup LaTeX build artifacts
            rm -f "$folder"/*.aux "$folder"/*.log "$folder"/*.out "$folder"/*.toc
        fi
    done
done

echo -e "\n${GREEN}Export complete! Files are in: $export_dir_abs${NC}\n"
