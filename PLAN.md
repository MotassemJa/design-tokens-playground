# PLAN: Import a DTCG JSON file via issue-ops

Extend the existing create/update/delete issue-ops pipeline with a fourth action:
**import** — submit a whole DTCG JSON document that merges into (or replaces) one
hierarchy's `tokens.json`, overriding existing tokens.

## 1. Current state (what we reuse)

| Piece | Reused as-is |
| --- | --- |
| `.github/workflows/token-request-dispatcher.yaml` | label router — add one branch |
| `.github/ISSUE_TEMPLATE/*.yaml` + `issue-ops/parser@v5` | input parsing |
| `.github/scripts/token-common.ts` | `setNested`, `readTokenFile`, `writeTokenFile`, `getHierarchy`, `getTokenFilePath`, `assertValidPath`, `assertTreeValid` |
| `src/token-validator.ts` | naming + hierarchy-reference rules — one change, see §2.2 |
| `src/token-loader.ts` | `loadTokensByHierarchy()` for whole-repo validation |
| `.github/workflows/build-tokens.yaml` | already posts a per-token added/modified/removed diff comment on the PR — the import PR gets this for free |

Nothing new is written that already exists. No new dependencies.

## 2. Blocking prerequisites

Two validator-side defects sit between the current code and any import. Both are
fixed in shared code, so create/update/import and hand-written token files all
benefit.

### 2.1 `assertTreeValid` validates only one hierarchy

`token-common.ts:assertTreeValid()` validates a one-entry map:

```ts
const byHierarchy = new Map([[hierarchy, tree as TokenGroup]]);
```

`TokenValidator` builds its `path → hierarchy` lookup from that map, so every
cross-layer reference in the tree reports *"does not exist in any hierarchy"*.
Verified: creating any token in `semantic` fails with 20 errors, all from
pre-existing tokens. Create/update are effectively broken for every layer whose
file contains references.

**Fix (root cause, shared by all four actions):** load every hierarchy with
`new TokenLoader().loadTokensByHierarchy()`, overlay the in-memory modified tree
for the target hierarchy, validate the full map.

```ts
function assertTreeValid(tree: TokenTree, hierarchy: Hierarchy): void {
  const byHierarchy = new TokenLoader().loadTokensByHierarchy() as Map<Hierarchy, TokenGroup>;
  byHierarchy.set(hierarchy, tree as TokenGroup);
  // ...unchanged from here
}
```

~3 lines. Fixes create, update **and** import; also makes `replace` mode safe —
deleting a token another layer still references now fails validation instead of
shipping a broken build.

### 2.2 The validator rejects DTCG group-level `$type`

In DTCG, `$type` belongs on a **group** and is inherited by its descendants;
`TokenValidator` demands it on every leaf and treats a group's `$type` key as a
path segment. A conformant file therefore fails twice over. Verified against a
group-typed probe:

```
Segment '$type' (at 'probe.$type') is not kebab-case (lowercase letters, digits, '-').
Token 'probe.alpha' is missing required $type.
Token 'probe.nested.beta' is missing required $type.
```

**Fix, entirely inside `src/token-validator.ts`:**

1. `walk()` and `collectPaths()` skip `$`-prefixed keys — DTCG metadata, never path
   segments. This also makes root-level `$schema` / `$description` a non-issue, so
   the import script needs no stripping pass of its own.
2. `walk()` carries the nearest ancestor `$type` down; `validateLeaf` accepts a leaf
   whose type comes from an ancestor group:

   ```ts
   if (!token.$type && !inheritedType) {
     this.errors.push(
       `Token '${pathStr}' is missing required $type (not set on the token or any ancestor group).`
     );
   }
   ```

Backwards compatible: a leaf's own `$type` still wins, so today's leaf-typed files
are unaffected.

**Nothing downstream needs to change.** `grep -rn '\$type' src/` outside the
validator returns nothing, and Style Dictionary v5 resolves DTCG inheritance
natively. With only the validator patched, a group-typed `color` group holding a
cross-layer reference builds correctly end to end:

```
dist/css/variables.css       --ds-probe-surface-tint: var(--ds-light-color-surface-raised);
dist/tokens.resolved.json    "tint": { "$value": "oklch(0.95 0.006 240)" }
```

### 2.3 `deleteToken` never validates

Not required for import, but surfaced while checking it. `deleteToken` writes the
file without calling `assertTreeValid` at all, so deleting a token another layer
references succeeds and ships a tree that cannot build:

```
$ delete-token.ts --hierarchy system --base surface.raised   →  🗑️  Deleted   (rc=0)
$ npm run build   →  ❌ Token validation failed:
     Token 'surface.color.raised' references 'light.color.surface.raised' which does not exist
```

The fix is one `assertTreeValid(tree, hierarchy)` call before `writeTokenFile`,
reusing §2.1. A rejected delete leaves the file untouched, since validation runs
before the write.

Each fix lands as its own commit, bisectable independently of import.

## 3. Design decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Input channel | **JSON pasted into a form textarea** | Decided twice. An uploaded `.json` file was built and then removed: GitHub has no upload field type, so it relies on dropping a file into a textarea and then fetching `github.com/user-attachments/files/…` — a host with no supported download API, needing a URL allow-list, a size cap and a redirect dance, and behaving differently on private repos. That is a lot of moving parts in exchange for a larger ceiling. Pasting keeps the whole path inside what the issue form already does. The measured ceiling is in §3.1. |
| Scope per import | **One hierarchy**, chosen from a dropdown | Matches the repo's strict `tokens/{hierarchy}/tokens.json` layout and `assertLayoutStrict`. Multi-layer files: see §8. |
| Merge semantics | Dropdown: `merge` (default) / `replace` | `merge` = deep overlay, incoming leaf wins, untouched tokens preserved. `replace` = incoming document becomes the whole file. Two behaviours people actually mean by "import"; no third mode. |
| Merge implementation | Leaf-wise deep merge (recursion stops at `$value`) + a separate walk for the change list | Correct when `$type` lives on a group, and clears stale leaf metadata on override. See §4.2 step 3. |
| Workflow shape | Copy `create-token.yaml` → `import-tokens.yaml` | The repo already has 3 near-identical action workflows. Factoring 4 into one composite is a bigger diff than the feature itself. **Deliberate duplication** — revisit if a 5th action appears. |

### 3.1 The paste ceiling, measured

GitHub caps an issue body at 65,536 characters — a MySQL `mediumblob`, 262,144
bytes over 4-byte Unicode characters. That is the **whole body**, not the field:
this form's other fields (hierarchy, mode, description, checklist, headers and
the ```` ```json ```` fence) cost 754 characters, leaving **~64,780** for the JSON.

Measured by generating 500-token documents in each shape: 47 chars/token lean,
up to 432 heavy — so ~1,380 tokens down to ~150. The per-shape table lives in
the issue form, which is the only copy; for scale, the repository's entire token
set is 87 tokens / 16,674 characters.

**The cap is enforced on submit, by GitHub.** An over-long body is rejected with
`422 body is too long`, the issue is never created, and the requester loses what
they typed. No workflow runs, so nothing can comment a friendlier message — which
is why the limit is spelled out in the form itself rather than handled in code.
Editing an existing issue re-checks it, so a requester near the limit can also get
stuck unable to save a description tweak.

## 4. Implementation

### 4.1 `.github/ISSUE_TEMPLATE/import-tokens.yaml` (new)

`labels: ["token-request", "import"]`, title `"[IMPORT] "`. Fields:

- `hierarchy` — dropdown, required: `design-values` / `universal` / `system` / `semantic` / `component`
- `mode` — dropdown, required: `merge` / `replace`
- `tokens-json` — textarea, required, `render: json`
- `description` — textarea, required (goes into the commit/PR body)
- checkboxes: kebab-case segments, references point only at lower layers, valid DTCG `$type`

### 4.2 `.github/scripts/token-common.ts` — add `importTokens()`

```ts
export interface ImportData {
  hierarchy: Hierarchy;
  mode: "merge" | "replace";
  file: string;          // path to the JSON written by the workflow
}
```

Steps:

The input is assumed **DTCG-conform** — the script normalizes nothing. No metadata
stripping, no `$type` rewriting: `$type` stays on the group where the author put it,
and §2.2 teaches the validator to read it there.

1. `JSON.parse(readFileSync(file))` — fail loudly with the parse error on bad JSON.
2. Collect every leaf path, skipping `$`-prefixed keys; `assertValidPath` each one — report **all** bad paths at once, then exit 1. A 200-token import that fails on path 3 of 200 must not need 200 round-trips.
3. `merge`: **deep-merge the incoming tree onto the existing one, stopping at token leaves** — a node with `$value` is replaced wholesale, never merged key-by-key. Recursing into a leaf would leave the old `$type` / `$description` behind when the incoming file types the group instead, which is exactly the stale metadata an override is meant to clear. Group-level `$*` keys merge as ordinary group members, so an incoming group `$type` lands with its group.
   `replace`: the incoming tree *is* the new tree.

   `TokenLoader.mergeTokens` is *not* reusable here — it recurses into leaves.
   ~10 lines, and a separate walk collects the changed leaf paths for the summary.
4. `assertTreeValid(tree, hierarchy)` — validates against all hierarchies (§2.1).
5. `writeTokenFile`.
6. Write a markdown summary to the path given by `--summary` (counts + a capped list of changed paths, e.g. first 50 then `…and N more`) and print the same to stdout.

`importTokens` exits 0 with `changes=false` semantics when nothing differs — the
existing "Handle no changes" step then comments on the issue.

### 4.3 `.github/scripts/import-tokens.ts` (new)

yargs wrapper matching the existing three: `--hierarchy`, `--mode`, `--json`, `--summary`.

Takes the **document itself**, not a path — there is no temp file and nothing to
download. Passing it as one argument is safe because the workflow hands it over as
a quoted expansion of an env var; the risk was only ever `${{ }}` interpolating
untrusted text into the script body. Argument limits are irrelevant at this scale:
`ARG_MAX` on the runner is megabytes, against a 65,536-character issue cap.

### 4.4 `.github/workflows/import-tokens.yaml` (new)

Copy of `create-token.yaml`, with these deliberate differences:

- **Payload via env, not `${{ }}` interpolation.** The existing workflows splice issue
  content straight into `run:` blocks. A multi-line JSON blob containing quotes and
  backticks breaks that script, and it is a command-injection surface. The document
  goes to the script as one argument, quoted from an env var — no temp file:

  ```yaml
  - name: Run import token script
    env:
      TOKENS_JSON: ${{ steps.parse.outputs['parsed_tokens-json'] }}
    run: npx tsx .github/scripts/import-tokens.ts --json "$TOKENS_JSON" …
  ```

- **PR body from the summary file, not from `parsed json`.** `create-token.yaml` does
  `JSON.parse('${{ steps.parse.outputs.json }}')` inside `github-script`; with a token
  document embedded that string breaks on the first `'`. Read
  `$RUNNER_TEMP/import-summary.md` with `fs` instead.
- Branch: `token-request/{issue}-import-{slug}`, PR labels `["token-change", "import"]`.

### 4.5 `.github/workflows/token-request-dispatcher.yaml`

Add `has_import` to the label scan, include it in `action_count`, add the
`elif $has_import` branch and an `import:` job calling the new reusable workflow.
Update the invalid-label comment text to list four actions.

### 4.6 Tests — `tests/import-tokens.test.ts` (one file)

Against `tests/fixtures/`, using the existing jest setup:

- merge keeps tokens absent from the import
- merge overrides an existing leaf's `$value`
- merge replaces a leaf wholesale: an incoming group-typed leaf does not inherit the old leaf's `$type` / `$description`
- a group-level `$type` import validates with no `$type` on any leaf
- a `$`-prefixed group key is never treated as a path segment
- a leaf missing `$type` with no ancestor group `$type` still fails
- `replace` drops tokens missing from the import
- an invalid path segment (`Blue_500`) fails, and **all** bad paths are listed
- an import whose references cross layers upward fails validation
- an import referencing a lower layer passes (the §2.1 regression guard)

### 4.7 Docs

- `.github/WORKFLOWS_README.md` — import row in the usage table, `import` branch in the mermaid graph
- `README.md` — short "Importing a token file" section
- `TODO.md` — drop the line this supersedes, if any

## 5. Regression safety — existing issue-ops operations must keep working

The §2 fixes touch code shared by create, update and delete, so they are the risk,
not the import script. Both fixes were applied to a scratch copy of the repo and the
existing operations exercised end to end against the real token set:

| Group | Cases | Result |
| --- | --- | --- |
| create | one per hierarchy (`design-values` → `component`), each with the cross-layer reference that layer really uses | 5/5 pass |
| update | `system`, `semantic` | 2/2 pass |
| delete | all five, dependents first | 5/5 pass |
| guardrails | upward reference, non-kebab segment, update of a non-existent token | 3/3 still rejected |

**15/15.** After the full create→update→delete cycle, `diff -r` against the repo's
`tokens/` is empty — no stray formatting or ordering churn. Before the fixes, every
create/update outside `design-values` failed (§2.1).

`npm test`: **16/17 pass, 1 expected failure** —
`tests/token-validator.test.ts:76` asserts the exact old error string:

```
Expected: "Token 'color.blue.500' is missing required $type."
Received: "Token 'color.blue.500' is missing required $type (not set on the token or any ancestor group)."
```

Behaviour is unchanged (`validate()` still returns `false`); only the message is
longer. Update that one assertion — do **not** revert the message, since a
group-typed file that still fails needs to know ancestors were checked. This is the
only existing test that changes.

### Verification to repeat in CI before merge

1. `npm test` — with the one assertion updated, green.
2. `npm run build` — green on the unmodified token set.
3. The 15-case matrix above, as a shell script in the PR description (it needs a
   dirty working tree, so it is not worth wiring into jest).
4. One real create issue and one real delete issue on the feature branch, to confirm
   the dispatcher still routes three-label requests correctly after the `import`
   branch is added.

## 6. Order of work

1. Fix `assertTreeValid` + regression test (§2.1) — standalone commit.
2. Teach the validator group-level `$type` + tests (§2.2), including the one-line update to `tests/token-validator.test.ts:76` (§5) — standalone commit. Both
   fixes stand on their own merit; import is blocked on neither individually but on both together.
3. `importTokens()` + `import-tokens.ts` + tests — runnable locally, no CI needed:
   `npx tsx .github/scripts/import-tokens.ts --hierarchy semantic --mode merge --json "$(cat x.json)"`
4. Issue template + workflow + dispatcher branch — re-run the §5 matrix after touching the dispatcher.
5. Docs.

Steps 1–3 are the actual feature; 4 is plumbing that can only be tested by opening a
real issue on a branch.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Issue body 65,536-char cap | Measured and documented in the form itself (§3.1). Not enforceable in code: GitHub rejects the issue before any workflow runs. A token set outgrowing ~355 tokens per import needs splitting across issues, or the attachment route revisited |
| `replace` silently drops tokens other layers reference | Whole-map validation (§2.1) turns this into a hard error; the build-tokens PR comment lists removals |
| The copied workflow inherits an existing PR-creation failure | Issue #20's dispatcher run committed to `token-request/20-color-secondary` but no PR exists and the run ended in failure; CI logs have expired (HTTP 410) so the cause is unconfirmed. Re-run a create request and fix the shared step **before** copying it into `import-tokens.yaml`. |
| A malformed import wipes a hierarchy file | Validation runs *before* `writeTokenFile`; every change lands as a PR against `main`, never a direct push |
| The shared `assertTreeValid` / validator fixes break create, update or delete | Verified 15/15 on a scratch copy before writing this plan (§5); the matrix is re-run after the dispatcher change |
| Duplicated workflow YAML drifts | Accepted; noted in §3 |

## 8. Explicitly out of scope

- **Multi-hierarchy files** (one document containing all five layers). Cheap to add later:
  a `multi-layer` dropdown option that splits on top-level keys matching `ALLOWED_HIERARCHIES`
  and loops the merge per layer. Add when a real export needs it, not before.
- Fetching the document from anywhere — a URL, gist, release asset or issue
  attachment. Built once as an attachment fetch and removed as not worth the
  moving parts; see the input-channel row in §3.
- Format conversion (Tokens Studio, Figma Variables) — this imports DTCG only.
- Dry-run / preview-only mode — the PR *is* the preview.
- Deleting tokens by omission in `merge` mode — that is what `replace` is for.
