# Proposal: Research ECC Harness & Understand-Anything Integration

**Date**: 2026-05-24  
**Author**: Copilot (via orca-workflow + propose skill)  
**Status**: PHASE 1 COMPLETE ✅ — Documentation created, sent for review

**Commit**: 1fe71c7 — docs(wiki): ECC + Understand-Anything integration research and roadmap

---

## Summary of Phase 1 Completion

### Deliverables Created ✅

1. **concepts/UnderstandAnything.md** (11.1 KB)
   - Complete architecture of 6-7 agent pipeline
   - Tree-sitter deterministic parsing explanation
   - Knowledge graph schema with full type definitions
   - Multi-language support details
   - Dashboard UI architecture
   - Integration opportunities with llmwiki
   - Key patterns worth adopting

2. **concepts/EccHarness.md** (14.6 KB)
   - 47 specialized agents registry with roles
   - 156-181 reusable workflow skills organization
   - Hook system design (PreToolUse, PostToolUse, SessionStart, etc.)
   - Continuous learning system (Instinct v2.1) with confidence scoring
   - Multi-platform integration architecture
   - Security governance framework
   - Integration roadmap with llmwiki

3. **concepts/UnderstandAnything-LlmwikiIntegration.md** (14.3 KB)
   - 4-phase integration roadmap (short/medium/long-term)
   - Phase 2: Tree-sitter, complexity levels, incremental updates
   - Phase 3: Multi-agent pipeline, layer detection, knowledge graph
   - Phase 4: Domain extraction, interactive dashboard, guided tours
   - 15+ concrete integration points
   - Agent distribution: Gemini (review), OpenCode (validate), Copilot+Antigravity (execute)
   - Risk mitigation strategies
   - Success criteria for each phase

### Research Complete ✅

- **Understand-Anything**: Full architectural analysis ✅
- **ECC Harness**: Full architectural analysis ✅
- **Integration potential**: STRONG (✅✅✅) for both repos

### Documentation Committed ✅

- Commit `1fe71c7`: docs(wiki): ECC + Understand-Anything integration research and roadmap
- Wiki index updated with 3 new concept pages
- Operation log updated

### Reviews Requested ✅

- **Gemini**: Deep architectural review (accuracy, feasibility, risks, recommendations)
- **OpenCode**: Implementation-focused review (practical challenges, MVP, alternatives)

---

## Problem Statement

You have two high-interest repositories you want to research and evaluate for integration with llmwiki/rheinmir workflow:

1. **ecc/everythingclaudecode** — Particularly the **harness** component
2. **understand-anything** — Code analysis & knowledge graph generation tool

**Goal**: Fully research both repos, identify integration opportunities, and document findings for potential workflow adoption.

---

## Scope

### A. Research ecc/everythingclaudecode (Focus: Harness)

**Research Questions**:
- What is the harness? (architecture, purpose, design patterns)
- Key components and how they integrate with the rest of the codebase
- What problem does it solve?
- Potential integration points with llmwiki workflow (onboarding, wiki generation, project analysis)
- Code patterns and techniques worth adopting
- Performance characteristics and scalability

**Deliverable**: Comprehensive technical report with file paths, code examples, and architecture diagram concepts.

### B. Research understand-anything

**Research Questions**:
- What's the project approach and philosophy?
- How does it analyze and understand code/projects?
- Key features and technical stack
- Integration potential with llmwiki:
  - Can it enhance explore/analysis workflows?
  - Can it replace or augment current onboard skills?
  - Which concepts should llmwiki adopt?

**Deliverable**: Comprehensive technical report with integration recommendations (short/medium/long term).

---

## What We Know (Preliminary Research)

### Understand-Anything ✅ (Research Complete)

**Key Findings**:

1. **Philosophy**: "Turn any codebase into an interactive knowledge graph you can explore, search, and ask questions about"

2. **Multi-Agent Architecture** (6-7 specialized agents):
   - Project Scanner → File Analyzer → Architecture Analyzer → Tour Builder → Graph Reviewer
   - Parallel execution (up to 5 concurrent files)
   - Optional domain analyzer for business logic extraction

3. **Technology Stack**:
   - **Tree-sitter (WASM)** for deterministic multi-language parsing (TypeScript, Python, Go, Java, Rust, C/C++)
   - **LLM integration** (Claude API) for semantic analysis and summaries
   - **JSON knowledge graph** (committable to git)
   - **Incremental updates** via git diff-based change detection

4. **Knowledge Graph Schema**:
   - Nodes: files, functions, classes, modules, concepts
   - Edges: imports, calls, reads_from, writes_to, depends_on, related, similar_to, etc.
   - Rich metadata: summaries, tags, complexity levels, language-specific notes

5. **Key Features**:
   - Structural graph exploration (interactive, fuzzy + semantic search)
   - Domain/business logic view
   - Guided learning tours (auto-generated walkthroughs)
   - Diff impact analysis (see what your changes affect)
   - Persona-adaptive UI (junior dev / PM / power user)
   - Multi-language support (12 languages)

6. **Integration Potential with llmwiki** ⭐⭐⭐ **STRONG**:
   - **Enhance onboarding**: Auto-generate onboarding guides from graph
   - **Augment exploration**: Semantic search + automatic architecture detection
   - **Persistent knowledge graph**: Pre-built, committable graph as source-of-truth
   - **Incremental updates**: Only re-analyze changed files

7. **Concepts to Adopt**:
   - Tree-sitter for structural analysis (deterministic, multi-language)
   - Multi-agent pipeline decomposition
   - Committable knowledge graphs (`.llmwiki/knowledge-graph.json`)
   - Incremental updates via git fingerprinting
   - Persona-based complexity levels
   - Domain/business layer extraction

### ECC/everythingclaudecode Harness ✅ (Research Complete)

**Repository**: affaanm/everythingclaudecode (146,000+ GitHub stars)  
**License**: MIT

**Key Findings**:

1. **Architecture**: Agent orchestration harness with:
   - **47 specialized agents** (Planner, Architect, TDD-Guide, Code-Reviewer, Security-Reviewer, QA, etc.)
   - **156-181 reusable workflow skills** across 12 language ecosystems
   - **20+ automated hooks** (PreToolUse, PostToolUse, SessionStart, etc.)
   - **Continuous learning system** with pattern recognition & confidence scoring

2. **Technology Stack**:
   - Multi-platform support (Claude Code, Cursor, Codex, OpenCode, Gemini CLI)
   - Hook-based behavior injection (90%+ improvement in success rates)
   - Filesystem-as-working-memory pattern (persistent context anchors)
   - Instinct learning system (observer detects patterns every 5min)

3. **Skill Organization**:
   - TDD, Security, Backend/Frontend patterns, Language-specific idioms
   - Progressive context disclosure (Level 1: metadata; Level 2: instructions; Level 3: resources)
   - Hook integration at each phase
   - Bundled scripts for deterministic operations

4. **Integration with llmwiki** ⭐⭐⭐ **STRONG**:
   - **Onboarding phase**: Use `documentation-writer` + `architect` agents to generate initial wiki structure
   - **Project analysis**: Deploy parallel `recon`, `explorer` agents to map architecture & hotspots
   - **Continuous learning**: Instinct system feeds observed patterns into wiki knowledge graph
   - **Knowledge persistence**: Hook system maintains wiki consistency and frontmatter
   - **Multi-platform**: Cross-platform abstraction means wiki works with any AI coding assistant

5. **Complementary Strengths**:
   - ECC: Agent orchestration, skill management, hook system, continuous learning
   - LLMWiki: Knowledge persistence, hierarchical indexing, cross-linking
   - Combined: Wiki as knowledge graph + agents as execution engine

6. **Key Patterns Worth Adopting**:
   - Hook-based behavior injection (PreToolUse/PostToolUse for context re-injection)
   - Instinct system with confidence scoring (auto-apply >90%, suggest 70-90%)
   - Filesystem-as-working-memory (persistent planning files)
   - Progressive context disclosure (metadata → instructions → resources)
   - Security governance framework (4-level: static analysis → semantic classification → sandboxed execution → behavioral monitoring)

---

## Proposed Actions (Post-Research)

### Phase 1: Document & Analyze
1. Complete research on ECC harness (in progress)
2. Extract findings into separate wiki pages:
   - `concepts/UnderstandAnything.md` — full architecture
   - `concepts/EccHarness.md` — full architecture
   - `concepts/UnderstandAnything-LlmwikiIntegration.md` — integration roadmap

### Phase 2: Create Integration Roadmap
1. **Short-term wins** (tree-sitter, complexity levels, incremental updates)
2. **Medium-term** (committable knowledge graphs, multi-agent pipeline)
3. **Long-term** (domain extraction, interactive dashboard, guided tours)

### Phase 3: Pilot Integration (Optional)
- If approved: Implement one short-term win in current llmwiki workflow
- Test feasibility and performance
- Document lessons learned

---

## Success Criteria

✅ Complete research on both repos  
✅ Document findings in wiki pages with clear Origin sections  
✅ Identify 3+ concrete integration opportunities  
✅ Create actionable roadmap (short/medium/long term)  
✅ No breaking changes to current llmwiki workflow  

---

## Timeline

- **Research**: In progress (parallel agents)
- **Documentation**: ~2-3 hours after research complete
- **Integration Planning**: Included in Phase 2
- **Pilot Implementation** (if approved): 2-4 hours depending on scope

---

## Origin

Created via `orca-workflow` → `propose` skill based on user request to research:
1. ecc/everythingclaudecode (harness component focus)
2. understand-anything (repo integration potential)

User goal: Evaluate integration opportunities with rheinmir/llmwiki workflow.
