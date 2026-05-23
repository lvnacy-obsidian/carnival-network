#!/bin/bash

# Dual Remote Sync Script (Template Version)
# Syncs all files EXCEPT .warp directory from main branch to public branch

set -e

# Configuration
PRIVATE_REMOTE="private"
PUBLIC_REMOTE="public"
PUBLIC_BRANCH="public"
MAIN_BRANCH="main"

# Generate unique branch names for both public sync and private updates
TIMESTAMP=$(date "+%Y%m%d-%H%M%S")
SYNC_BRANCH="sync/public-${TIMESTAMP}"
PRIVATE_BRANCH="sync/private-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[SYNC]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Verify we're in a git repository (works for both regular repos and submodules)
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository. Run this script from the repository root."
fi

# Verify remotes exist
if ! git remote | grep -q "^${PRIVATE_REMOTE}$"; then
    error "Private remote '${PRIVATE_REMOTE}' not found. Add it with: git remote add ${PRIVATE_REMOTE} <url>"
fi

if ! git remote | grep -q "^${PUBLIC_REMOTE}$"; then
    error "Public remote '${PUBLIC_REMOTE}' not found. Add it with: git remote add ${PUBLIC_REMOTE} <url>"
fi

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)
log "Current branch: ${CURRENT_BRANCH}"

# Ensure we're on main branch with clean working tree
if [ "${CURRENT_BRANCH}" != "${MAIN_BRANCH}" ]; then
    warning "Switching from ${CURRENT_BRANCH} to ${MAIN_BRANCH}"
    git checkout ${MAIN_BRANCH}
fi

if [ -n "$(git status --porcelain)" ]; then
    error "Working tree is not clean. Commit or stash changes before syncing."
fi

# Create or switch to public branch
log "Checking out ${PUBLIC_BRANCH} branch..."
if git branch | grep -q "^[[:space:]]*${PUBLIC_BRANCH}$"; then
    git checkout ${PUBLIC_BRANCH}
else
    log "Creating new orphan branch: ${PUBLIC_BRANCH}"
    git checkout --orphan ${PUBLIC_BRANCH}
    git rm -rf . 2>/dev/null || true
fi

# Clear the public branch
log "Clearing ${PUBLIC_BRANCH} branch..."
git rm -rf . 2>/dev/null || true

# Copy ALL files from main EXCEPT .warp directory
log "Syncing public files from ${MAIN_BRANCH} (excluding .warp)..."
git checkout ${MAIN_BRANCH} -- .

# Remove .warp directory if it was copied
if [ -d ".warp" ]; then
    log "Removing .warp directory from public branch..."
    rm -rf .warp
fi

# Add all public files
log "Adding files to ${PUBLIC_BRANCH}..."
git add -A

# Check if there are changes to commit
if [ -n "$(git status --porcelain)" ]; then
    # Create commit message with timestamp
    COMMIT_TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    git commit -m "Sync public files from ${MAIN_BRANCH} - ${COMMIT_TIMESTAMP}

Excludes:
- .warp/ directory (project-internal documentation and scripts)"
    
    log "Pushing ${PUBLIC_BRANCH} as ${SYNC_BRANCH} to ${PUBLIC_REMOTE}..."
    git push ${PUBLIC_REMOTE} ${PUBLIC_BRANCH}:${SYNC_BRANCH}
    
    success "Public sync branch created: ${SYNC_BRANCH}"
    echo "  🔗 Create PR: ${SYNC_BRANCH} → main in public repository"
else
    log "No changes detected in public files."
fi

# Return to original branch
log "Returning to ${CURRENT_BRANCH}..."
git checkout ${CURRENT_BRANCH}

# Create branch for private repository updates (respects branch protection)
log "Creating branch for private repository updates..."
git checkout -b ${PRIVATE_BRANCH}
git push ${PRIVATE_REMOTE} ${PRIVATE_BRANCH}

success "Dual remote sync completed!"

# Return to original working branch
log "Returning to original branch: ${CURRENT_BRANCH}"
git checkout ${CURRENT_BRANCH}

# Display status with dynamic remote URLs
PRIVATE_URL=$(git remote get-url ${PRIVATE_REMOTE})
PUBLIC_URL=$(git remote get-url ${PUBLIC_REMOTE})

echo
log "Repository Status:"
echo "  Private repo: ${PRIVATE_URL}"
echo "    └─ Branch ${PRIVATE_BRANCH} ready for PR"
echo "  Public repo:  ${PUBLIC_URL}"
echo "    └─ Branch ${SYNC_BRANCH} ready for PR (excludes .warp/)"
echo "  Local branches: ${CURRENT_BRANCH} (working), ${PUBLIC_BRANCH} (public sync), ${PRIVATE_BRANCH} (private sync)"
echo
log "Next Steps:"
echo "  1. Create PR: ${PRIVATE_BRANCH} → main in private repository"
echo "  2. Create PR: ${SYNC_BRANCH} → main in public repository"
echo "  3. Review and merge both PRs"
echo "  4. Public PR merge will trigger any configured CI/CD workflows"
