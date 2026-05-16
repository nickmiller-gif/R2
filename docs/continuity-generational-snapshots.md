# Continuity — generational R2 buckets (Initiative 10 Phase 0)

Cold-storage buckets hold tarball snapshots of workspace artifacts plus (later) Atlas / Twin / Vault exports. **Bucket creation is manual** in Cloudflare (Dashboard or Wrangler); do not commit account tokens.

## Bucket names

| Bucket name             | Cadence (intent)                            |
| ----------------------- | ------------------------------------------- |
| `r2-continuity-weekly`  | Weekly automated snapshots (Week 3+ script) |
| `r2-continuity-monthly` | Monthly verification / larger rollups       |
| `r2-continuity-annual`  | Annual estate-grade archives                |

Create all three in the Cloudflare account that already hosts R2 continuity tooling. Enable default encryption and block public access.

If **`wrangler r2 bucket create`** fails with **code 10042** (“Please enable R2 through the Cloudflare Dashboard”), open **Cloudflare Dashboard → R2 → Get started** for the target account first, then retry bucket creation.

## First manual snapshot (umbrella “R2 Complete”)

From the **umbrella** directory that contains the strategic PDFs and Markdown (paths below assume the folder is literally named `R2 Complete` on disk):

```bash
UMBRELLA="$HOME/Desktop/R2 Complete"
STAMP="$(date -u +%Y%m%dT%H%MZ)"
OUT="/tmp/r2-continuity-manual-${STAMP}.tar.gz"

tar -czf "$OUT" -C "$UMBRELLA" \
  R2-Master-Brief.pdf \
  R2-Entity-Tree.pdf \
  R2-Generational-Implementation-Plan-2026-05-15.md \
  R2/docs/adr/ADR-0008-generational-openhuman-decision.md \
  Negotiation_Intelligence_System_Plan.md
```

Add more explicit paths as they exist on disk. Omit missing files or create the tarball from a small staging directory that copies only present artifacts.

## Naming objects

Suggested key pattern: `manual/${STAMP}/snapshot.tar.gz` so listings sort chronologically.

## Related work

Week 3 adds automated `continuity-snapshot.sh` per Generational Plan §14; this document stays the operator source for bucket names and the first manual proof.
