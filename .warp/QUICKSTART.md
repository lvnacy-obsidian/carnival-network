# Quick Start Guide

## Copy Template to New Project

```bash
# Navigate to your new project
cd /path/to/new-project

# Copy the template
cp -r ~/github/.warp-template .warp

# Make scripts executable (already done, but good practice)
chmod +x .warp/scripts/*.sh
```

## Setup Dual Repositories

```bash
# 1. Initialize git if needed
git init

# 2. Run setup script
.warp/scripts/setup-remotes.sh

# Follow prompts to enter:
# - Private repository URL (full project)
# - Public repository URL (excludes .warp/)
```

## Daily Workflow

### During Development
```bash
# Check current remote status
.warp/scripts/status-remotes.sh

# Work on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git commit -am "Add new feature"
```

### After AI Sessions
1. Copy `CONVERSATION-template.md` to create new summary:
   ```bash
   cp .warp/CONVERSATION-template.md .warp/conversations/2025-01-17-session.md
   ```

2. Fill in the summary with discussion points and decisions

3. Update `.warp/NEXT-STEPS.md` with any new tasks

### Publishing Changes
```bash
# Sync to both repositories
.warp/scripts/sync-public.sh

# This creates:
# - sync/private-TIMESTAMP branch in private repo
# - sync/public-TIMESTAMP branch in public repo (without .warp/)

# Then create PRs from these branches to main
```

## File Structure

```
.warp/
├── README.md                      # Full documentation
├── QUICKSTART.md                  # This file
├── CONVERSATION-template.md       # Template for session summaries
├── NEXT-STEPS.md                  # Consolidated task list
├── conversations/                 # Create this for your summaries
└── scripts/
    ├── setup-remotes.sh          # Initial remote configuration
    ├── status-remotes.sh         # Check remote status
    └── sync-public.sh            # Sync to both repositories
```

## Key Concepts

**Private Repository**: Complete project including `.warp/` directory
- Conversation summaries
- Internal scripts
- Task tracking
- Everything

**Public Repository**: Clean public release
- All project files
- **EXCEPT** `.warp/` directory

**Conversation Summaries**: Document AI session discussions
- NOT a changelog
- Focus on reasoning and decision-making
- Include considerations, concerns, and next steps

**Next Steps Checklist**: Single source of truth for tasks
- Extracted from conversation summaries
- Mark items complete as you go
- Keep this file updated

## Common Commands

```bash
# Check remote configuration
.warp/scripts/status-remotes.sh

# Update remote URLs
.warp/scripts/setup-remotes.sh

# Sync to both repositories
.warp/scripts/sync-public.sh

# View current branch
git branch --show-current
```

## Tips

1. **Create conversations directory**:
   ```bash
   mkdir -p .warp/conversations
   ```

2. **Name conversation files with dates**:
   - `2025-01-17-feature-implementation.md`
   - `2025-01-18-bug-fix-session.md`

3. **Keep NEXT-STEPS.md updated**:
   - Add tasks during sessions
   - Check off completed items
   - Review regularly

4. **Commit .warp/ to private only**:
   - The sync script handles this automatically
   - Public repository never sees `.warp/`

---

**For detailed documentation**, see `README.md`
