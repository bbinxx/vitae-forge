#!/bin/bash

# A simple script to watch for changes in main.tex and automatically 
# recompile and update the preview.png for your README.

# Check for required tools
command -v inotifywait >/dev/null 2>&1 || { echo "inotifywait not found. Install it with: sudo apt install inotify-tools"; exit 1; }
command -v pdflatex >/dev/null 2>&1 || { echo "pdflatex not found. Install it with: sudo apt install texlive-latex-extra"; exit 1; }
command -v pdftoppm >/dev/null 2>&1 || { echo "pdftoppm not found. Install it with: sudo apt install poppler-utils"; exit 1; }

# Default target file
TARGET_FILE="${1:-standard/YOUR_NAME_Raju_Resume.tex}"
BASE_NAME=$(basename "$TARGET_FILE" .tex)
DIR_NAME=$(dirname "$TARGET_FILE")

echo "Watching $TARGET_FILE for changes... (Press Ctrl+C to stop)"

while inotifywait -e modify "$TARGET_FILE"; do
  echo "--- Compiling $TARGET_FILE ---"
  pdflatex -interaction=batchmode -output-directory="$DIR_NAME" "$TARGET_FILE" > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "--- Updating assets/preview.png ---"
    pdftoppm -r 150 -png "$DIR_NAME/$BASE_NAME.pdf" preview_temp
    mv preview_temp-1.png assets/preview.png
    echo "--- Done! Preview updated in assets/ ---"
  else
    echo "--- Error: Compilation failed. ---"
  fi
done
