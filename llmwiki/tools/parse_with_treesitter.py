#!/usr/bin/env python3
"""
Lightweight Tree-sitter parsing scaffold.
Attempts to use tree_sitter Python bindings; if unavailable, falls back to a simple heuristic.

Usage: python parse_with_treesitter.py path/to/file
"""
import sys
from pathlib import Path

try:
    from tree_sitter import Language, Parser
    HAS_TS = True
except Exception:
    HAS_TS = False

import re


def fallback_extract_functions(code: str):
    # Very naive function extractor for JS/TS/Python/Go
    patterns = [r"def\s+(\w+)\s*\(", r"function\s+(\w+)\s*\(", r"(\w+)\s*:=\s*func\s*\(", r"func\s+(\w+)\s*\(")]
    names = set()
    for p in patterns:
        for m in re.finditer(p, code):
            names.add(m.group(1))
    return list(names)


def main():
    if len(sys.argv) < 2:
        print("Usage: parse_with_treesitter.py path/to/file")
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)
    code = path.read_text(encoding='utf-8')

    if HAS_TS:
        print("tree-sitter bindings available — attempting parse (languages must be pre-built into a .so)")
        # This is a scaffold: users should build a languages bundle and set TS_LANG_LIB
        TS_LIB = Path.home() / ".tree_sitter_langs" / "my-languages.so"
        if not TS_LIB.exists():
            print(f"Language bundle not found at {TS_LIB}. Please build languages per tree-sitter docs.")
            print("Falling back to heuristic extraction...")
            funcs = fallback_extract_functions(code)
            print("Functions found:")
            for f in funcs:
                print(f)
            return
        LANG = Language(str(TS_LIB), 'javascript')
        parser = Parser()
        parser.set_language(LANG)
        tree = parser.parse(code.encode())
        root = tree.root_node
        # Very small example: print root type and children count
        print(f"Root node type: {root.type}, children: {len(root.children)}")
    else:
        print("tree-sitter bindings not available. Using regex-based heuristic.")
        funcs = fallback_extract_functions(code)
        print("Functions found:")
        for f in funcs:
            print(f)

if __name__ == '__main__':
    main()
