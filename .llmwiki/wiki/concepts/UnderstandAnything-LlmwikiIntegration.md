---
complexity:
  junior: "Integration roadmap summary and phases"
---
# Integration Roadmap: ECC + Understand-Anything + LLMWiki

**Created**: 2026-05-24  
**Status**: Phase 1 Complete — Ready for Gemini & OpenCode Review

---

## Executive Summary

This roadmap outlines how to integrate two mature AI/developer tools:
- **Understand-Anything** (code analysis → interactive knowledge graphs)
- **ECC Harness** (agent orchestration → 47 agents + 156-181 skills)

...into the **LLMWiki** workflow for powerful codebase understanding and documentation.

### Complementary Strengths

| System | Strength |
|--------|----------|
| **Understand-Anything** | Deterministic code analysis (tree-sitter), multi-agent pipeline, knowledge graph structure, incremental updates |
| **ECC Harness** | Agent orchestration, hook system, continuous learning, skill management, multi-platform |
| **LLMWiki** | Knowledge persistence, hierarchical indexing, cross-linking, wiki semantics, team collaboration |
| **Combined** | **Knowledge graph + persistent wiki + agent orchestration = powerful development assistant** |

---

## Phase 1: Documentation & Analysis ✅ COMPLETE

### Deliverables

✅ `concepts/UnderstandAnything.md` — Full architecture, multi-agent pipeline, knowledge graph schema  
✅ `concepts/EccHarness.md` — Full architecture, agent registry, hook system, continuous learning  
✅ `concepts/UnderstandAnything-LlmwikiIntegration.md` — This file (integration roadmap)

### Research Summary

**Understand-Anything**:
- 6-7 specialized agents for code analysis
- Tree-sitter deterministic parsing + LLM semantic analysis
- Committable `.understand-anything/knowledge-graph.json` for offline use
- Multi-language support (8+ languages)
- Incremental updates via git-diff detection
- **Integration Fit**: Strong ✅✅✅ — Enhance onboarding, augment exploration

**ECC Harness**:
- 47 specialized agents + 156-181 workflow skills
- Hook-based behavior injection (90%+ success improvement)
- Continuous learning via instinct system with confidence scoring
- Multi-platform support (Claude Code, Cursor, Codex, OpenCode, Gemini)
- **Integration Fit**: Strong ✅✅✅ — Documentation generation, project analysis, continuous evolution

---

## Phase 2: Short-Term Integration Wins (2-3 weeks)

### Quick Wins: Adopt Best Practices

These are low-effort, high-value adoptions that improve llmwiki immediately.

#### 2.1: Adopt Tree-Sitter for Deterministic Parsing

**Current State**: LLM-based parsing (less reliable, language-specific)  
**Improvement**: Tree-sitter deterministic AST parsing

**Implementation**:
```typescript
// Instead of: LLM parses "find all functions in this file"
// Use tree-sitter:
const parser = new Parser();
parser.setLanguage(typescript);
const tree = parser.parse(sourceCode);
const functions = extractFunctionsFromAST(tree);  // Deterministic
// Then LLM: "Here are the functions, now what do they DO?"
```

**Benefits**:
- ✅ Multi-language out-of-box (Python, Go, Rust, TypeScript, Java, C/C++)
- ✅ Deterministic (same input = same output)
- ✅ Accurate call graphs and import trees
- ✅ Reusable `importMap` across analyses

**Effort**: Medium (1-2 days)  
**Impact**: High — Core foundation for better architecture understanding

---

#### 2.2: Add Complexity Levels to Wiki Nodes

**Current State**: All wiki entries at same complexity level  
**Improvement**: Add persona-based complexity (junior / power user / PM)

**Implementation**:
```yaml
# Wiki page frontmatter
---
title: Authentication Flow
complexity:
  junior: "High-level overview of login process"
  power-user: "Detailed code flows, JWT token handling, edge cases"
  pm: "User journey, security guarantees, SLA"
---
```

**In UI**: Filter view based on user role

**Benefits**:
- ✅ Junior devs see high-level concepts
- ✅ PMs see business domain mapping
- ✅ Power users see code-level details
- ✅ Same codebase, multiple lenses

**Effort**: Low (1 day — add complexity field to frontmatter, filter UI)  
**Impact**: Medium — Better onboarding for diverse teams

---

#### 2.3: Implement Incremental Updates via Git Fingerprinting

**Current State**: Re-analyze entire codebase on each request  
**Improvement**: Only re-analyze changed files

**Implementation**:
```yaml
# .llmwiki/meta.json
{
  "lastAnalyzedCommit": "abc123def456",
  "lastAnalyzedAt": "2026-05-24T16:00:00Z",
  "analyzedFiles": 342,
  "version": "1.0.0"
}

# On next request:
git diff $(lastAnalyzedCommit)..HEAD --name-only \
  | grep -E "(\.ts|\.py|\.go)$" \
  | xargs analyze-only-these-files.sh \
  | merge-into-existing-graph.py
```

**Benefits**:
- ✅ 10-100x faster for most changes
- ✅ Lower LLM API costs
- ✅ Consistent across team (same graph for same commit)
- ✅ Git history of architecture changes

**Effort**: Medium (2 days)  
**Impact**: High — Dramatically faster iteration

---

### Phase 2 Summary

- ✅ Tree-sitter parsing (deterministic, multi-language)
- ✅ Complexity-based views (junior / power user / PM)
- ✅ Incremental updates (only changed files)
- **Total Effort**: ~4 days  
- **Impact**: Faster, more reliable, more accessible wiki

---

## Phase 3: Medium-Term Integration (4-8 weeks)

### Build Committable Knowledge Graph

**Current State**: Wiki pages generated on-demand  
**Goal**: Pre-built, committable `.llmwiki/knowledge-graph.json`

#### 3.1: Implement Multi-Agent Decomposition Pipeline

Adopt Understand-Anything's agent pattern:

```
llmwiki-analysis flow:
  1. ProjectScanner (detect files + tech stack)
     ↓
  2. FileAnalyzer × N (parallel, 5 concurrent)
     ├─ Tree-sitter parse → AST
     ├─ LLM generate summaries, tags, complexity
     ↓
  3. ArchitectureAnalyzer (cluster into layers)
     ↓
  4. TourBuilder (generate onboarding paths)
     ↓
  5. GraphReviewer (validate integrity)
     ↓
  6. Output: .llmwiki/knowledge-graph.json
```

**Benefit**: Parallel execution, reusable components, fault isolation

**Effort**: 3-4 days  
**Impact**: Foundation for incremental updates, better performance

#### 3.2: Automatic Layer Detection

Enhance wiki structure with architectural layers:

```json
{
  "nodes": [...],
  "layers": [
    {
      "id": "api-layer",
      "name": "API Layer",
      "color": "#FF6B6B",
      "nodes": ["handlers/*", "routes/*"],
      "description": "HTTP endpoints and request handling"
    },
    {
      "id": "service-layer",
      "name": "Service Layer",
      "color": "#4ECDC4",
      "nodes": ["services/*"],
      "description": "Business logic and data processing"
    },
    // ... Data Layer, UI Layer, Utility Layer
  ]
}
```

**Auto-generates**: `concepts/Architecture.md` with layer breakdown

**Effort**: 2 days  
**Impact**: Better understanding of system structure

---

#### 3.3: Link Knowledge Graph to Wiki Pages

Connect graph nodes to wiki entries:

```yaml
# Node in knowledge-graph.json
{
  "id": "auth-handler",
  "name": "Authentication Handler",
  "wikiLink": "concepts/Authentication.md#handler",
  "summary": "...",
  "tags": ["auth", "handler", "middleware"]
}

# Wiki page frontmatter
---
id: auth-handler
graphNode: true
---
```

**Benefit**: Bidirectional linking between graph and wiki

**Effort**: 1 day  
**Impact**: Medium — Better cross-referencing

---

### Phase 3 Summary

- ✅ Multi-agent analysis pipeline
- ✅ Automatic layer detection
- ✅ Committable knowledge graph
- ✅ Graph ↔ Wiki bidirectional links
- **Total Effort**: 6-7 days  
- **Timeline**: 1-2 sprints

---

## Phase 4: Long-Term Vision (8-16 weeks)

### Domain/Business Logic Extraction

Identify business domains and workflows:

```yaml
# concepts/BusinessDomains.md
domains:
  - name: "Payment Processing"
    flows:
      - "User initiates checkout"
      - "System calls payment gateway"
      - "Transaction confirmed or rejected"
    entities:
      - Invoice
      - PaymentMethod
      - Transaction
  - name: "User Authentication"
    flows:
      - "User enters credentials"
      - "System validates"
      - "JWT token issued"
```

**Benefit**: Non-technical stakeholders understand code structure  
**Effort**: 3-4 days  
**Impact**: Medium

---

### Interactive Dashboard

Build React dashboard to explore knowledge graph:

```
Features:
- Force-directed graph visualization (React Flow)
- Fuzzy + semantic search
- Layer color-coding
- Info panel (click node → details)
- Code viewer (Monaco Editor)
- Tour generation (guided learning)
```

**Benefit**: Visual codebase exploration  
**Effort**: 2-3 weeks  
**Impact**: High

---

### Guided Tour Generation

Auto-generate onboarding paths:

```yaml
# Tour: "New Backend Developer"
tour:
  - Step 1: "Architecture Overview" (concepts/Architecture.md)
  - Step 2: "Database Schema" (concepts/DatabaseSchema.md)
  - Step 3: "API Routes" (concepts/ApiRoutes.md)
  - Step 4: "Authentication" (concepts/Authentication.md)
  - Step 5: "Error Handling" (concepts/ErrorHandling.md)
```

**Benefit**: Structured onboarding  
**Effort**: 2-3 days  
**Impact**: Medium

---

### Semantic + Fuzzy Search

Search the knowledge graph by meaning:

```
User query: "How does payment work?"
Results:
  - Payment Processing domain
  - Checkout handler
  - Payment gateway integration
  - Transaction model
```

**Benefit**: Find code by intent, not just naming  
**Effort**: 1-2 days (build on graph)  
**Impact**: High

---

## Phase 4 Summary

- ✅ Domain/business logic extraction
- ✅ Interactive React dashboard
- ✅ Guided tour generation
- ✅ Semantic + fuzzy search
- **Total Effort**: 3-4 weeks  
- **Timeline**: 1-2 months

---

## Integration with ECC Harness

### Use ECC Skills for Wiki Generation

#### `documentation-writer` Agent

Triggers: Initial project setup  
Inputs: Project structure, README, git history  
Outputs:
- index.md (table of contents)
- architecture.md (system design)
- adr/*.md (architecture decision records)
- onboarding.md (developer setup guide)

**Workflow**:
```bash
# Session initialization
$ orca orchestration task-create \
  --spec "Generate initial wiki structure using documentation-writer agent" \
  --json

# ECC dispatches documentation-writer
# Generates wiki pages in llmwiki/wiki/sources/
# PreToolUse hooks inject wiki guidelines
# PostToolUse hooks update index.md
```

#### `codebase-recon` Skill

Triggers: Project analysis phase  
Inputs: Codebase files, git log, dependency manifests  
Outputs:
- dependency-graph.md (module relationships)
- hotspots.md (high-risk areas)
- bus-factor.md (knowledge risks)

---

### Continuous Learning Loop

ECC instinct system feeds discovered patterns into wiki:

```yaml
Workflow:
  1. Observer Agent (Claude Haiku, 5min cycle)
     Analyzes tool calls & outcomes
     Detects patterns with confidence scores

  2. High-confidence patterns (>90%)
     Triggers /evolve command
     Synthesizes into new skills

  3. Wiki Integration
     New skill → wiki page (concepts/DiscoveredPattern-*.md)
     Includes:
       - Pattern description
       - Trigger conditions
       - Examples from codebase
       - Confidence score
       - Source traces
```

---

## Success Criteria

### Phase 2 (Short-Term)
- ✅ Tree-sitter integrated for 3+ languages
- ✅ Complexity levels added to 5+ wiki pages
- ✅ Incremental updates working for sample project
- ✅ No breaking changes to current workflow

### Phase 3 (Medium-Term)
- ✅ Knowledge graph generated and committed to git
- ✅ Automatic layer detection working
- ✅ 100+ wiki pages cross-linked to graph nodes
- ✅ Documentation generation fully automated

### Phase 4 (Long-Term)
- ✅ Interactive dashboard live
- ✅ Semantic search working
- ✅ Guided tours generating automatically
- ✅ New team members onboarded 50% faster

---

## Risk Mitigation

### Risk 1: Performance Degradation

**Issue**: Large projects (1000+ files) may slow down analysis  
**Mitigation**: 
- Implement caching at file level
- Parallel analysis (5 concurrent workers)
- Pre-commit hooks for incremental analysis

### Risk 2: Accuracy of Auto-Generated Content

**Issue**: LLM-generated summaries may be inaccurate  
**Mitigation**:
- Confidence scoring (high-confidence content auto-applied)
- Human review gates for critical pages
- Version control for audit trails

### Risk 3: Integration Complexity

**Issue**: Integrating 3 systems (Understand-Anything + ECC + LLMWiki) is complex  
**Mitigation**:
- Phase-based rollout (low-risk wins first)
- Thorough testing at each phase
- Documentation and runbooks

---

## Recommended Agent Distribution (Execution)

Based on user feedback:

### Gemini (Primary Review & Analysis)
- ✅ Deep architectural validation
- ✅ Cross-check findings from multiple perspectives
- ✅ Identify integration risks and opportunities
- ✅ Validate technical recommendations

### OpenCode (Secondary Review)
- ✅ Test integration concepts on live codebase
- ✅ Provide alternative perspectives
- ✅ Identify practical implementation challenges

### Copilot + Antigravity (Execution)
- ✅ Implement Phase 2 quick wins
- ✅ Create wiki documentation
- ✅ Build pilot implementations
- ✅ Develop integration runbooks

---

## Next Steps

1. **Submit to Gemini for Deep Review** (Phase 1 Complete)
   - Validate architectural recommendations
   - Cross-check integration feasibility
   - Identify missing considerations

2. **OpenCode Secondary Review**
   - Test on actual codebase
   - Identify practical challenges

3. **Copilot + Antigravity Implementation**
   - Phase 2: Tree-sitter, complexity levels, incremental updates
   - Phase 3: Knowledge graph, auto layer detection
   - Phase 4: Dashboard, search, guided tours

---

## Origin

Research: explore agents (2026-05-24)  
Documentation: Copilot CLI (2026-05-24)  
Sources:
- https://github.com/Lum1104/Understand-Anything
- https://github.com/affaanm/everythingclaudecode
- llmwiki architecture and design principles

**Status**: Ready for Gemini & OpenCode review
