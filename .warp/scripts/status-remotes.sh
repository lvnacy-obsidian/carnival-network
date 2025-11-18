#!/bin/bash

# Remote Status Script (Template Version)
# Shows current dual remote configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[STATUS]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verify we're in a git repository (works for both regular repos and submodules)
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository."
    exit 1
fi

echo "=== Dual Remote Status ==="
echo

# Check current remote configuration
log "Current Git remote configuration:"
echo

if git remote get-url private &>/dev/null; then
    PRIVATE_URL=$(git remote get-url private)
    success "Private remote configured:"
    echo "  └─ $PRIVATE_URL"
else
    warning "Private remote not configured"
    PRIVATE_URL=""
fi

if git remote get-url public &>/dev/null; then
    PUBLIC_URL=$(git remote get-url public)
    success "Public remote configured:"
    echo "  └─ $PUBLIC_URL"
else
    warning "Public remote not configured"
    PUBLIC_URL=""
fi

echo

# Check branch status
log "Branch information:"
if git branch | grep -q "public"; then
    success "Public branch exists"
else
    warning "Public branch not found"
fi

CURRENT_BRANCH=$(git branch --show-current)
echo "  Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    warning "Working tree has uncommitted changes"
else
    success "Working tree is clean"
fi

echo

# Show next steps
if [[ -z "$PRIVATE_URL" || -z "$PUBLIC_URL" ]]; then
    log "Next steps:"
    echo "  • Run '.warp/setup-remotes.sh' to configure dual remotes"
else
    log "Available commands:"
    echo "  • '.warp/setup-remotes.sh' - Update remote URLs"
    echo "  • '.warp/sync-public.sh'   - Sync changes to both repositories"
    echo
    log "Public repository excludes:"
    echo "  • .warp/ directory (conversation summaries, internal scripts)"
fi
