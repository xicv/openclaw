#!/usr/bin/env bash
set -euo pipefail

# Sync fork with upstream openclaw/openclaw
# Usage: ./scripts/sync-upstream.sh [--force]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

FORCE=""
if [[ "${1:-}" == "--force" ]]; then
  FORCE="--force-with-lease"
fi

echo "Fetching upstream..."
git fetch upstream

echo ""
echo "Current branch: $(git branch --show-current)"

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Stash any uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo ""
  echo "Stashing uncommitted changes..."
  git stash push -m "sync-upstream-$(date +%s)"
fi

# Switch to main if not already on it
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo ""
  echo "Switching to main branch..."
  git checkout main
  CURRENT_BRANCH="main"
fi

echo ""
echo "Merging upstream/main into main..."
git merge upstream/main --edit -m "chore: sync upstream $(date +%Y-%m-%d)"

echo ""
echo "Pushing to origin (your fork)..."
git push origin main $FORCE

echo ""
echo "Pushing to fork..."
git push fork main $FORCE

# Restore original branch if it wasn't main
if [[ "$(git branch --show-current)" != "$CURRENT_BRANCH" && "$CURRENT_BRANCH" != "main" ]]; then
  echo ""
  echo "Returning to $CURRENT_BRANCH..."
  git checkout "$CURRENT_BRANCH"
fi

# Ask if user wants to update feature branch
if [[ "$CURRENT_BRANCH" != "main" ]] && git rev-parse --verify "$CURRENT_BRANCH" >/dev/null 2>&1; then
  echo ""
  read -p "Update feature branch '$CURRENT_BRANCH' from main? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Merging main into $CURRENT_BRANCH..."
    git merge main -m "chore: sync from main"
    echo ""
    echo "Pushing $CURRENT_BRANCH to fork..."
    git push fork "$CURRENT_BRANCH" $FORCE
  fi
fi

# Restore stashed changes if any
if git stash list | grep -q "sync-upstream"; then
  echo ""
  echo "Restoring stashed changes..."
  git stash pop
fi

echo ""
echo "✓ Sync complete!"
echo "  Upstream: https://github.com/openclaw/openclaw"
echo "  Your fork: https://github.com/xicv/openclaw"
