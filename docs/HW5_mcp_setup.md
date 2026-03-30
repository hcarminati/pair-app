# HW5: MCP Servers — Setup & Demonstration

Two MCP servers are connected to this project: **GitHub** and **Figma**.

---

## GitHub MCP

### Why GitHub MCP

The Pair project is hosted on GitHub and uses GitHub Actions for CI/CD. Connecting the GitHub MCP server lets Claude Code interact with the repository directly — reading issues to understand requirements, checking PR status, listing CI run results — without leaving the Claude Code session.

Relevant to this project:
- User stories (US-*) and bugs are tracked as GitHub issues
- Pull requests map to feature branches; CI must pass before merging
- The `develop` branch is the integration target

---

## Setup

### 1. Prerequisites

- Node.js 18+ (for `npx`)
- A GitHub Personal Access Token (PAT) with `repo` scope

### 2. Generate a PAT

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create a token scoped to **this repository** with:
   - **Repository permissions:** Contents (read), Issues (read/write), Pull requests (read/write), Metadata (read)
3. Copy the token value

### 3. Set the environment variable

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=<your-token>
```

Add it to your shell profile (`~/.zshrc` or `~/.bash_profile`) to persist it across sessions.

### 4. Project configuration (already committed)

The `.mcp.json` file at the project root declares the server:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

Claude Code reads `.mcp.json` automatically when you open the project. You will be prompted once to approve the server.

### 5. Verify

Open Claude Code in the project directory and run:

```
/mcp
```

You should see `github` listed as a connected server.

---

## Figma MCP

### Why Figma MCP

The Pair app UI was designed in Figma as low-fidelity wireframes. Connecting the Figma MCP lets Claude Code read component structure, layout, and interaction patterns directly from the design file — without manually transcribing anything.

Relevant to this project:
- The discovery feed screen (`Discovery.tsx`) is fully wireframed in Figma
- The wireframe defines card layout, filter pills, detail modal, and the unlinked state
- Reading it directly ensures the implementation matches the intended design

### Setup

Claude Code ships with a **built-in Figma MCP** (`plugin:figma:figma`) — no manual installation required. It activates automatically when you open a project in Claude Code and can read any Figma file you share a URL for.

**1. Connect your Figma account**

In Claude Code, run `/mcp` and follow the prompt to authenticate with Figma, or paste a Figma URL into the chat — Claude Code will request access on first use.

**2. Verify**

```
/mcp
```

You should see `plugin:figma:figma` listed as a connected server.

> **Note:** A separate `npx -y @figma/mcp-server` can also be registered manually via `claude mcp add`, but the built-in server is sufficient and requires no token management.

---

## Demonstrated Workflow: Implementing a Feature from a GitHub Issue + Figma Wireframe

The following session log shows Claude Code using the GitHub MCP to pull issue context and implement a feature end-to-end.

### Session log

**Prompt:**
```
Use the GitHub MCP to read the open issues on this repo, find the one about the discovery feed,
then read the Figma wireframe and implement it using /add-feature.
```

**Claude Code actions (with GitHub MCP + Figma MCP):**

1. Called `github_list_issues` → retrieved open issues for the `pair-app` repository
2. Found issue #10: *"Discovery feed: rank couples by shared tag count (US-06, FR-DISC-01 through FR-DISC-06)"*
3. Called `github_get_issue` → read the full issue body including acceptance criteria
4. Called Figma `get_design_context` on the Low-fidelity wireframes file → retrieved `screens/Discovery.tsx` showing card layout, filter pills, detail modal, and unlinked state
5. Invoked `/add-feature-v1 US-06` → basic implementation, 5 tests passing (no Pair-specific guards)
6. Invoked `/add-feature US-06` (v2) → added unlinked state, incomplete couple exclusion, already-connected exclusion, tag normalization — 8 tests passing
7. Called `github_add_issue_comment` on issue #10 with implementation notes comparing v1 and v2

**What MCP enabled that wasn't possible before:**
- Zero copy-paste: requirements came directly from the issue and design came directly from Figma
- Both MCPs used on the same task: GitHub for acceptance criteria, Figma for UI structure
- Closed the loop by commenting on the issue, creating a traceable record

### How this session prompted upgrading `/add-feature` from v1 to v2

The initial skill (`add-feature-v1`) covered a basic TDD loop: extract requirements, write failing tests, implement, run tests, report. It worked, but during the discovery feed implementation the GitHub issue acceptance criteria surfaced Pair-specific constraints that v1 had no guards for:

- **Duplicate-request check** (FR-CONN-09) — v1 had no reminder to query for an existing request before inserting a new one
- **Incomplete couple exclusion** (FR-DISC-03) — v1 did not enforce filtering couples where one partner is unregistered
- **Tag normalization at the service layer** — v1 left normalization to the implementer's discretion
- **Partner privacy on DECLINED** (FR-CONN-08) — v1 had no step to verify declining partner identity was not exposed

Reading the full issue body via `github_get_issue` made these gaps obvious. `add-feature-v2` (the current `/add-feature`) adds an explicit Pair-specific implementation checklist in Step 4 and a self-check gate in Step 6 that blocks reporting done until each rule is verified.

---

## Reproducibility Checklist

- [ ] Set `GITHUB_PERSONAL_ACCESS_TOKEN` in your environment
- [ ] Open the project in Claude Code (`claude` from the project root)
- [ ] Approve the `github` MCP server when prompted
- [ ] Run `/mcp` to confirm both `github` and `plugin:figma:figma` are connected
- [ ] Try: *"List open issues on this repo"* (GitHub)
- [ ] Try: *"Read the Discovery screen from the Figma wireframe file"* (Figma)
