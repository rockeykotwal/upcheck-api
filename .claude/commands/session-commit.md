You are staging and committing local changes for the Upcheck project.
The user's commit message (if provided) is: $ARGUMENTS

You do NOT push. You do NOT open a PR. You commit locally and stop.
The user reviews the commit, then pushes and opens the PR themselves.

Follow every step below in order. Stop and report clearly if any step fails.

---

## STEP 1 — Check working tree status

Run: `git status --short`

- If output is empty: tell the user "Nothing to commit — working tree is clean." and STOP.
- Otherwise: note which files are modified, added, deleted, or untracked. Report a short summary before continuing.

---

## STEP 2 — Detect current branch

Run: `git branch --show-current`

Store this as the active branch.

---

## STEP 2B — Guard against committing directly to main or dev

If the active branch is `main`:
- STOP. Tell the user: "You are on `main` — never commit directly here. Switch to `dev` or a feature branch first."

If the active branch is `dev`:
- Warn the user: "You are on `dev`. Consider using a feature branch (e.g. `feat/companies-schema`) for this work so the PR is clean. Continue anyway? (proceeding...)"
- Continue — do not block, just warn.

If the active branch is any other branch: continue silently.

---

## STEP 3 — Stage all changes

Run: `git add -A`

Then run `git status --short` again to confirm files are staged. If nothing is staged after this, report and STOP.

---

## STEP 4 — Determine commit message

If `$ARGUMENTS` is non-empty, use it as the commit message exactly as provided.

If `$ARGUMENTS` is empty:
- Run: `git diff --cached --stat`
- Read the output and write a short conventional commit message based on what changed.
  Format: `<type>: <description>` (e.g. `feat: add companies schema and seed`, `fix: resolve cron job memory leak`)
  Types: feat, fix, chore, docs, refactor, test, ci, style
- Tell the user: "Auto-generated commit message: `<your message>`"

---

## STEP 5 — Commit

Run: `git commit -m "<commit message from Step 4>"`

**IMPORTANT:**
- Do NOT append any `Co-Authored-By` trailer or Claude attribution. Commit shows only the user's identity.
- Never use `--no-verify`.

- If commit succeeds: report the short commit hash and message.
- If commit fails (pre-commit hook error, nothing staged, etc.): show the error output clearly and STOP.

---

## FINAL REPORT

Give the user a short summary:
- Which branch the commit landed on
- Commit hash + message
- List of files committed (from `git show --stat HEAD --format=''`)
- Reminder: "Push and open the PR yourself when ready — `git push origin <branch>`"

Never push. Never open a PR. Stop after the commit.
