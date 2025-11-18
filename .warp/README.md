# .warp Template Directory

This template provides a standardized `.warp` directory structure for new projects that use dual repository management (private + public).

## Template Contents

### Documentation Templates
- **CONVERSATION-template.md** - Template for AI conversation summaries
  - Focus on documenting discussion, reasoning, and decision-making
  - NOT a changelog - captures strategic thinking and context
  - Includes sections for considerations, concerns, and next steps

- **NEXT-STEPS.md** - Consolidated task checklist
  - Aggregates "Next Steps" from conversation summaries
  - Single source of truth for pending project tasks

### Dual Repository Scripts
- **scripts/setup-remotes.sh** - Configure private and public Git remotes
- **scripts/status-remotes.sh** - Check current remote configuration
- **scripts/sync-public.sh** - Sync changes to both repositories (excludes `.warp/`)

## Usage

### Copying to New Projects

```bash
# Copy template to new project
cp -r ~/github/.warp-template /path/to/new-project/.warp

# Make scripts executable
chmod +x /path/to/new-project/.warp/scripts/*.sh
```

### Setting Up Dual Repositories

1. **Initialize Git** (if not already done):
   ```bash
   cd /path/to/new-project
   git init
   ```

2. **Configure remotes**:
   ```bash
   .warp/scripts/setup-remotes.sh
   ```
   - Enter private repository URL (complete project)
   - Enter public repository URL (excludes `.warp/`)

3. **Check status**:
   ```bash
   .warp/scripts/status-remotes.sh
   ```

4. **Sync changes**:
   ```bash
   .warp/scripts/sync-public.sh
   ```

## Repository Architecture

### Private Repository
Contains the complete project, including:
- Source code
- `.warp/` directory (conversation summaries, internal scripts)
- All documentation
- Configuration files

### Public Repository
Contains the project WITHOUT:
- `.warp/` directory

This allows you to keep internal documentation, AI conversation archives, and project-specific tooling private while maintaining a clean public release.

## Conversation Summary Workflow

1. **During AI sessions**: Work with the AI as normal
2. **End of session**: Create conversation summary using `CONVERSATION-template.md`
3. **Update checklist**: Add "Next Steps" items to `NEXT-STEPS.md`
4. **Commit to private**: Conversation summaries stay in private repository only

## Customization

### Project-Specific Modifications
- Add project-specific documentation to `.warp/`
- Create additional script templates as needed
- Modify `sync-public.sh` if different files should be excluded from public

### Template Improvements
- Make changes in `~/github/.warp-template/`
- Copy updated template to existing projects as needed
- Keep template documentation up-to-date

## File Permissions

After copying, ensure scripts are executable:
```bash
chmod +x .warp/scripts/*.sh
```

## Integration with WARP.md

Projects should include a WARP.md file that references these scripts and templates. The `.warp/` directory complements project-level WARP.md by providing:
- Practical tools (scripts)
- Session documentation (conversation summaries)
- Task tracking (next steps checklist)

---

**Template Location**: `~/github/.warp-template/`  
**Last Updated**: 2025-01-17
