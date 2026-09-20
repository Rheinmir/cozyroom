#!/usr/bin/env python3
"""
Incremental analyze helper for llmwiki.
Detects changed source files since last analyzed commit and prints them.
This is a lightweight helper that prepares a list for downstream analyzers.
"""
import json
import subprocess
import sys
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
META_PATH = ROOT / "llmwiki" / ".llmwiki" / "meta.json"
KG_PATH = ROOT / "llmwiki" / ".llmwiki" / "knowledge-graph.json"

EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".go", ".rs", ".java", ".c", ".cpp"}


def read_meta():
    if not META_PATH.exists():
        return {"lastAnalyzedCommit": None}
    return json.loads(META_PATH.read_text())


def write_meta(meta):
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(meta, indent=2))


def get_current_commit():
    try:
        out = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        return out
    except subprocess.CalledProcessError:
        return None


def git_diff_changed_files(last_commit):
    if not last_commit:
        # No previous commit recorded — analyze entire tree
        cmd = ["git", "ls-files"]
    else:
        cmd = ["git", "diff", f"{last_commit}..HEAD", "--name-only"]
    try:
        out = subprocess.check_output(cmd, cwd=ROOT, text=True)
        files = [line.strip() for line in out.splitlines() if line.strip()]
        return files
    except subprocess.CalledProcessError:
        return []


def filter_source_files(files):
    return [f for f in files if Path(f).suffix in EXTENSIONS]


def main():
    meta = read_meta()
    last = meta.get("lastAnalyzedCommit")
    files = git_diff_changed_files(last)
    src_files = filter_source_files(files)

    if not src_files:
        print("No changed source files detected.")
    else:
        print("Changed source files:")
        for f in src_files:
            print(f)

    # Update meta to current commit
    current = get_current_commit()
    if current:
        meta["lastAnalyzedCommit"] = current
        # Use Python datetime for portability across platforms
        meta["lastAnalyzedAt"] = datetime.datetime.now().isoformat()
        meta["analyzedFiles"] = len(src_files)
        write_meta(meta)
        print(f"Updated meta.json with commit {current}")
    else:
        print("Could not determine current commit; meta.json not updated.")


if __name__ == '__main__':
    main()
