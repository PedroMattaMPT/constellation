# StatusBadge

A session's status as glyph + word + color: `● working`, `? needs you`, `○ idle`, `◌ stale 3h`, `× error`, `■ stopped`. `compact` keeps only the glyph (with a screen-reader label).

| Status | Glyph | ASCII | Token | Treatment |
|---|---|---|---|---|
| working | `●` | `*` | `status-working` | text |
| waiting (needs you) | `?` | `?` | `status-waiting-fill` / `on-status-waiting-fill` | **fill chip**: the only amber fill |
| idle | `○` | `o` | `status-idle` | text |
| stale | `◌` | `~` | `status-stale` | text, with the age |
| error | `×` | `x` | `status-error` | bold text |
| stopped | `■` | `#` | `status-stopped` | text |

**States:** badges aren't interactive. Their row or node carries focus, selection and the disabled look.

**Do:** keep the glyph even in the tightest layout. Drop the word first.
**Don't:** use the waiting chip's amber for anything else.
