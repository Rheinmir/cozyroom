---
complexity:
  power-user: "Detailed architecture and schema"
---
# Understand-Anything: Code Analysis & Knowledge Graph Platform

**Status**: Mature, production-ready  
**Stars**: Trending on GitHub  
**Multi-language**: EN, ZH (Simplified & Traditional), JA, KO, ES, TR, RU  
**MIT License**

---

## Overview

Understand-Anything turns codebases into interactive **knowledge graphs** you can explore, search, and ask questions about. It bridges the gap between AI understanding and human comprehension through interactive, explorable documentation.

**Philosophy**: "The goal isn't a graph that wows you with how complex your codebase is — it's a graph that quietly teaches you how every piece fits together."

---

## Core Architecture: Multi-Agent Pipeline

Understand-Anything uses a sophisticated **6-7 agent pipeline** for code analysis:

### Agent Roles

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| **Project Scanner** | Discover files, detect languages & frameworks | Raw project directory | File inventory with language classification |
| **File Analyzer** | Extract functions, classes, imports; generate summaries | Parsed AST from tree-sitter | Graph nodes with rich metadata + edges |
| **Architecture Analyzer** | Identify and cluster architectural layers | All graph nodes | Layer assignments (API, Service, Data, UI, Utility) with color-coding |
| **Tour Builder** | Generate guided learning paths | Dependency graph | Step-by-step walkthroughs ordered by dependency |
| **Graph Reviewer** | Validate completeness and referential integrity | Complete graph | Quality assurance, error detection |
| **Domain Analyzer** (Optional) | Extract business domains and flows | Code + docs | Business-domain mapping |
| **Article Analyzer** (Optional) | Analyze Karpathy-pattern LLM wikis | Wiki index + articles | Force-directed knowledge graph of wiki interconnections |

### Execution Model

```
/understand command:
  1. project-scanner → detects files + tech stack
     ↓
  2. file-analyzer × N (parallel, 5 concurrent, 20-30 files/batch)
     ├─ Use tree-sitter (WASM) to parse AST deterministically
     ├─ Extract functions, classes, variables, imports
     ├─ Use LLM for summaries, tags, complexity levels
     ↓
  3. architecture-analyzer → cluster nodes into layers
     ↓
  4. tour-builder → generate learning paths
     ↓
  5. graph-reviewer → validate integrity
     ↓
  6. Output: .understand-anything/knowledge-graph.json
```

---

## Technology Stack

### Key Technologies

| Component | Technology | Why |
|-----------|-----------|-----|
| **Static Analysis** | tree-sitter (WASM) | Deterministic, multi-language (8+ langs), lightweight |
| **LLM Integration** | Claude API | Semantic analysis, summaries, business logic extraction |
| **Graph Format** | JSON | Committable to git, language-agnostic, readable |
| **Persistence** | `.understand-anything/` directory | Git-trackable, incremental updates via git-diff |
| **Change Detection** | Git fingerprint-based | Incremental: only re-analyzes changed files |
| **Dashboard** | React 18 + React Flow | Interactive node graph visualization |
| **Code Viewer** | Monaco Editor | Read-only code with Prism syntax highlighting |

### Supported Languages (via tree-sitter)

- TypeScript / JavaScript
- Python
- Go
- Java
- Rust
- C / C++
- Plus others

---

## Knowledge Graph Schema

### Graph Node

```typescript
interface GraphNode {
  id: string;                    // Unique identifier
  type: "file" | "function" | "class" | "module" | "concept";
  name: string;
  filePath?: string;
  lineRange?: [number, number];
  summary: string;               // Plain-English LLM-generated
  tags: string[];                // Searchable metadata
  complexity: "simple" | "moderate" | "complex";
  languageNotes?: string;        // Language-specific explanations
}
```

### Graph Edge

```typescript
interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  direction: "forward" | "backward" | "bidirectional";
  description?: string;
  weight: number;                // 0-1 importance
}

type EdgeType =
  // Structural
  | "imports" | "exports" | "contains" | "inherits" | "implements"
  // Behavioral
  | "calls" | "subscribes" | "publishes" | "middleware"
  // Data flow
  | "reads_from" | "writes_to" | "transforms" | "validates"
  // Dependencies
  | "depends_on" | "tested_by" | "configures"
  // Semantic
  | "related" | "similar_to";
```

### Complete Knowledge Graph

```typescript
interface KnowledgeGraph {
  version: string;
  project: ProjectMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: Layer[];
  tour: TourStep[];
}
```

---

## Core Features

### 1. Structural Graph Exploration

- Navigate codebase as interactive knowledge graph
- Every file, function, class is a node
- React Flow + force-directed layout
- Fuzzy + semantic search ("which parts handle auth?")

### 2. Domain View

- Map code to real business processes
- Domains, flows, steps laid out horizontally
- LLM-extracted business domain mapping

### 3. Knowledge Base Analysis

- Analyze Karpathy-pattern LLM wikis (like llmwiki)
- Extract wikilinks and categories
- Discover implicit relationships
- Surface community clustering

### 4. Guided Tours

- Auto-generated walkthroughs of architecture
- Ordered by dependency
- Optimal learning path through the codebase

### 5. Fuzzy & Semantic Search

- Find by name OR by meaning
- Keyword matching + embedding similarity fallback
- Instant results as you type

### 6. Diff Impact Analysis

- See which parts your changes affect before commit
- Analyzes current git diff
- Maps to graph nodes

### 7. Persona-Adaptive UI

- Junior dev: High-level summaries, complexity indicators
- PM: Domain/business logic view
- Power user: Code-level details, advanced patterns

### 8. Layer Visualization

- Automatic grouping by architectural layer
- Color-coded nodes (API, Service, Data, UI, Utility)
- Assigned during architecture-analyzer phase

### 9. Language Concepts

- 12 programming patterns explained in context
- Generics, closures, decorators, etc.
- LLM annotations + inline code viewer

---

## Incremental Update System

### Git Fingerprinting for Efficiency

```typescript
// Detect changed files
const lastCommit = meta.gitCommitHash;
const changedFiles = execSync(
  `git diff ${lastCommit}..HEAD --name-only`
).split('\n');

if (changedFiles.length === 0) {
  return existingGraph;  // Serve cached graph
} else {
  // Re-analyze only changed files
  const newAnalyses = analyzeFiles(changedFiles);
  
  // Merge into existing graph
  const mergedGraph = mergeGraphs(existingGraph, newAnalyses);
  
  // Update metadata
  writeMeta({
    lastAnalyzedAt: now(),
    gitCommitHash: getCurrentCommitHash(),
    analyzedFiles: mergedGraph.nodes.length
  });
  
  return mergedGraph;
}
```

### Metadata Storage

```json
{
  "gitCommitHash": "abc123def456",
  "lastAnalyzedAt": "2026-05-24T16:00:00Z",
  "analyzedFiles": 342,
  "version": "1.0.0"
}
```

---

## Dashboard UI

### Architecture

- **75% graph view** (React Flow) + **360px right sidebar** (tabs: Info, Files)
- **Graph view**: Interactive nodes (click to select), search highlights, layer color-coding
- **Code viewer**: Prism-based syntax highlighting, slides up from bottom, full-screen modal option
- **Source content**: Fetched from `/file-content.json` endpoint with access token + path allowlist

### Design Theme

- **Dark luxury**: Deep blacks (#0a0a0a), gold/amber accents (#d4a574)
- **Typography**: DM Serif Display
- **Interactive**: Zustand state management, component hiding/showing per persona

---

## Multi-Platform Support

Works across **12+ AI coding platforms**:
- ✅ Claude Code (native plugin)
- ✅ Cursor (auto-discovery)
- ✅ VS Code + GitHub Copilot (auto-discovery)
- ✅ Copilot CLI
- ✅ Codex, OpenCode, Gemini CLI, Vibe CLI, Cline

**Installation**:
```bash
curl -fsSL https://raw.githubusercontent.com/Lum1104/Understand-Anything/main/install.sh | bash
```

---

## Integration with LLMWiki

### Strong Fit: Enhanced Onboarding

**Use Case**: Auto-generate onboarding guides from knowledge graph

1. Run `/understand` to generate graph
2. Tour-builder agent creates structured onboarding paths
3. New devs explore interactively (no LLM cost, pre-computed)
4. For deep dives: `/understand-chat` uses Claude + graph context

**Benefit**: Replace static README files with interactive learning

### Augmentation: Exploration Workflows

**Current llmwiki**: Keyword-based file finding  
**Understand-Anything adds**: Semantic search + automatic layer detection

**Combined Workflow**:
1. Team runs `/understand` → generates `.understand-anything/knowledge-graph.json`
2. Commit graph to git
3. New dev clones repo, opens dashboard
4. Explores interactively (pre-computed, no LLM cost)
5. For questions: uses llmwiki chat features for deep dives

### Hybrid Advantage

- **Understand-Anything**: Pre-built, committable, incremental, offline-capable
- **LLMWiki**: Persistent documentation, cross-linking, wiki semantics
- **Combined**: Knowledge graph + persistent wiki = powerful development assistant

---

## Key Patterns Worth Adopting

### 1. Tree-Sitter for Deterministic Parsing

- Parses source into concrete syntax tree (CST)
- Extracts structural facts deterministically
- Resolves imports into reusable `importMap`
- Multi-language support out-of-box
- Alternative to LLM-only parsing (more reliable)

### 2. Multi-Agent Decomposition

- Specialized agents excel at specific tasks
- Parallel execution for performance
- Pre-resolved import map avoids redundant derivation
- Enables incremental updates and reusability

### 3. Committable Knowledge Graph

- Pre-built, `.understand-anything/knowledge-graph.json` committed to git
- Offline use (no LLM calls needed)
- Consistent across team (same graph, same answers)
- Git history tracks architecture changes
- Incremental updates via git-diff

### 4. Persona-Adaptive Complexity

- Nodes tagged with complexity levels
- UI filters based on user role
- Junior dev sees high-level concepts
- PM sees business domain mapping
- Power user sees code-level details

---

## Live Resources

- **Repository**: https://github.com/Lum1104/Understand-Anything
- **Demo**: https://understand-anything.com/demo/
- **Homepage**: https://understand-anything.com/
- **Design Doc**: https://github.com/Lum1104/Understand-Anything/blob/main/docs/superpowers/specs/2026-03-14-understand-anything-design.md
- **Discord Community**: https://discord.gg/pydat66RY

---

## Origin

Researched by explore agent (2026-05-24) and compiled from:
- GitHub repository analysis (Lum1104/Understand-Anything)
- Official documentation and design specifications
- Live demo and interactive platform review

**Source**: https://github.com/Lum1104/Understand-Anything
