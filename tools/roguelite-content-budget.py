#!/usr/bin/env python3
"""
Roguelite Content Budget Gate
==============================
Run BEFORE any roguelite deep-work pull to enforce the per-day content cap.

Rule (from deepwork-queue.md):
  CONTENT_BUDGET_EXHAUSTED if ≥1 `feat(...)` or `feat:` commit exists today (local time).
  fix / docs / polish / refactor / qa commits never count — always allowed.

Exit codes:
  0 → budget available (OK to add new content this session)
  1 → CONTENT_BUDGET_EXHAUSTED (fix/balance/QA only, or yield)

Usage:
  python3 tools/roguelite-content-budget.py
  echo "Exit: $?"
"""

import subprocess
import sys
from datetime import datetime

def main():
    today = datetime.now().strftime("%Y-%m-%d")
    # Commits since midnight local time
    result = subprocess.run(
        ["git", "log", "--oneline", f"--since={today} 00:00:00", "--format=%s"],
        capture_output=True, text=True, cwd="/workspace/work/roguelite-game"
    )
    if result.returncode != 0:
        print(f"ERROR: git log failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    subjects = result.stdout.strip().split("\n") if result.stdout.strip() else []
    feat_commits = [s for s in subjects if s.startswith("feat")]

    if feat_commits:
        print(f"CONTENT_BUDGET_EXHAUSTED — {len(feat_commits)} feat commit(s) today ({today}):")
        for s in feat_commits:
            print(f"  • {s}")
        print("→ Pull must be fix/balance/QA/verification only, or YIELD.")
        sys.exit(1)
    else:
        print(f"CONTENT_BUDGET AVAILABLE — 0 feat commits today ({today}).")
        print(f"  ({len(subjects)} other commit(s): {', '.join(s.split(':')[0] for s in subjects if s) or 'none'})")
        print("→ New content additions allowed (limit: 1 feat commit per day).")
        sys.exit(0)

if __name__ == "__main__":
    main()
