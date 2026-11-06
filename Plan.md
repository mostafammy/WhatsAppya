# Engineering Implementation Plan
## Next-Generation Multi-Tier Curricular & Knowledge Platform Architecture
### Support for Multiple Blocks, Multiple Subjects, and Multiple Chapters
### Document ID: PLAN-APPL-ACAD-2026-V2
**Classification:** Apple Internal Implementation Roadmap  
**Target Delivery:** Apple Enterprise & Educational Standard  
**Standards:** Apple Human Interface Guidelines (HIG), SOLID Architecture, GoF Patterns, Zero-Dependency Python 3.10+ Standard Library

---

## 1. Executive Overview & Objectives

This implementation plan translates [SPECIFICATION.md](file:///Users/mac/Documents/BeautifyWhatsAppExport/SPECIFICATION.md) into concrete, test-driven, verifiable engineering steps. 

The primary objectives are:
1. **Architect Multi-Tier Curricular Hierarchy (Composite Pattern)**: Implement immutable, type-safe domain entities for **Blocks**, **Subjects**, and **Chapters** conforming to a unified `IHierarchyNode` protocol.
2. **Implement Dual Discovery Engine (Convention & Manifest)**: Support automatic directory layout scanning (Convention-over-Configuration) and explicit declarative manifests (`curriculum.json`).
3. **Build Cupertino Three-Column Navigation Split-View**: Deliver an authentic macOS Sequoia / iPadOS 18 three-column navigation interface with instant sidebar filtering, breadcrumb paths, and fluid animations.
4. **Universal Spotlight Search (⌘K / ⌘F)**: In-memory client-side search index capable of sub-20ms queries across thousands of chapters, messages, audio notes, and media attachments.
5. **Zero-Cloud, 100% On-Device Privacy**: Standalone execution with zero external CDN dependencies, zero network egress, and strict Content Security Policy.
6. **100% Deterministic Reliability & QA**: Comprehensive test harness covering edge cases (empty blocks, malformed folders, missing media, BiDi Arabic/English text).

---

## 2. Target File Structure & SOLID Organization

```
BeautifyWhatsAppExport/
├── main.py                         # High-level CLI entrypoint orchestrating pipeline
├── converter/                      # Core Package (SOLID & OOP Architecture)
│   ├── __init__.py
│   ├── domain/                     # Immutable Domain Entities & Value Objects
│   │   ├── __init__.py
│   │   ├── hierarchy.py            # IHierarchyNode, BlockNode, SubjectNode, ChapterNode, CurriculumRoot
│   │   ├── models.py               # ChatMessage, Attachment, Sender, ChatSession, VoiceNote
│   │   └── enums.py                # MessageType, MediaType, Direction, NodeTier
│   ├── discovery/                  # Hierarchy Discovery & Manifest Engine
│   │   ├── __init__.py
│   │   ├── base.py                 # IHierarchyScanner (Abstract Base Class)
│   │   ├── convention.py           # DirectoryConventionScanner (Auto-inferred directory tree)
│   │   ├── manifest.py             # ManifestScanner (curriculum.json schema parser)
│   │   └── factory.py              # ScannerFactory (Selects appropriate scanner)
│   ├── parsers/                    # Strategy Pattern Parsing Engine
│   │   ├── __init__.py
│   │   ├── base.py                 # IChatParser Abstract Strategy
│   │   ├── factory.py              # ParserFactory (iOS vs Android format detector)
│   │   ├── ios.py                  # IOSChatParser (Bracketed timestamps, Arabic/Latin BiDi)
│   │   └── android.py              # AndroidChatParser (Hyphenated timestamps)
│   ├── search/                     # Inverted Index & Fast Search Engine
│   │   ├── __init__.py
│   │   ├── indexer.py              # SearchIndexer (Tokenizes Blocks, Subjects, Chapters, Messages)
│   │   └── models.py               # SearchResult, SearchQuery, MatchHighlight
│   ├── pipeline/                   # Content & Media Resolution Pipeline
│   │   ├── __init__.py
│   │   ├── media.py                # MediaResolver (Relative path resolution & MIME detection)
│   │   ├── link.py                 # RichLinkExtractor (Domain badge & preview card builder)
│   │   └── audio.py                # SyntheticPeakGenerator (Deterministic audio waveforms)
│   └── renderers/                  # Presentation & Cupertino Builders
│       ├── __init__.py
│       ├── base.py                 # ICurriculumRenderer
│       ├── builder.py              # CupertinoShellBuilder (Builder Pattern)
│       └── components/             # Reusable HIG Web Components
│           ├── __init__.py
│           ├── navigation.py       # Three-Column Split-View & Sidebar Navigation
│           ├── breadcrumbs.py      # Hierarchical Interactive Breadcrumbs
│           ├── chapter_view.py     # Chapter Content Canvas & Message Feed
│           ├── voice_player.py     # Custom Canvas Audio Waveform Player
│           └── search_modal.py     # Spotlight ⌘K Search Overlay
├── assets/                         # Static Web Assets (Vanilla HTML5/CSS3/ES6)
│   ├── template.html               # Cupertino Application Shell Template
│   ├── style.css                   # Apple HIG Design System (Light/Dark Mode, SF Pro)
│   └── script.js                   # Client-side State Manager, Search Engine & Audio Player
├── tests/                          # Automated Verification & Test Suite
│   ├── test_hierarchy_domain.py    # Unit tests for Block, Subject, Chapter tree operations
│   ├── test_discovery.py           # Tests for convention and manifest scanners
│   ├── test_parsers.py             # Unit tests for iOS and Android chat parsers
│   ├── test_search_indexer.py      # Unit tests for inverted index generation
│   ├── test_renderers.py           # Tests for HTML shell builder and component rendering
│   └── test_end_to_end.py          # End-to-end integration and fuzzing tests
├── SPECIFICATION.md                # Apple Engineering Specification
└── Plan.md                         # This Implementation Roadmap
```

---

## 3. Phased Execution Roadmap

```
                               PHASED EXECUTION TIMELINE
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Domain Modeling & Composite Tree Architecture                                 │
│ ├─ Define IHierarchyNode interface with Composite Pattern                              │
│ ├─ Implement BlockNode, SubjectNode, ChapterNode, CurriculumRoot                       │
│ └─ Establish immutable stats calculation and visitor support                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Dual Discovery Engine (Convention & Manifest)                                 │
│ ├─ Build DirectoryConventionScanner for zero-config folder trees                       │
│ ├─ Build ManifestScanner with JSON schema validation                                   │
│ └─ Create ScannerFactory with auto-detection heuristics                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Parser Integration & Chapter Content Aggregator                               │
│ ├─ Connect IChatParserStrategy to ChapterNode instances                                │
│ ├─ Integrate MediaResolver with offline fallback support                               │
│ └─ Build SearchIndexer for cross-tier full-text indexing                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Cupertino Three-Column Split-View & Navigation UI                             │
│ ├─ Design responsive 3-column split-view layout (Blocks / Subjects-Chapters / Canvas)  │
│ ├─ Implement interactive Breadcrumb navigator and URL hash routing                     │
│ └─ Add instant sidebar filter and collapse controls (⌘\, ⌘1, ⌘2, ⌘3)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Advanced Cupertino Studio Features                                            │
│ ├─ Integrate Canvas Voice Message Waveform Player with variable speed (1x/1.5x/2x)     │
│ ├─ Embed Universal Spotlight Search (⌘K) modal with hierarchical grouping              │
│ └─ Ensure Apple HIG Dark Mode, dynamic vibrancy, and BiDi typography harmony           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: QA Test Harness, Edge-Case Hardening & Benchmarking                           │
│ ├─ Execute unit tests with 100% coverage on domain and scanners                        │
│ ├─ Fuzz test with empty blocks, orphaned media, and multi-lingual naming               │
│ └─ Validate sub-16ms frame budget and memory profile under heavy loads                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Implementation Tasks

### Phase 1: Domain Modeling & Composite Tree Architecture
- [ ] **Task 1.1: Create Domain Core Interfaces (`converter/domain/hierarchy.py`)**
  - Implement `IHierarchyNode` abstract base class defining:
    - `id: str`, `title: str`, `description: Optional[str]`, `tier: NodeTier`
    - `get_children() -> Sequence[IHierarchyNode]`
    - `get_stats() -> NodeStats` (recursively calculates message count, media count, audio duration)
    - `accept(visitor: IHierarchyVisitor) -> None`
- [ ] **Task 1.2: Implement Concrete Hierarchy Nodes**
  - `BlockNode`: Contains `subjects: List[SubjectNode]`, curricular `code`, `term`, `badge`.
  - `SubjectNode`: Contains `chapters: List[ChapterNode]`, `code`, `accent_color`, `instructor`.
  - `ChapterNode`: Contains `chapter_number`, `chat_session: Optional[ChatSession]`, `resources: List[Attachment]`.
  - `CurriculumRoot`: Top-level composite root managing all blocks, global search index, and metadata.
- [ ] **Task 1.3: Define Value Objects & Enums (`converter/domain/enums.py`)**
  - `NodeTier.BLOCK`, `NodeTier.SUBJECT`, `NodeTier.CHAPTER`.
  - Immutable `@dataclass(frozen=True)` for `NodeStats`, `NodeMetadata`, and `BreadcrumbItem`.

### Phase 2: Dual Discovery Engine
- [ ] **Task 2.1: Implement Directory Convention Scanner (`converter/discovery/convention.py`)**
  - Scan directory paths automatically:
    - Top directories matching `Block*` or containing subfolders are mapped to `BlockNode`s.
    - Second-tier folders are mapped to `SubjectNode`s.
    - Third-tier folders containing `_chat.txt` or chat export files are mapped to `ChapterNode`s.
  - Automatically sanitize titles (e.g. `Block 1 - Cardiology` -> Title: "Cardiology", Code: "Block 1").
- [ ] **Task 2.2: Implement Declarative Manifest Scanner (`converter/discovery/manifest.py`)**
  - Detect and parse `curriculum.json` or `apple-curriculum.json`.
  - Provide fallback defaults for any omitted fields.
  - Gracefully handle syntax errors with user-friendly diagnostics.
- [ ] **Task 2.3: Build Scanner Factory (`converter/discovery/factory.py`)**
  - Check if a manifest file exists in the target root: if yes, invoke `ManifestScanner`; otherwise, invoke `DirectoryConventionScanner`.

### Phase 3: Parser Integration & Chapter Content Aggregator
- [ ] **Task 3.1: Connect Strategy Parsers to Chapters**
  - For each `ChapterNode`, discover its chat export file (`_chat.txt` or `WhatsApp Chat*.txt`).
  - Pass the file to `ParserFactory.get_parser()` to parse messages using `IOSChatParser` or `AndroidChatParser`.
  - Attach the resulting `ChatSession` to the `ChapterNode`.
- [ ] **Task 3.2: Media & Resource Resolution**
  - Map relative media paths within each chapter's `media/` folder or root folder.
  - Calculate MIME types, file sizes, and verify physical existence on disk.
  - Mark missing files cleanly with placeholder states without interrupting execution.
- [ ] **Task 3.3: In-Memory Search Index Generation (`converter/search/indexer.py`)**
  - Traverse the curriculum tree to construct an inverted search index:
    - Index Block titles and codes.
    - Index Subject names, departments, and instructors.
    - Index Chapter titles and numbers.
    - Index individual chat messages, voice notes, and media descriptions.
  - Export the search index into a lightweight, compressed JSON structure embedded in the web deliverable.

### Phase 4: Cupertino Three-Column Split-View & Navigation UI
- [ ] **Task 4.1: Develop Cupertino Application Shell (`assets/template.html`)**
  - Structure semantic layout:
    - Column 1 (`#block-sidebar`): Visual cards for each Block with subject counters and progress badges.
    - Column 2 (`#subject-sidebar`): Accordion/list view of Subjects with nested Chapter pills.
    - Column 3 (`#content-canvas`): Active Chapter reader, interactive breadcrumbs, and stats banner.
- [ ] **Task 4.2: Build Responsive CSS System (`assets/style.css`)**
  - Apple HIG typography using `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"`.
  - Cupertino Vibrancy with `backdrop-filter: blur(20px) saturate(180%)`.
  - Complete Dark Mode support via `prefers-color-scheme: dark` and manual toggle `.theme-dark`.
  - Responsive breakpoints for macOS (3 columns), iPad (collapsible sidebar), and iPhone (drilldown navigation).
- [ ] **Task 4.3: Implement Client-Side Navigation State Manager (`assets/script.js`)**
  - Hash-based client routing: `#/<block_id>/<subject_id>/<chapter_id>`.
  - Browser history push/pop support with zero page reloads.
  - Keyboard shortcuts:
    - `⌘\` or `Ctrl+\`: Toggle Sidebar.
    - `⌘1`, `⌘2`, `⌘3`: Switch active columns.
    - `ArrowUp` / `ArrowDown`: Navigate chapters.
    - `⌘K` or `⌘F`: Open Spotlight Search.

### Phase 5: Advanced Cupertino Studio Features
- [ ] **Task 5.1: Interactive Breadcrumbs Component**
  - Render dynamic breadcrumb path at the top of the canvas:
    `[ Platform] › [Block 1: Foundations] › [Cardiology] › [Chapter 3: Heart Valves]`.
  - Each item is clickable to reveal a Cupertino popover menu of sibling items.
- [ ] **Task 5.2: Spotlight Universal Search Modal**
  - Full-screen blur overlay triggered by `⌘K`.
  - Live query input with instant result categorization:
    - "Blocks (2)", "Subjects (4)", "Chapters (12)", "Messages (85)".
  - Arrow key navigation through results with `Enter` to navigate directly to the matched chapter and message anchor.
- [ ] **Task 5.3: Voice Note Canvas Player Integration**
  - Integrate custom canvas waveform renderer for voice notes.
  - Interactive scrubbing, elapsed/remaining time toggle, and 1.0x / 1.5x / 2.0x playback speed controls.

### Phase 6: QA Test Harness, Edge-Case Hardening & Benchmarking
- [ ] **Task 6.1: Unit & Domain Tests (`tests/test_hierarchy_domain.py`)**
  - Test composite tree integrity, recursive node statistics, and visitor patterns.
- [ ] **Task 6.2: Discovery & Fuzzing Tests (`tests/test_discovery.py`)**
  - Test missing folders, empty blocks, special characters in subject titles, and malformed manifests.
- [ ] **Task 6.3: End-to-End Build & Benchmark Tests (`tests/test_end_to_end.py`)**
  - Execute full generation pipeline on a multi-block, multi-subject, multi-chapter test fixture.
  - Verify that the resulting standalone HTML file opens without external network requests and renders in under 250ms.

---

## 5. Verification Commands & QA Acceptance Checklist

```bash
# 1. Run full test suite with coverage
python3 -m unittest discover -s tests -p "test_*.py" -v

# 2. Run CLI in convention discovery mode on multi-tier directory
python3 main.py "sample_curriculum" --output "dist/curriculum.html"

# 3. Run CLI in manifest mode
python3 main.py --manifest "sample_curriculum/curriculum.json" --output "dist/curriculum.html"

# 4. Validate zero network dependencies
grep -E "http://|https://" dist/curriculum.html || echo "PASS: 100% Zero External CDN Calls"
```

### QA Sign-Off Criteria:
- [ ] **100% Tree Stability**: Zero unhandled exceptions on corrupt or missing directories.
- [ ] **120 FPS Navigation**: Sub-16ms chapter switches on client side.
- [ ] **Sub-20ms Search**: Instantaneous search across all Blocks, Subjects, and Chapters.
- [ ] **Full Apple HIG Fidelity**: Flawless Light & Dark mode rendering with SF Pro typography.
- [ ] **Zero Cloud Telemetry**: 100% on-device private execution.
