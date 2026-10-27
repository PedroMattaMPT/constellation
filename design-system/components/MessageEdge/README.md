# MessageEdge

A directed line between two sessions that messaged each other. Weight shows volume; the arrowhead marks the receiver.

**Anatomy:** an SVG path that leaves along the dominant axis (React Flow handles sit on the sides or the top and bottom), an arrowhead marker, a 14 px invisible hit area, and a count chip (`→ 12`) at the midpoint that appears on hover and selection.

| Volume | Web stroke | TUI |
|---|---|---|
| 1–2 messages | `edge-1` 1.25 px | `─` `│` |
| 3–9 | `edge-2` 2.5 px | `━` `┃` |
| 10 or more | double line: 5 px with a 1.5 px `surface` gap | `═` `║` |
| subagent ↔ parent | `edge-subagent`, dotted | `┄ ┆`, `└◦` |

| State | Web | TUI |
|---|---|---|
| default | `edge` (teal) | `edge` |
| focused / selected | `focus`, count chip shown | lanes of the focused node's pairs in `focus` |
| hover (web) | count chip shown | — |
| disabled (an endpoint stopped) | removed with its node | removed |
| live (a message in flight) | dashes run twice, then stop (none with reduced motion) | the arrowhead flashes reverse once |

**TUI form.** One lane per pair of sessions at the right of the map: short pairs take the inner lanes, the weight is the total in both directions, and `◂` marks each receiving row. Clicking a web edge, or `e` then `enter` on a TUI node, opens the messages between the two sessions in the tree, filtered to peer messages.

**Consumer provides:** `sourceX`, `sourceY`, `targetX`, `targetY` (React Flow's `EdgeProps`), `count`, `kind` (`peer` | `subagent`), `selected`, `live`. Register it with `edgeTypes={{ message: (p) => <MessageEdge {...p} count={p.data.count} /> }}`.

**Don't:** label every edge (the map becomes text). Don't draw two edges for a pair in the TUI. Don't animate continuously.
