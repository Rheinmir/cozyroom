---
complexity:
  power-user: "Agent registry, hooks, and continuous learning details"
---
# Everything Claude Code (ECC) Harness: Agent Orchestration System

**Repository**: affaanm/everythingclaudecode  
**GitHub Stars**: 146,000+  
**License**: MIT  
**Status**: Production-ready, mature

---

## Overview

Everything Claude Code (ECC) is a comprehensive **agent orchestration harness** for AI-assisted development. It provides:

- **47 specialized agents** for different development tasks
- **156-181 reusable workflow skills** across 12 language ecosystems
- **Hook-based behavior injection** (PreToolUse, PostToolUse, SessionStart, etc.)
- **Continuous learning system** with pattern recognition & confidence scoring
- **Multi-platform support** (Claude Code, Cursor, Codex, OpenCode, Gemini CLI)

---

## Core Architecture

### 1. Agent Registry (47 Specialized Agents)

#### Tier 1: Planning & Coordination

| Agent | Role |
|-------|------|
| **Planner** | Task decomposition, execution planning, resource allocation |
| **Architect** | System design, design patterns, scalability analysis |
| **Strategist** | High-level task planning and approach selection |

#### Tier 2: Implementation

| Agent | Role |
|-------|------|
| **TDD-Guide** | Test-driven development workflow guidance |
| **Implementer** | Code implementation |
| **Refactorer** | Code refactoring and optimization |

#### Tier 3: Quality & Review

| Agent | Role |
|-------|------|
| **Code-Reviewer** | Style violations, bugs, performance, best practices |
| **Security-Reviewer** | Injection attacks, auth, data exposure, compliance |
| **QA** | Testing and quality assurance |

#### Tier 4: Specialized Roles

- **Language-specific**: Python, JavaScript, TypeScript, Rust, Go, Java agents
- **Domain-specific**: frontend-developer, backend-developer
- **Utility**: documentation-writer, documentation-and-adrs, explorer, worker, monitor
- **Advanced**: protocol-reverse-engineering, recon, reviewer

### 2. Skills System (156-181 Reusable Workflows)

Skills are organized across **12 language ecosystems**:

#### By Category

| Category | Examples |
|----------|----------|
| **TDD Workflows** | Red-green-refactor, test generation, coverage analysis, mutation testing |
| **Security** | Vulnerability scanning, dependency auditing, compliance checking, secret detection |
| **Backend Patterns** | Database patterns, API design, caching strategies, microservices patterns |
| **Frontend Patterns** | Component architecture, state management, performance optimization, accessibility |
| **Language Idioms** | Python, JavaScript, TypeScript, Rust optimizations and best practices |
| **Real Tools** | agent-browser, agent-device, webapp-testing, playwright-cli |
| **Methodology** | diagnose, tdd, grill-with-docs, to-prd, to-issues, triage, zoom-out |
| **Domain Rules** | vercel-react-best-practices, web-design-guidelines, frontend-design |

#### Skill Standard Format (SKILL.md)

- **Progressive context disclosure**: Level 1 (metadata ~dozen tokens) → Level 2 (instructions ~5k tokens) → Level 3 (resources on-demand)
- **Hook-based behavior injection**: PreToolUse, PostToolUse, Stop hooks
- **Bundled scripts pattern**: Deterministic operations as subprocess (zero context cost)
- **Description-driven triggering**: Semantic routing based on skill descriptions

### 3. Hook System (20+ Automated Hooks)

Hooks enable **behavior injection** at key execution points:

#### Hook Types

| Hook Type | Timing | Purpose |
|-----------|--------|---------|
| **PreToolUse** | Before tool invocation | Validate inputs, modify inputs, enforce access control, logging, caching |
| **PostToolUse** | After tool invocation | Process results, validate results, trigger side effects, cleanup, notifications |
| **SessionStart** | Session initialization | Environment setup, context loading, state initialization, health checks |
| **SessionEnd** | Session termination | State persistence, cleanup, reporting, learning extraction, backups |
| **Stop** | Graceful shutdown | State preservation, notifications, cleanup |
| **PreCompact** | Before context compression | Context summarization, priority preservation, reference extraction |

#### Execution Model

- Hooks registered with: priority, condition, action, error-handling
- Execute synchronously in priority order
- Can modify context or trigger side effects
- Enable **96.7% success rate** improvements (measured: 30 assertions, 10 parallel subagents)

### 4. Continuous Learning System (v2.1)

#### Instinct-Based Learning with Confidence Scoring

**5-Phase Cycle**:

1. **Observation**: Capture all tool invocations, user decisions, code changes, errors to `observations.jsonl`
2. **Pattern Extraction**: Detect recurring workflows, problem-solving approaches, effective patterns
3. **Instinct Formation**: Validate patterns, assign confidence scores, define trigger conditions
4. **Knowledge Storage**: Index, link, tag with metadata, version all patterns
5. **Application**: Analyze context, retrieve matching instincts, apply based on confidence

#### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| **>90%** | Auto-apply instinct |
| **70-90%** | Suggest to user |
| **50-70%** | Store for reference |
| **<50%** | Discard or request more learning |

#### Observer Agent

- Claude Haiku runs every 5 minutes
- Analyzes tool calls and outcomes
- Detects patterns with confidence scores
- `/evolve` command synthesizes 3+ related instincts into SKILL.md files

**Example Instinct**:
```yaml
instinct_id: "parallel-testing-on-monorepo-changes"
confidence: 0.87
trigger: "User changes root tsconfig OR workspace package.json"
condition: "Monorepo structure detected"
action: "Run tests in parallel across affected workspaces"
examples:
  - "commit abc123: Changed shared types → auto-test all packages"
  - "commit def456: Updated Jest config → ran tests in parallel"
```

---

## Integration Architecture

### Multi-Platform Abstraction Layer

Normalizes agent definitions across platforms:

| Platform | Support | Integration Points |
|----------|---------|-------------------|
| **Claude Code** | Full | All 47 agents, 181 skills, native hook system, extended thinking |
| **Cursor IDE** | Full | Command palette invocation, VS Code semantic search, multi-file editing |
| **Codex** | Full | Completion-based interface, prompt optimization, GPT token management |
| **OpenCode** | Full | Community-driven agents, plugin architecture, subagent routing |
| **Gemini CLI** | Full | Reasoning patterns, Gemini-specific token optimization |

### Companion Systems Integration

#### agentmemory (MCP-based)
- Shared memory backend across all platforms
- API: `http://localhost:3111`
- UI: `http://localhost:3113`
- Enables persistent agent state across sessions

#### Herdr Multiplexer
- Cross-agent orchestration and state management
- Session multiplexing for parallel execution
- Zellij integration for terminal multiplexing
- Config: `~/.config/herdr/config.toml`

#### Impeccable (UI/UX Skill Suite)
- 20+ slash commands: `/audit`, `/polish`, `/normalize`, `/optimize`, `/harden`
- Installed to `~/.claude/skills/` and `~/.config/opencode/skills/`

---

## Key Architectural Patterns

### 1. Progressive Context Disclosure

**Problem**: Managing 100+ skills without bloating context window

**Solution**: Three-level loading
- **Level 1**: Metadata (~12 tokens each)
- **Level 2**: Instructions (~5k tokens on-demand)
- **Level 3**: Resources (linked separately)

**Implication for Wiki**: Wiki frontmatter as skill metadata; wiki body as instructions; linked resources as bundled scripts.

### 2. Hook-Based Behavior Injection

**Pattern**: PreToolUse hooks re-inject `task_plan.md` before every tool call

**Measured Success**:
- **With skill**: 96.7% pass rate (30 assertions, 10 parallel subagents)
- **Without skill**: 6.7% pass rate
- **Improvement**: +90% success rate

**Mechanism**: 
1. Plan file created at session start
2. PreToolUse hook reads plan before each tool
3. LLM context re-anchors to original goal
4. Prevents goal drift in long sessions

### 3. Filesystem as Working Memory

**Pattern**: Planning files (`task_plan.md`) used as persistent context anchors

**Benefits**:
- Prevents goal drift over long sessions
- Doesn't expand context window
- Survives agent restarts
- Auditable (committed to git)

### 4. Instinct System with Confidence Scoring

**Pattern**: Patterns automatically learned from execution traces

**Decision Threshold**:
- >90%: Auto-apply
- 70-90%: Suggest to user
- <50%: Discard

**Feedback Loop**:
1. Execution traces captured
2. Observer detects patterns (5min cycle)
3. Confidence scored
4. High-confidence patterns auto-applied

### 5. Cross-Platform Abstraction

**Pattern**: Single skill definition translates to platform-specific implementations

**Translation Process**:
- Prompt templates adapted for platform strengths
- Tool invocations mapped to platform APIs
- Hook execution semantics standardized
- Platform-specific configs preserved

---

## Integration with LLMWiki Workflow

### Strong Integration Points

#### Phase 1: Onboarding

**ECC Agents**: `documentation-writer`, `documentation-and-adrs`

**Workflow**:
1. Use ECC documentation agents to generate initial wiki structure
2. Produce: index.md, architecture.md, adr/*.md, onboarding.md
3. SessionStart hooks load project context
4. PreToolUse hooks inject wiki guidelines before generation

**Output**:
```
llmwiki/wiki/
├── index.md                 # Table of contents
├── concepts/
│   ├── Architecture.md      # System design (from ECC architect)
│   └── [pattern pages]      # From continuous learning
├── sources/
│   ├── adr/                 # Architecture Decision Records
│   └── onboarding.md        # Developer setup guide
```

#### Phase 2: Project Analysis

**ECC Agents**: `recon`, `explorer`, `architect`

**Skills**: `codebase-recon-skill`, `zoom-out`, `improve-codebase-architecture`

**Workflow**:
1. Deploy parallel agents for discovery
2. Analyze git history, module relationships, data flows
3. Identify architectural concerns and hotspots
4. PreCompact hooks extract key findings before context compression

**Output**:
```
analysis-findings.jsonl:
  - dependency-graph findings
  - hotspots (high-risk areas)
  - bus-factor (knowledge risks)
  - patterns (recurring architectural)
```

#### Phase 3: Continuous Knowledge Evolution

**ECC Instinct System**: Pattern detection + synthesis

**Workflow**:
1. Observer agent detects patterns from development activity (5min cycle)
2. Patterns fed to `/evolve` command
3. Synthesized into SKILL.md or wiki pages
4. Wiki updated with: "Discovered Pattern: [Name]" pages

**Output**:
```
wiki/concepts/
├── DiscoveredPattern-[name].md
└── ...

Metadata:
  - Pattern description & trigger conditions
  - Examples from codebase
  - Confidence score
  - Source traces
```

### Complementary System Map

| Aspect | ECC Harness | LLMWiki | Integration |
|--------|------------|---------|-------------|
| **Knowledge Container** | Skills (481 tokens avg) | Wiki pages (hierarchical) | Wiki hosts skills + ADRs |
| **Discovery** | Semantic skill search | Tag-based + semantic search | Combined routing: skill → wiki context |
| **Persistence** | Observable patterns (`observations.jsonl`) | Frontmatter + canonical pages | Wiki as knowledge graph; observations feed updates |
| **Learning** | Instinct formation (confidence scores) | Synthetically enriched summaries | Confidence scores tag wiki trustworthiness |
| **Governance** | Hook-based guardrails | Linting + link consistency | Pre/Post hooks validate wiki consistency |
| **Multi-tenant** | Per-project agent configs | Per-project wiki branches | Agents read project wiki; hooks publish to main |

---

## Governance & Security

### Security Governance Framework (Proposed)

| Level | Mechanism | Coverage |
|-------|-----------|----------|
| **G1** | Static analysis (SKILL.md validation) | Syntax, structure, obvious errors |
| **G2** | Semantic classification (LLM-based intent) | Malicious intent detection |
| **G3** | Sandboxed execution (isolated environments) | Runtime containment |
| **G4** | Behavioral monitoring (runtime anomaly detection) | Execution anomalies |

### Vulnerability Survey (42,447 skills analyzed)

- **26.1% contain vulnerabilities**
- **Skills with scripts 2.12x more vulnerable** than instruction-only
- **Primary attack vector**: PreToolUse hook repeated injection

**Implication**: Wiki content loaded via PreToolUse hooks requires strict input validation.

---

## Installation & File Structure

### Source Repository

```
affaanm/everything-claude-code/
├── skills/
│   ├── agentic-engineering/
│   ├── continuous-learning-v2/
│   └── ... (156-181 skill directories)
├── agents/
│   ├── code-reviewer.md
│   ├── architect.md
│   └── ... (47 agent definitions)
├── commands/
│   └── ecc-*.md (79 legacy commands)
└── hooks/
    └── (20+ hook definitions)
```

### Installation Paths

```
~/.claude/skills/everything-claude-code/
~/.claude/commands/ecc-*.md
~/.codex/agents/ecc-*.toml
~/.config/opencode/commands/ecc-*.md
```

---

## Key Advantages

✅ **Mature & Production-Ready**: 146,000+ stars, active community, real-world proven  
✅ **Multi-Platform**: Works with Claude Code, Cursor, Codex, OpenCode, Gemini  
✅ **Comprehensive Skill Library**: 156-181 skills, TDD, security, language-specific patterns  
✅ **Hook System**: Powerful behavior injection enabling 90%+ success improvements  
✅ **Continuous Learning**: Patterns extracted from execution, confidence-scored for reliability  
✅ **Efficient Execution**: Deterministic skills, reusable components, parallel execution  

---

## Live Resources

- **Repository**: https://github.com/affaanm/everythingclaudecode
- **Documentation**: https://py2ai.github.io/Everything-Claude-Code-AI-Agent-Harness/
- **Blog**: py2ai GitHub Pages
- **Community**: Growing open-source community, MIT licensed

---

## Origin

Researched by explore agent (2026-05-24) and compiled from:
- GitHub repository analysis (affaanm/everythingclaudecode)
- Official documentation and design specifications
- Community discussions and real-world usage patterns

**Source**: https://github.com/affaanm/everythingclaudecode
