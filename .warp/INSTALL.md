# Installation Instructions

## Template Location
`~/github/.warp-template/`

## Template Structure
```
.warp-template/
├── README.md                      # Full documentation
├── QUICKSTART.md                  # Quick start guide
├── INSTALL.md                     # This file
├── CONVERSATION-template.md       # Template for AI session summaries
├── NEXT-STEPS.md                  # Consolidated task checklist
└── scripts/
    ├── setup-remotes.sh          # Configure dual remotes
    ├── status-remotes.sh         # Check remote status
    └── sync-public.sh            # Sync to both repositories
```

## Copy to New Project

### One-line Installation
```bash
cp -r ~/github/.warp-template /path/to/new-project/.warp && chmod +x /path/to/new-project/.warp/scripts/*.sh
```

### Step-by-step Installation
```bash
# 1. Navigate to your project
cd /path/to/new-project

# 2. Copy the template
cp -r ~/github/.warp-template .warp

# 3. Make scripts executable
chmod +x .warp/scripts/*.sh

# 4. Create conversations directory (optional but recommended)
mkdir -p .warp/conversations

# 5. Initialize Git if needed
git init

# 6. Setup dual remotes
.warp/scripts/setup-remotes.sh
```

## What Gets Copied
- ✅ Documentation templates
- ✅ Task tracking files
- ✅ Dual repository scripts
- ✅ All executable permissions preserved

## What You Need to Add
- GitHub repository URLs (via `setup-remotes.sh`)
- Conversation summaries as you work
- Task updates in `NEXT-STEPS.md`

## Verification
After copying, verify the installation:

```bash
cd /path/to/new-project

# Check files exist
ls -la .warp/

# Check scripts are executable
ls -l .warp/scripts/

# Test status script
.warp/scripts/status-remotes.sh
```

## Next Steps
1. Read `QUICKSTART.md` for usage guide
2. Configure remotes with `scripts/setup-remotes.sh`
3. Start documenting AI sessions using `CONVERSATION-template.md`

---

**Template Version**: 1.0  
**Last Updated**: 2025-01-17
