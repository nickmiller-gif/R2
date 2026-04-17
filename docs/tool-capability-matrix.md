# Tool Capability Matrix — Action-Level View (Layman)

> Fine-grained, human-readable view of every action an agent or user can perform.
> 111 action-level capabilities seeded by `202604170001_action_level_capabilities_supplement.sql`.
>
> **Complements** the canonical `edge.*` catalog (64 rows, seeded by `202604130002`)
> which gates policy at the edge-function level. See
> [`tool-capabilities-catalog.md`](./tool-capabilities-catalog.md) for that view,
> and [`TOOL-CAPABILITIES-README.md`](./TOOL-CAPABILITIES-README.md) for the system overview.

## Legend

| Icon | Meaning |
|------|---------|
| 👁️ | Read-only (safe) |
| ✏️ | Write (changes data) |
| ✅ | No approval needed |
| 👤 | User approval required |
| 🛡️ | Admin approval required |
| 🟢 | Low blast radius (single record, easy to undo) |
| 🟡 | Medium blast radius (affects multiple records or pipeline state) |
| 🔴 | High blast radius (money, permissions, publications, or cascading effects) |

## Role Hierarchy

`member` → `reviewer` → `operator` → `counsel` → `admin` → `service_role`

Higher roles inherit lower permissions. Most writes require **operator**; role management requires **admin**; outbox drain requires **service_role**.

---

## Eigen — Knowledge, Memory, Retrieval (27 capabilities)

### Chat & Widget
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-chat` | Internal RAG chat with memory writes | member | 👤 | 🟢 |
| `eigen-chat-public` | Public-corpus chat (IP rate-limited) | anyone | ✅ | 🟢 |
| `eigen-widget-chat` | Embedded site widget chat | anyone w/ token | ✅ | 🟢 |
| `eigen-widget-session` | Create widget session (validates origin) | anyone w/ token | ✅ | 🟢 |

### Ingest & Retrieve
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-fetch-ingest` | Fetch a URL and ingest it | member | 👤 | 🟡 |
| `eigen-ingest` | Ingest document content | member | 👤 | 🟡 |
| `eigen-retrieve` | Semantic search over knowledge | member | ✅ | 🟢 |

### Knowledge Chunks
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-knowledge-chunks-read` | List knowledge chunks | member | ✅ | 🟢 |
| `eigen-knowledge-chunks-create` | Manually add a chunk | operator | 👤 | 🟡 |
| `eigen-knowledge-chunks-update` | Edit a chunk | operator | 👤 | 🟡 |

### Memory
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-memory-entries-read` | Read own memory entries | member | ✅ | 🟢 |
| `eigen-memory-entries-recall` | Recall by scope/key | member | ✅ | 🟢 |
| `eigen-memory-entries-create` | Store new memory | member | ✅ | 🟢 |
| `eigen-memory-entries-upsert` | Create-or-update memory | member | ✅ | 🟢 |
| `eigen-memory-entries-update` | Edit own memory | member | ✅ | 🟢 |
| `eigen-memory-entries-supersede` | Mark memory superseded | member | ✅ | 🟢 |
| `eigen-memory-entries-sweep` | GC expired memory (auto) | member | 👤 | 🟡 |

### Retrieval Runs (Audit Trail)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-retrieval-runs-read` | List retrieval history | member | ✅ | 🟢 |
| `eigen-retrieval-runs-create` | Start tracked retrieval | operator | 👤 | 🟢 |
| `eigen-retrieval-runs-complete` | Mark run complete | operator | 👤 | 🟢 |
| `eigen-retrieval-runs-fail` | Mark run failed | operator | 👤 | 🟢 |

### Config & Admin
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `eigen-public-sources` | List public sources | anyone | ✅ | 🟢 |
| `eigen-source-inventory` | Full source inventory | member | ✅ | 🟢 |
| `eigen-tool-capabilities-read` | Read this catalog | member | ✅ | 🟢 |
| `eigen-tool-capabilities-create` | Register a tool | operator | 🛡️ | 🟡 |
| `eigen-tool-capabilities-update` | Modify a tool entry | operator | 🛡️ | 🟡 |
| `eigen-oracle-outbox-drain` | Process signal outbox (cron) | service_role | 🛡️ | 🔴 |

---

## Charter — Governance Kernel (29 capabilities)

### Roles (RBAC)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `charter-roles-read` | See who has what role | member | ✅ | 🟢 |
| `charter-roles-assign` | Grant a role to a user | **admin** | 🛡️ | 🔴 |
| `charter-roles-update` | Change a role assignment | **admin** | 🛡️ | 🔴 |

### Entities, Rights, Obligations, Evidence, Decisions
All follow the same pattern: read is free, create/update needs operator + user approval.

| Domain | Read | Create | Update |
|--------|------|--------|--------|
| Entities | `charter-entities-read` ✅ | `charter-entities-create` 👤 | `charter-entities-update` 👤 |
| Rights | `charter-rights-read` ✅ | `charter-rights-create` 👤 | `charter-rights-update` 👤 |
| Obligations | `charter-obligations-read` ✅ | `charter-obligations-create` 👤 | `charter-obligations-update` 👤 |
| Evidence | `charter-evidence-read` ✅ | `charter-evidence-create` 👤 | `charter-evidence-update` 👤 |
| Decisions | `charter-decisions-read` ✅ | `charter-decisions-create` 👤 | `charter-decisions-update` 👤 |

### Governance Lifecycle
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `charter-governance-read` | Read governance entities | member | ✅ | 🟢 |
| `charter-governance-create` | Propose governance action | operator | 👤 | 🟡 |
| `charter-governance-update` | Edit governance record | operator | 👤 | 🟡 |
| `charter-governance-transition` | Change lifecycle status | operator | 🛡️ | 🔴 |

### Payouts (Money 💰)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `charter-payouts-read` | See payout records | member | ✅ | 🟢 |
| `charter-payouts-create` | Draft a payout | operator | 👤 | 🔴 |
| `charter-payouts-update` | Edit a payout | operator | 👤 | 🔴 |
| `charter-payouts-approve` | **Authorize payment** | operator | 🛡️ | 🔴 |

### Audit & Provenance (immutable)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `charter-provenance-read` | Read event chain | member | ✅ | 🟢 |
| `charter-provenance-create` | Append provenance event | operator | 👤 | 🟢 |
| `charter-audit-read` | Read audit log | member | ✅ | 🟢 |

### Valuations
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `charter-asset-valuations-read` | Read valuations | member | ✅ | 🟢 |
| `charter-asset-valuations-create` | Record valuation | operator | 👤 | 🟡 |
| `charter-asset-valuations-update` | Edit valuation | operator | 👤 | 🟡 |

---

## Foundation — Assets & Documents (10 capabilities)

| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `foundation-asset-registry-read` | List assets | member | ✅ | 🟢 |
| `foundation-asset-registry-create` | Register asset | operator | 👤 | 🟡 |
| `foundation-asset-evidence-links-read` | Read asset ↔ evidence links | member | ✅ | 🟢 |
| `foundation-asset-evidence-links-create` | Link evidence to asset | operator | 👤 | 🟢 |
| `foundation-asset-evidence-links-delete` | Unlink evidence | operator | 👤 | 🟡 |
| `foundation-documents-read` | List documents | member | ✅ | 🟢 |
| `foundation-documents-create` | Add document | operator | 👤 | 🟡 |
| `foundation-documents-update` | Edit document | operator | 👤 | 🟡 |
| `foundation-documents-mark-indexed` | Pipeline state flip | operator | 👤 | 🟢 |
| `foundation-documents-mark-embedded` | Pipeline state flip | operator | 👤 | 🟢 |

---

## MEG — Master Entity Graph (13 capabilities)

### Entities
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `meg-entities-read` | List entities | member | ✅ | 🟢 |
| `meg-entities-create` | Register entity | operator | 👤 | 🟡 |
| `meg-entities-update` | Patch entity | operator | 👤 | 🟡 |
| `meg-entities-merge` | **Merge two entities** | operator | 🛡️ | 🔴 |
| `meg-entities-archive` | Soft-delete entity | operator | 🛡️ | 🟡 |

### Aliases (name → entity lookup)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `meg-entity-aliases-read` | List aliases | member | ✅ | 🟢 |
| `meg-entity-aliases-resolve` | Name → entity lookup | member | ✅ | 🟢 |
| `meg-entity-aliases-create` | Add alias | operator | 👤 | 🟢 |
| `meg-entity-aliases-delete` | Remove alias | operator | 👤 | 🟢 |

### Edges (relationships)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `meg-entity-edges-read` | Read graph edges | member | ✅ | 🟢 |
| `meg-entity-edges-create` | Add relationship | operator | 👤 | 🟢 |
| `meg-entity-edges-update` | Update edge metadata | operator | 👤 | 🟢 |
| `meg-entity-edges-delete` | Remove relationship | operator | 👤 | 🟡 |

---

## Oracle — Signals & Theses (29 capabilities)

### Signals (market/data signals)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `oracle-signals-read` | List signals | member | ✅ | 🟢 |
| `oracle-signals-create` | Draft signal | operator | 👤 | 🟡 |
| `oracle-signals-update` | Edit signal | operator | 👤 | 🟡 |
| `oracle-signals-rescore` | Refresh signal scoring | operator | 👤 | 🟡 |
| `oracle-signals-publish` | **Make signal public** | operator | 🛡️ | 🔴 |
| `oracle-signals-approve` | Approve signal for pub | operator | 🛡️ | 🟡 |
| `oracle-signals-reject` | Reject signal | operator | 🛡️ | 🟡 |
| `oracle-signals-defer` | Defer signal decision | operator | 🛡️ | 🟢 |

### Theses (investment theses)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `oracle-theses-read` | List theses | member | ✅ | 🟢 |
| `oracle-theses-create` | Draft thesis | operator | 👤 | 🟡 |
| `oracle-theses-update` | Edit thesis | operator | 👤 | 🟡 |
| `oracle-theses-publish` | **Publish thesis** | operator | 🛡️ | 🔴 |
| `oracle-theses-challenge` | Flag thesis as challenged | operator | 🛡️ | 🟡 |
| `oracle-theses-supersede` | Replace thesis w/ new one | operator | 🛡️ | 🔴 |

### Evidence & Source Packs
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `oracle-evidence-items-read` | List evidence | member | ✅ | 🟢 |
| `oracle-evidence-items-create` | Add evidence | operator | 👤 | 🟡 |
| `oracle-evidence-items-update` | Edit evidence | operator | 👤 | 🟡 |
| `oracle-source-packs-read` | List source packs | member | ✅ | 🟢 |
| `oracle-source-packs-create` | Bundle sources | operator | 👤 | 🟢 |
| `oracle-thesis-evidence-links-read` | Read thesis ↔ evidence | member | ✅ | 🟢 |
| `oracle-thesis-evidence-links-create` | Link thesis to evidence | operator | 👤 | 🟢 |
| `oracle-thesis-evidence-links-delete` | Unlink | operator | 👤 | 🟡 |

### Whitespace Analysis (AI-driven)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `oracle-whitespace-runs-read` | Read analysis run | member | ✅ | 🟢 |
| `oracle-whitespace-runs-execute` | **Run AI analysis** | operator | 🛡️ | 🔴 |
| `oracle-whitespace-runs-decision` | Record operator call | operator | 🛡️ | 🟡 |
| `oracle-whitespace-runs-outcome` | Record actual outcome | operator | 🛡️ | 🟡 |

### Read Models (pre-computed views)
| Tool | What it does | Who can use | Approval | Risk |
|------|-------------|-------------|----------|------|
| `oracle-read-models-briefings` | Briefing view | member | ✅ | 🟢 |
| `oracle-read-models-theme-map` | Theme map view | member | ✅ | 🟢 |
| `oracle-read-models-feed-history` | Feed history view | member | ✅ | 🟢 |

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Total capabilities | **111** |
| Read (👁️) | 40 |
| Write (✏️) | 71 |
| No approval (✅) | 43 |
| User approval (👤) | 43 |
| Admin approval (🛡️) | 25 |
| High risk (🔴) | 12 |
| Medium risk (🟡) | 42 |
| Low risk (🟢) | 57 |

## High-Risk Hotlist 🔴

These 12 capabilities can cause real damage or move money — audit them carefully:

1. `charter-roles-assign` / `charter-roles-update` — permission escalation
2. `charter-governance-transition` — lifecycle state changes
3. `charter-payouts-create` / `-update` / `-approve` — **money movement**
4. `meg-entities-merge` — irreversible entity consolidation
5. `oracle-signals-publish` / `oracle-theses-publish` — public-facing output
6. `oracle-theses-supersede` — canonical thesis replacement
7. `oracle-whitespace-runs-execute` — AI cost + downstream decisions
8. `eigen-oracle-outbox-drain` — pipeline-wide signal processing
