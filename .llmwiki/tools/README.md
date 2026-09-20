LLMWiki Tools

This folder contains helper scripts used by the llmwiki integration roadmap.

Scripts:
- incremental_analyze.py — Detects changed source files since last analysis and updates llmwiki/.llmwiki/meta.json
- add_complexity.py — Adds complexity frontmatter to markdown wiki files (junior/power-user/pm)

Usage examples:

# Detect changed files and update meta.json
python llmwiki/tools/incremental_analyze.py

# Add complexity to a page
python llmwiki/tools/add_complexity.py llmwiki/wiki/concepts/UnderstandAnything.md --level power-user --summary "Detailed architecture and schema"
