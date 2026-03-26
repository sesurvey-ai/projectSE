#!/usr/bin/env python3
"""Typhoon OCR extraction script - called from Node.js backend"""

import sys
import os
import json

os.environ['TYPHOON_OCR_API_KEY'] = os.environ.get('TYPHOON_API_KEY', '')

from typhoon_ocr import ocr_document

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ocr_extract.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    try:
        markdown = ocr_document(
            image_path,
            model="typhoon-ocr",
            figure_language="Thai",
            task_type="v1.5"
        )
        print(json.dumps({"success": True, "text": markdown}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
