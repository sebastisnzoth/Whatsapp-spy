#!/usr/bin/env python3
"""Small cross-platform launcher for the safe Node.js implementation."""
import os
import shutil
import subprocess
import sys

root = os.path.dirname(os.path.abspath(__file__))
node = shutil.which("node")
if not node:
    print("Node.js is required (18+; 20 recommended).")
    sys.exit(1)

index_js = os.path.join(root, "index.js")
raise SystemExit(subprocess.call([node, index_js], cwd=root))
