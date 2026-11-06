# Skills used for this MVP

Installed locally in Codex on November 6,2026; exact upstream commits are in INSTALLED_SKILLS.json. They become discoverable on the next turn; their files can be read directly now. They do not automatically install into Arc Studio.

| Source | Use here |
| --- | --- |
| [ETHSkills](https://github.com/austintgriffith/ethskills) | Small contract surface; verified chain/address/decimal assumptions; independent oracle boundary; public-entry-point and fork tests; explicit transaction callers and deployment evidence. |
| [Matt Pocock skills](https://github.com/mattpocock/skills) | Installed grill-me/grilling, writing-for-agents, tdd, diagnosing-bugs and codebase-design. Apply writing-for-agents now to concise checkpoint prompts; use behavior tests and reproducible debugging during implementation. Alignment questions focus on unresolved product decisions, using the conversation/spec for decisions already made. |
| [Taste Skill](https://github.com/leonxlnx/taste-skill) | Installed with its assets/references. Use relevant visual consistency and rendered checks during frontend work; Sacred's established identity and working financial UI remain the brief. |
| [Impeccable](https://github.com/pbakaus/impeccable) | Installed. Use Operate-mode hierarchy, form/transaction clarity, accessibility and mobile review; read its relevant playbook when UI work starts. |
| [Awesome DESIGN.md](https://github.com/voltagent/awesome-design-md) | A design-reference collection, not an installable skill. Saved locally under `~/.codex/design-references/awesome-design-md`; use only relevant patterns to inform Sacred's own design notes. |

Scope: no ticket-tracker setup, parallel implementation factory, broad architecture migration, marketing-site rebuild or generated art dependency is required for this MVP. Skill guidance serves the accepted scope. The repository spec is authoritative for protocol behavior. Use Studio's own Uniswap skill for v4 integration; prompt requirements carry the relevant local review guidance into Studio.

Applied in this revision: live deployment verification; fee/decimal checks; retaining a separate demo price fixture; explicit caller table; one checkpoint per prompt turn; correction of the partial-sale formula and feasibility math. No frontend polish, Solidity test or live deployment is claimed before it runs.
