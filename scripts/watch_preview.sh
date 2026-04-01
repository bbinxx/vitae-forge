#!/bin/bash

# A simple script to watch for changes in main.tex and automatically 
# recompile and update the preview.png for your README.

# Check for required tools
command -v inotifywait >/dev/null 2>&1 || { echo "inotifywait not found. Install it with: sudo apt install inotify-tools"; exit 1; }
command -v pdflatex >/dev/null 2>&1 || { echo "pdflatex not found. Install it with: sudo apt install texlive-latex-extra"; exit 1; }
command -v pdftoppm >/dev/null 2>&1 || { echo "pdftoppm not found. Install it with: sudo apt install poppler-utils"; exit 1; }

echo "Watching main.tex for changes... (Press Ctrl+C to stop)"

while inotifywait -e modify main.tex; do
  echo "--- Compiling main.tex ---"
  pdflatex -interaction=batchmode main.tex > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "--- Updating preview.png ---"
    pdftoppm -r 150 -png main.pdf preview_temp
    mv preview_temp-1.png preview.png
    echo "--- Done! Preview updated. ---"
  else
    echo "--- Error: Compilation failed. ---"
  fi
done
