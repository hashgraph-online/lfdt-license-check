# LFDT License Compliance Check

CLI tool for verifying npm dependencies comply with [LF Decentralized Trust license requirements](https://lf-decentralized-trust.github.io/governance/governing-documents/allowed-third-party-licenses.html).


## Quick Start

```bash
# Check current directory
npm run check

# Check GitHub repository
npm run check https://github.com/hashgraph-online/hashgraph-online-standards-sdk-js
```

## How It Works

- ✅ **Apache-2.0** is automatically approved
- ⚠️ **Other licenses** need 12+ months age and 10+ stars/forks
- ❌ **Non-approved licenses** are rejected

## Approved Licenses

**Auto-approved:** Apache-2.0

**Requires verification:** MIT, BSD-2-Clause, BSD-3-Clause, ISC, and [others](https://lf-decentralized-trust.github.io/governance/governing-documents/allowed-third-party-licenses.html#approved-licenses-for-allowlist)

## Troubleshooting

- **"Unable to verify substantial use"** → Install GitHub CLI: `gh auth login`
- **Wrong license detected** → Check package.json has correct license field

## License

Apache-2.0