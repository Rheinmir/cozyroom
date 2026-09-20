#!/usr/bin/env python3
"""
Add complexity frontmatter to markdown wiki files.
Usage: python add_complexity.py path/to/file.md --level junior --summary "High-level overview"
"""
import argparse
from pathlib import Path
import re

FRONT_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)


def load_content(path: Path):
    return path.read_text(encoding='utf-8')


def write_content(path: Path, content: str):
    path.write_text(content, encoding='utf-8')


def ensure_frontmatter(content: str):
    if content.startswith('---'):
        m = FRONT_RE.match(content)
        if m:
            fm = m.group(1)
            rest = content[m.end():]
            return fm.strip(), rest
    return '', content


def build_complexity_frontmatter(existing_fm: str, level: str, summary: str):
    lines = []
    if existing_fm:
        lines.append(existing_fm)
    lines.append(f"complexity:\n  {level}: \"{summary}\"")
    return '\n'.join(lines)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('file', type=Path)
    p.add_argument('--level', choices=['junior','power-user','pm'], default='junior')
    p.add_argument('--summary', type=str, required=True)
    args = p.parse_args()

    path = args.file
    if not path.exists():
        print(f"File not found: {path}")
        return

    content = load_content(path)
    existing_fm, body = ensure_frontmatter(content)
    new_fm = build_complexity_frontmatter(existing_fm, args.level, args.summary)
    new_content = f"---\n{new_fm}\n---\n{body}"
    write_content(path, new_content)
    print(f"Updated complexity frontmatter in {path}")

if __name__ == '__main__':
    main()
