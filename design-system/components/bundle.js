/* @ds-bundle: {"format":4,"namespace":"Constellation","components":[{"name":"SessionNode"},{"name":"MessageEdge"},{"name":"TreeRow"},{"name":"Pane"},{"name":"StatusBar"},{"name":"CommandMenu"},{"name":"ModelPicker"},{"name":"QuestionCard"},{"name":"PermissionPrompt"},{"name":"ContextBar"},{"name":"Sparkline"},{"name":"SessionLauncher"},{"name":"BroadcastPrompt"},{"name":"StatusBadge"},{"name":"ModeBadge"},{"name":"Kbd"},{"name":"TuiFrame"}]} */
(() => {
  // ../ds/project/components/src/react.ts
  var React = window.React;

  // ../ds/project/components/src/glyphs.ts
  var GLYPHS = {
    status: {
      working: {
        unicode: "●",
        ascii: "*",
        nerd: "",
        label: "working"
      },
      waiting: {
        unicode: "?",
        ascii: "?",
        nerd: "",
        label: "needs you"
      },
      idle: {
        unicode: "○",
        ascii: "o",
        nerd: "",
        label: "idle"
      },
      stale: {
        unicode: "◌",
        ascii: "~",
        nerd: "",
        label: "stale"
      },
      error: {
        unicode: "×",
        ascii: "x",
        nerd: "",
        label: "error"
      },
      stopped: {
        unicode: "■",
        ascii: "#",
        nerd: "",
        label: "stopped"
      }
    },
    spinner: {
      unicode: [
        "▖",
        "▘",
        "▝",
        "▗"
      ],
      ascii: [
        "-",
        "\\",
        "|",
        "/"
      ],
      interval_ms: 120
    },
    kind: {
      managed: {
        unicode: "◆",
        ascii: "+",
        nerd: "",
        label: "managed"
      },
      external: {
        unicode: "◇",
        ascii: ":",
        nerd: "",
        label: "ext"
      }
    },
    mode: {
      default: {
        unicode: "·",
        ascii: ".",
        nerd: "",
        label: "default"
      },
      plan: {
        unicode: "‖",
        ascii: "=",
        nerd: "",
        label: "plan"
      },
      acceptEdits: {
        unicode: "±",
        ascii: "+",
        nerd: "",
        label: "edits"
      },
      auto: {
        unicode: "»",
        ascii: ">",
        nerd: "",
        label: "auto"
      },
      bypassPermissions: {
        unicode: "!",
        ascii: "!",
        nerd: "",
        label: "BYPASS"
      },
      dontAsk: {
        unicode: "∅",
        ascii: "0",
        nerd: "",
        label: "no-ask"
      }
    },
    message: {
      project: {
        unicode: "⌂",
        ascii: "=",
        nerd: "",
        label: "project"
      },
      prompt: {
        unicode: "›",
        ascii: "$",
        nerd: "",
        label: "prompt"
      },
      slash: {
        unicode: "/",
        ascii: "/",
        nerd: "/",
        label: "command"
      },
      tool: {
        unicode: "λ",
        ascii: "&",
        nerd: "",
        label: "tool"
      },
      question: {
        unicode: "?",
        ascii: "?",
        nerd: "",
        label: "asked"
      },
      answer: {
        unicode: "✓",
        ascii: "v",
        nerd: "",
        label: "answered"
      },
      denied: {
        unicode: "×",
        ascii: "x",
        nerd: "",
        label: "denied"
      },
      sent: {
        unicode: "→",
        ascii: ">",
        nerd: "",
        label: "sent"
      },
      received: {
        unicode: "←",
        ascii: "<",
        nerd: "",
        label: "received"
      },
      subagent_started: {
        unicode: "◦",
        ascii: "+",
        nerd: "",
        label: "subagent"
      },
      subagent_reported: {
        unicode: "↑",
        ascii: "^",
        nerd: "",
        label: "reported"
      },
      reply: {
        unicode: "¶",
        ascii: '"',
        nerd: "",
        label: "reply"
      }
    },
    alert: {
      normal: {
        unicode: "·",
        ascii: ".",
        nerd: "",
        label: "ok"
      },
      warning: {
        unicode: "△",
        ascii: "^",
        nerd: "",
        label: "warn"
      },
      critical: {
        unicode: "▲",
        ascii: "!",
        nerd: "",
        label: "CRIT"
      }
    },
    tree: {
      collapsed: {
        unicode: "▸",
        ascii: "+"
      },
      expanded: {
        unicode: "▾",
        ascii: "-"
      },
      branch: {
        unicode: "├─",
        ascii: "|-"
      },
      last: {
        unicode: "└─",
        ascii: "`-"
      },
      pipe: {
        unicode: "│ ",
        ascii: "| "
      },
      cursor: {
        unicode: "▌",
        ascii: ">"
      }
    },
    graph: {
      edge_light: {
        unicode: "─",
        ascii: "-",
        label: "1–2 messages"
      },
      edge_heavy: {
        unicode: "━",
        ascii: "=",
        label: "3–9 messages"
      },
      edge_double: {
        unicode: "═",
        ascii: "#",
        label: "10+ messages"
      },
      lane_light: {
        unicode: "│",
        ascii: "|"
      },
      lane_heavy: {
        unicode: "┃",
        ascii: "|"
      },
      lane_double: {
        unicode: "║",
        ascii: "H"
      },
      arrow_in: {
        unicode: "◂",
        ascii: "<"
      },
      arrow_out: {
        unicode: "▸",
        ascii: ">"
      },
      corner: {
        unicode: "╭╮╰╯",
        ascii: "++++"
      },
      dashed: {
        unicode: "┄┆",
        ascii: "-:"
      },
      subagent: {
        unicode: "└◦",
        ascii: "`+"
      }
    },
    meter: {
      bar: {
        unicode: [
          "▏",
          "▎",
          "▍",
          "▌",
          "▋",
          "▊",
          "▉",
          "█"
        ],
        ascii: [
          "#"
        ],
        track: {
          unicode: " ",
          ascii: "-"
        },
        caps: {
          unicode: "▕▏",
          ascii: "[]"
        }
      },
      spark: {
        unicode: [
          "▁",
          "▂",
          "▃",
          "▄",
          "▅",
          "▆",
          "▇",
          "█"
        ],
        ascii: [
          "_",
          ".",
          "-",
          "-",
          "=",
          "=",
          "#",
          "#"
        ]
      }
    },
    misc: {
      branch: {
        unicode: "@",
        ascii: "@",
        nerd: ""
      },
      separator: {
        unicode: "│",
        ascii: "|"
      },
      ellipsis: {
        unicode: "…",
        ascii: "~"
      },
      radio_on: {
        unicode: "(●)",
        ascii: "(*)"
      },
      radio_off: {
        unicode: "( )",
        ascii: "( )"
      },
      check_on: {
        unicode: "[x]",
        ascii: "[x]"
      },
      check_off: {
        unicode: "[ ]",
        ascii: "[ ]"
      },
      image: {
        unicode: "▣",
        ascii: "[img]",
        nerd: ""
      },
      mcp: {
        unicode: "mcp",
        ascii: "mcp",
        nerd: ""
      }
    }
  };

  // ../ds/project/components/src/atoms.tsx
  var G = GLYPHS, glyph = (cat, name) => {
    var _a2, _b, _c;
    return (_c = (_b = (_a2 = G[cat]) == null ? void 0 : _a2[name]) == null ? void 0 : _b.unicode) != null ? _c : "?";
  }, label = (cat, name) => {
    var _a2, _b, _c;
    return (_c = (_b = (_a2 = G[cat]) == null ? void 0 : _a2[name]) == null ? void 0 : _b.label) != null ? _c : name;
  }, MODE_CLASS = {
    default: "default",
    plan: "plan",
    acceptEdits: "edits",
    auto: "auto",
    bypassPermissions: "bypass",
    dontAsk: "dontask"
  }, cx = (...parts) => parts.filter(Boolean).join(" ");
  function StatusBadge({ status, compact = !1, age }) {
    let word = status === "stale" && age ? `stale ${age}` : label("status", status);
    return status === "waiting" ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--waiting", title: "needs you" }, glyph("status", "waiting"), compact ? null : ` ${word}`) : /* @__PURE__ */ React.createElement("span", { className: cx("cn-status", `cn-status--${status}`), title: compact ? word : void 0 }, /* @__PURE__ */ React.createElement("span", { className: "cn-glyph", "aria-hidden": "true" }, glyph("status", status)), compact ? /* @__PURE__ */ React.createElement("span", { className: "cn-sr" }, word) : /* @__PURE__ */ React.createElement("span", null, " ", word));
  }
  function ModeBadge({ mode, compact = !1 }) {
    let cls = MODE_CLASS[mode], text = `${glyph("mode", mode)}${compact ? "" : " " + label("mode", mode)}`, filled = mode === "auto" || mode === "bypassPermissions";
    return /* @__PURE__ */ React.createElement("span", { className: cx(filled ? "cn-chip" : "cn-mode", `cn-${filled ? "chip" : "mode"}--${cls}`), title: `mode: ${label("mode", mode)}` }, text);
  }
  function KindMark({ kind }) {
    return /* @__PURE__ */ React.createElement("span", { className: cx("cn-kind", `cn-kind--${kind}`), title: kind === "managed" ? "managed: started here" : "external: started elsewhere, watched" }, glyph("kind", kind));
  }
  function Kbd({ children }) {
    return /* @__PURE__ */ React.createElement("kbd", { className: "cn-kbd" }, children);
  }
  function KeyHints({ keys, prefix }) {
    return /* @__PURE__ */ React.createElement("span", { className: "cn-keys" }, prefix ? /* @__PURE__ */ React.createElement("span", { className: "cn-keys__prefix" }, /* @__PURE__ */ React.createElement(Kbd, null, prefix)) : null, keys.map(([k, l]) => /* @__PURE__ */ React.createElement("span", { className: "cn-keys__item", key: k + l }, /* @__PURE__ */ React.createElement("span", { className: "cn-keys__key" }, k), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-keys__label" }, l))));
  }
  function Spinner() {
    let frames = GLYPHS.spinner.unicode, [i, setI] = React.useState(1);
    return React.useEffect(() => {
      var _a2;
      if (typeof window != "undefined" && ((_a2 = window.matchMedia) != null && _a2.call(window, "(prefers-reduced-motion: reduce)").matches)) return;
      let t = setInterval(() => setI((n) => (n + 1) % frames.length), GLYPHS.spinner.interval_ms);
      return () => clearInterval(t);
    }, []), /* @__PURE__ */ React.createElement("span", { className: "cn-spinner", "aria-hidden": "true" }, frames[i]);
  }
  function MsgGlyph({ type }) {
    return /* @__PURE__ */ React.createElement("span", { className: cx("cn-msg-glyph", `cn-msg--${type}`), "aria-hidden": "true" }, glyph("message", type));
  }
  function AlertFlag({ level, label: text }) {
    return level === "normal" ? null : level === "critical" ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--critical" }, glyph("alert", "critical"), " ", text) : /* @__PURE__ */ React.createElement("span", { className: "cn-alert cn-alert--warning" }, glyph("alert", "warning"), " ", text);
  }
  function WhichKey({ prefix = "C-Space", groups }) {
    return /* @__PURE__ */ React.createElement("div", { className: "cn-which", role: "dialog", "aria-label": `${prefix} bindings` }, /* @__PURE__ */ React.createElement("div", { className: "cn-which__head" }, /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--brand" }, prefix), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "then"), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "? all keys · esc cancel")), /* @__PURE__ */ React.createElement("div", { className: "cn-which__grid" }, groups.map((g) => /* @__PURE__ */ React.createElement("div", { key: g.title, className: "cn-which__group" }, /* @__PURE__ */ React.createElement("div", { className: "cn-label" }, g.title), g.keys.map(([k, l]) => /* @__PURE__ */ React.createElement("div", { key: k, className: "cn-which__row" }, /* @__PURE__ */ React.createElement("span", { className: "cn-which__key" }, k), /* @__PURE__ */ React.createElement("span", { className: "cn-which__label" }, l)))))));
  }

  // ../ds/project/components/src/meters.tsx
  var levelFor = (pct, warn = 80, crit = 95) => pct >= crit ? "critical" : pct >= warn ? "warning" : "normal";
  function ContextBar({
    value,
    max = 2e5,
    compactAt = 0.8,
    slices,
    showLabel = !0,
    cells = 8
  }) {
    let level = levelFor(value), used = Math.round(value / 100 * max);
    if (slices) {
      let total = slices.reduce((a, s) => a + s.tokens, 0), free = Math.max(0, max - total);
      return /* @__PURE__ */ React.createElement("div", { className: "cn-ctx-detail" }, /* @__PURE__ */ React.createElement("div", { className: "cn-ctx-detail__head" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "context"), " ", /* @__PURE__ */ React.createElement("span", { className: `cn-level--${level}` }, Math.round(total / max * 100), "%"), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, fmt(total), " of ", fmt(max), " · compacts at ", Math.round(compactAt * 100), "%")), /* @__PURE__ */ React.createElement("div", { className: "cn-ctx-detail__bar", role: "img", "aria-label": `context ${Math.round(total / max * 100)} percent` }, slices.map((s) => /* @__PURE__ */ React.createElement("span", { key: s.label, className: `cn-ctx-seg cn-ctx-seg--${s.tone}`, style: { width: `${s.tokens / max * 100}%` } })), /* @__PURE__ */ React.createElement("span", { className: "cn-ctx-tick", style: { left: `${compactAt * 100}%` } })), /* @__PURE__ */ React.createElement("ul", { className: "cn-ctx-legend" }, slices.map((s) => /* @__PURE__ */ React.createElement("li", { key: s.label }, /* @__PURE__ */ React.createElement("span", { className: `cn-ctx-key cn-ctx-seg--${s.tone}` }, "■"), " ", s.label, " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, fmt(s.tokens)))), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("span", { className: "cn-ctx-key cn-ctx-seg--free" }, "□"), " free ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, fmt(free)))));
    }
    return /* @__PURE__ */ React.createElement("span", { className: cx("cn-ctx", `cn-ctx--${level}`), title: `context ${value}% · ${fmt(used)} of ${fmt(max)} tokens` }, showLabel ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "ctx ") : null, /* @__PURE__ */ React.createElement("span", { className: "cn-ctx__track", style: { width: `${cells}ch` }, role: "meter", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": value, "aria-label": "context window" }, /* @__PURE__ */ React.createElement("span", { className: "cn-ctx__fill", style: { width: `${Math.min(100, value)}%` } }), /* @__PURE__ */ React.createElement("span", { className: "cn-ctx-tick", style: { left: `${compactAt * 100}%` } })), /* @__PURE__ */ React.createElement("span", { className: "cn-ctx__pct" }, " ", value, "%"), level !== "normal" ? /* @__PURE__ */ React.createElement("span", { className: "cn-ctx__flag" }, " ", glyph("alert", level)) : null);
  }
  function Sparkline({
    values,
    label: label2,
    current,
    warn,
    crit,
    max,
    unit = ""
  }) {
    var _a2;
    let top = max != null ? max : Math.max(1, ...values), cell = 8, h = 16, last = (_a2 = values[values.length - 1]) != null ? _a2 : 0, lvl = crit != null && last >= crit ? "critical" : warn != null && last >= warn ? "warning" : "normal";
    return /* @__PURE__ */ React.createElement("span", { className: cx("cn-spark", `cn-spark--${lvl}`) }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-spark__label" }, label2), /* @__PURE__ */ React.createElement(
      "svg",
      {
        className: "cn-spark__svg",
        width: values.length * cell,
        height: h,
        viewBox: `0 0 ${values.length * cell} ${h}`,
        role: "img",
        "aria-label": `${label2} over the last ${values.length} minutes, now ${current != null ? current : last + unit}`
      },
      warn != null ? /* @__PURE__ */ React.createElement("line", { className: "cn-spark__threshold", x1: 0, x2: values.length * cell, y1: h - warn / top * h, y2: h - warn / top * h }) : null,
      values.map((v, i) => {
        let bh = Math.max(2, Math.min(v, top) / top * h), l = crit != null && v >= crit ? "critical" : warn != null && v >= warn ? "warning" : "normal";
        return /* @__PURE__ */ React.createElement("rect", { key: i, className: `cn-spark__bar cn-spark__bar--${l}`, x: i * cell + 1, y: h - bh, width: cell - 2, height: bh });
      })
    ), /* @__PURE__ */ React.createElement("span", { className: cx("cn-spark__now", `cn-level--${lvl}`) }, current != null ? current : `${last}${unit}`), lvl !== "normal" ? /* @__PURE__ */ React.createElement("span", { className: `cn-level--${lvl}` }, " ", glyph("alert", lvl)) : null);
  }
  function sparkText(values, max) {
    let blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"], top = max != null ? max : Math.max(1, ...values);
    return values.map((v) => blocks[Math.min(7, Math.max(0, Math.round(v / top * 7)))]).join("");
  }
  function fmt(n) {
    return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n);
  }

  // ../ds/project/components/src/map.tsx
  function SessionNode(p) {
    var _a2, _b;
    let kind = (_a2 = p.kind) != null ? _a2 : "managed", attention = p.status === "waiting" ? "waiting" : p.status === "stale" ? "stale" : p.status === "error" ? "error" : null, cls = cx(
      "cn-node",
      `cn-node--${kind}`,
      attention && `cn-node--${attention}`,
      p.mode === "bypassPermissions" && "cn-node--bypass",
      p.focused && "cn-node--focused",
      p.selected && "cn-node--selected",
      p.disabled && "cn-node--disabled",
      p.compact && "cn-node--compact"
    ), name = /* @__PURE__ */ React.createElement("span", { className: "cn-node__name" }, p.index != null ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, p.index, " ") : null, p.name);
    return p.compact ? /* @__PURE__ */ React.createElement("div", { className: cls, tabIndex: p.disabled ? -1 : 0, "aria-label": `${p.name}, ${p.status}, ${p.mode}` }, /* @__PURE__ */ React.createElement("div", { className: "cn-node__row" }, p.selected ? /* @__PURE__ */ React.createElement("span", { className: "cn-node__check" }, "[x]") : null, /* @__PURE__ */ React.createElement(KindMark, { kind }), " ", name, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement(StatusBadge, { status: p.status, age: p.ago, compact: !0 }), /* @__PURE__ */ React.createElement(ModeBadge, { mode: p.mode, compact: !0 }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-node__ago" }, p.ago))) : /* @__PURE__ */ React.createElement("div", { className: "cn-node-wrap" }, /* @__PURE__ */ React.createElement("div", { className: cls, tabIndex: p.disabled ? -1 : 0, "aria-label": `${p.name}, ${p.status}, mode ${p.mode}, ${p.project}` }, /* @__PURE__ */ React.createElement("div", { className: "cn-node__row cn-node__head" }, p.selected ? /* @__PURE__ */ React.createElement("span", { className: "cn-node__check" }, "[x]") : null, /* @__PURE__ */ React.createElement(KindMark, { kind }), " ", name, kind === "external" ? /* @__PURE__ */ React.createElement("span", { className: "cn-tag" }, "ext") : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement(StatusBadge, { status: p.status, age: p.ago })), /* @__PURE__ */ React.createElement("div", { className: "cn-node__row cn-node__meta" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-ellipsis" }, p.project), /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-ellipsis" }, "@", p.branch), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement(ModeBadge, { mode: p.mode }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-node__ago" }, p.ago)), /* @__PURE__ */ React.createElement("div", { className: "cn-node__row cn-node__task", title: p.task }, p.task), /* @__PURE__ */ React.createElement("div", { className: cx("cn-node__row", "cn-node__step", p.status === "error" && "cn-status--error") }, p.status === "working" ? /* @__PURE__ */ React.createElement(Spinner, null) : p.status === "error" ? /* @__PURE__ */ React.createElement("span", null, glyph("status", "error")) : /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, glyph("message", "prompt")), /* @__PURE__ */ React.createElement("span", { className: cx("cn-ellipsis", (p.status === "idle" || p.status === "stale") && "cn-dim") }, p.step)), p.summary ? /* @__PURE__ */ React.createElement("div", { className: "cn-node__row cn-node__summary", title: "model-written summary" }, p.summary) : null, p.ctx != null || p.cpu ? /* @__PURE__ */ React.createElement("div", { className: "cn-node__row cn-node__res" }, p.ctx != null ? /* @__PURE__ */ React.createElement(ContextBar, { value: p.ctx, cells: 6 }) : null, p.cpu ? /* @__PURE__ */ React.createElement(Sparkline, { values: p.cpu.slice(-12), label: "cpu", warn: 200, crit: 400, max: 400, current: `${p.cpu[p.cpu.length - 1]}%` }) : null, p.alert ? /* @__PURE__ */ React.createElement(AlertFlag, { level: p.alert.level, label: p.alert.label }) : null) : null), (_b = p.subagents) != null && _b.length ? /* @__PURE__ */ React.createElement("div", { className: "cn-node__subs" }, p.subagents.map((s) => /* @__PURE__ */ React.createElement(SubagentNode, { key: s.name, ...s }))) : null);
  }
  function SubagentNode({ name, status, tools }) {
    return /* @__PURE__ */ React.createElement("div", { className: cx("cn-sub", `cn-sub--${status}`) }, /* @__PURE__ */ React.createElement("span", { className: "cn-sub__link", "aria-hidden": "true" }, "└"), /* @__PURE__ */ React.createElement("span", { className: "cn-msg--subagent_started" }, status === "working" ? glyph("message", "subagent_started") : glyph("message", "subagent_reported")), " ", /* @__PURE__ */ React.createElement("span", null, name), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, status === "working" ? "working" : "reported back", tools != null ? ` · ${tools} tools` : ""));
  }
  function ProjectGroup({ name, count, waiting, children, style }) {
    return /* @__PURE__ */ React.createElement("section", { className: "cn-group", style, "aria-label": `project ${name}` }, /* @__PURE__ */ React.createElement("header", { className: "cn-group__label" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, glyph("message", "project")), " ", /* @__PURE__ */ React.createElement("b", null, name), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, count), waiting ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--waiting" }, glyph("status", "waiting"), " ", waiting) : null), children);
  }
  var edgeTier = (count) => count >= 10 ? 3 : count >= 3 ? 2 : 1;
  function MessageEdge({ sourceX, sourceY, targetX, targetY, count, kind = "peer", selected, live, id }) {
    let tier = edgeTier(count), vertical = Math.abs(targetY - sourceY) > Math.abs(targetX - sourceX), span = vertical ? targetY - sourceY : targetX - sourceX, k = Math.sign(span || 1) * Math.max(24, Math.abs(span) / 2), d = vertical ? `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + k}, ${targetX} ${targetY - k}, ${targetX} ${targetY}` : `M ${sourceX} ${sourceY} C ${sourceX + k} ${sourceY}, ${targetX - k} ${targetY}, ${targetX} ${targetY}`, mx = (sourceX + targetX) / 2, my = (sourceY + targetY) / 2, marker = `cn-arrow-${kind}-${selected ? "sel" : "rest"}-${tier}`;
    return /* @__PURE__ */ React.createElement("g", { className: cx("cn-edge", `cn-edge--${kind}`, `cn-edge--t${tier}`, selected && "cn-edge--selected", live && "cn-edge--live"), "data-id": id }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("marker", { id: marker, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: tier === 3 ? 3 : tier === 2 ? 4 : 6, markerHeight: tier === 3 ? 3 : tier === 2 ? 4 : 6, orient: "auto-start-reverse", markerUnits: "strokeWidth" }, /* @__PURE__ */ React.createElement("path", { d: "M 0 0 L 10 5 L 0 10 z", className: "cn-edge__head" }))), /* @__PURE__ */ React.createElement("path", { d, className: "cn-edge__hit" }), tier === 3 ? /* @__PURE__ */ React.createElement("path", { d, className: "cn-edge__line cn-edge__line--outer" }) : null, /* @__PURE__ */ React.createElement("path", { d, className: "cn-edge__line", markerEnd: `url(#${marker})` }), tier === 3 ? /* @__PURE__ */ React.createElement("path", { d, className: "cn-edge__gap" }) : null, /* @__PURE__ */ React.createElement("g", { className: "cn-edge__label", transform: `translate(${mx}, ${my})` }, /* @__PURE__ */ React.createElement("rect", { x: -22, y: -10, width: 44, height: 20, rx: 2 }), /* @__PURE__ */ React.createElement("text", { x: 0, y: 4, textAnchor: "middle" }, kind === "subagent" ? "↑ " : "→ ", count)));
  }

  // ../ds/project/components/src/tree.tsx
  function TreeRow(p) {
    var _a2, _b, _c;
    let depth = (_a2 = p.depth) != null ? _a2 : 0, guides = (_b = p.guides) != null ? _b : Array.from({ length: Math.max(0, depth - 1) }, () => !0), disclosure = p.hasChildren ? p.expanded ? glyph("tree", "expanded") : glyph("tree", "collapsed") : " ";
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className: cx("cn-row", `cn-row--${p.kind}`, p.cursor && "cn-row--cursor", p.match && "cn-row--match", p.dimmed && "cn-row--dimmed", p.attention && "cn-row--attention"),
        role: "treeitem",
        "aria-level": depth + 1,
        "aria-expanded": p.hasChildren ? !!p.expanded : void 0,
        "aria-selected": !!p.cursor,
        tabIndex: p.cursor ? 0 : -1,
        onDoubleClick: p.onActivate
      },
      /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar", "aria-hidden": "true" }, p.cursor ? glyph("tree", "cursor") : " "),
      /* @__PURE__ */ React.createElement("span", { className: "cn-row__guides", "aria-hidden": "true" }, guides.map((g, i) => /* @__PURE__ */ React.createElement("span", { key: i }, g ? "│ " : "  ")), depth > 0 ? /* @__PURE__ */ React.createElement("span", null, p.last ? "└ " : "├ ") : null),
      /* @__PURE__ */ React.createElement("span", { className: "cn-row__disc", "aria-hidden": "true" }, disclosure),
      p.kind === "project" ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-row__glyph" }, glyph("message", "project")) : null,
      p.kind === "session" ? /* @__PURE__ */ React.createElement(KindMark, { kind: (_c = p.sessionKind) != null ? _c : "managed" }) : null,
      p.kind !== "project" && p.kind !== "session" ? /* @__PURE__ */ React.createElement(MsgGlyph, { type: p.kind }) : null,
      p.turn != null ? /* @__PURE__ */ React.createElement("span", { className: "cn-msg--prompt cn-row__turn" }, p.turn) : null,
      /* @__PURE__ */ React.createElement("span", { className: "cn-row__label" }, p.label),
      p.kind === "session" && p.status ? /* @__PURE__ */ React.createElement(StatusBadge, { status: p.status, compact: !0 }) : null,
      /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }),
      p.meta != null ? /* @__PURE__ */ React.createElement("span", { className: "cn-row__meta" }, p.meta) : null
    );
  }
  var FILTER_GLYPH = { peer: "→←", subagent: "◦↑" };
  function TreeFilter({ chips, query }) {
    return /* @__PURE__ */ React.createElement("div", { className: "cn-filter", role: "toolbar", "aria-label": "filter by type" }, /* @__PURE__ */ React.createElement("span", { className: "cn-label" }, "TREE"), chips.map((c, i) => {
      var _a2;
      return /* @__PURE__ */ React.createElement("button", { key: c.type, className: cx("cn-filter__chip", c.on ? "cn-filter__chip--on" : "cn-filter__chip--off"), "aria-pressed": c.on, title: `${i + 1}: ${c.type}` }, /* @__PURE__ */ React.createElement("span", { className: `cn-msg--${c.type === "peer" ? "sent" : c.type === "subagent" ? "subagent_started" : c.type}` }, (_a2 = FILTER_GLYPH[c.type]) != null ? _a2 : glyph("message", c.type)), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, c.count));
    }), query ? /* @__PURE__ */ React.createElement("span", { className: "cn-filter__query" }, "/", query) : null);
  }

  // ../ds/project/components/src/pane.tsx
  function MessageRow({ type, text, detail, body }) {
    return /* @__PURE__ */ React.createElement("div", { className: cx("cn-msg", `cn-msg-row--${type}`) }, /* @__PURE__ */ React.createElement("span", { className: "cn-msg__gutter" }, /* @__PURE__ */ React.createElement(MsgGlyph, { type })), /* @__PURE__ */ React.createElement("div", { className: "cn-msg__main" }, /* @__PURE__ */ React.createElement("span", { className: cx("cn-msg__text", `cn-msg--${type}`) }, text), detail ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, " ", detail) : null, body ? /* @__PURE__ */ React.createElement("div", { className: "cn-msg__body" }, body) : null));
  }
  function StatusLine({ model, branch, ctx, mode, cost, mcp }) {
    let sep = /* @__PURE__ */ React.createElement("span", { className: "cn-sep", "aria-hidden": "true" }, "│");
    return /* @__PURE__ */ React.createElement("div", { className: "cn-statusline" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, model), sep, /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-statusline__branch" }, "@", branch), sep, /* @__PURE__ */ React.createElement(ContextBar, { value: ctx }), sep, /* @__PURE__ */ React.createElement(ModeBadge, { mode }), mcp ? /* @__PURE__ */ React.createElement(React.Fragment, null, sep, /* @__PURE__ */ React.createElement("span", { className: mcp.down ? "cn-level--warning" : "cn-dim" }, "mcp ", mcp.up, mcp.down ? ` · ${glyph("alert", "warning")} ${mcp.down} down` : "")) : null, cost ? /* @__PURE__ */ React.createElement(React.Fragment, null, sep, /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-statusline__cost" }, cost)) : null);
  }
  function PromptBox(p) {
    var _a2, _b;
    return /* @__PURE__ */ React.createElement("div", { className: cx("cn-prompt", p.focused && "cn-prompt--focused", !!p.broadcast && "cn-prompt--broadcast", p.external && "cn-prompt--external", p.disabled && "cn-prompt--disabled") }, p.broadcast ? /* @__PURE__ */ React.createElement("div", { className: "cn-prompt__banner cn-msg--sent" }, glyph("message", "sent"), " to ", p.broadcast, " sessions · synchronized") : null, p.external ? /* @__PURE__ */ React.createElement("div", { className: "cn-prompt__banner cn-kind--external" }, glyph("kind", "external"), " external · arrives as a peer message · no slash commands · ", /* @__PURE__ */ React.createElement("b", null, "A"), " adopt") : null, (_a2 = p.images) != null && _a2.length ? /* @__PURE__ */ React.createElement("div", { className: "cn-prompt__images" }, p.images.map((im) => /* @__PURE__ */ React.createElement("span", { key: im.name, className: "cn-tag" }, glyph("misc", "image"), " ", im.name, " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, im.size)))) : null, /* @__PURE__ */ React.createElement("div", { className: "cn-prompt__line" }, /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__marker" }, glyph("message", "prompt")), p.value ? /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__value" }, p.value) : /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__ph" }, (_b = p.placeholder) != null ? _b : "type a prompt, / for commands"), p.focused && !p.disabled ? /* @__PURE__ */ React.createElement("span", { className: "cn-caret", "aria-hidden": "true" }) : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), p.running ? /* @__PURE__ */ React.createElement(KeyHints, { keys: [["enter", "queue"], ["esc", "interrupt"]] }) : p.focused ? /* @__PURE__ */ React.createElement(KeyHints, { keys: [["enter", "send"], ["M-enter", "newline"]] }) : null));
  }
  function Pane(p) {
    var _a2;
    let kind = (_a2 = p.kind) != null ? _a2 : "managed";
    return /* @__PURE__ */ React.createElement(
      "section",
      {
        className: cx("cn-pane", p.focused && "cn-pane--focused", kind === "external" && "cn-pane--external", p.status_line.mode === "bypassPermissions" && "cn-pane--bypass", p.zoomed && "cn-pane--zoomed", p.status === "waiting" && "cn-pane--waiting"),
        style: p.height ? { height: p.height } : void 0,
        "aria-label": `pane ${p.index}: ${p.name}`
      },
      /* @__PURE__ */ React.createElement("header", { className: "cn-pane__head" }, /* @__PURE__ */ React.createElement("span", { className: "cn-pane__index" }, p.index), p.renaming != null ? /* @__PURE__ */ React.createElement("span", { className: "cn-rename" }, /* @__PURE__ */ React.createElement("span", { className: "cn-rename__value" }, p.renaming), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, " enter save · esc cancel")) : /* @__PURE__ */ React.createElement("span", { className: "cn-pane__name" }, p.name), /* @__PURE__ */ React.createElement(KindMark, { kind }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-ellipsis" }, p.project), p.zoomed ? /* @__PURE__ */ React.createElement("span", { className: "cn-tag", title: "zoomed (prefix z)" }, "Z") : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement(StatusBadge, { status: p.status, age: p.ago })),
      /* @__PURE__ */ React.createElement("div", { className: "cn-pane__conv", role: "log", "aria-live": "polite" }, p.messages.map((m, i) => /* @__PURE__ */ React.createElement(MessageRow, { key: i, ...m })), p.activity ? /* @__PURE__ */ React.createElement("div", { className: "cn-msg cn-msg--activity" }, /* @__PURE__ */ React.createElement("span", { className: "cn-msg__gutter cn-status--working" }, /* @__PURE__ */ React.createElement(Spinner, null)), /* @__PURE__ */ React.createElement("span", { className: "cn-msg__main" }, /* @__PURE__ */ React.createElement("span", { className: "cn-status--working" }, p.activity), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, " · esc to interrupt"))) : null),
      p.dock ? /* @__PURE__ */ React.createElement("div", { className: "cn-pane__dock" }, p.dock) : null,
      /* @__PURE__ */ React.createElement(PromptBox, { focused: p.focused, external: kind === "external", ...p.prompt }),
      /* @__PURE__ */ React.createElement(StatusLine, { ...p.status_line })
    );
  }
  function StatusBar({
    windows,
    sessions,
    prefix,
    cost,
    clock,
    warnings = 0,
    maxName = 8,
    limit
  }) {
    let waiting = sessions.filter((s) => s.status === "waiting").length, stale = sessions.filter((s) => s.status === "stale").length, keep = limit == null ? sessions : sessions.filter((s, i) => s.status === "waiting" || i < limit), hidden = sessions.length - keep.length;
    return /* @__PURE__ */ React.createElement("footer", { className: "cn-bar", role: "status" }, prefix ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--brand" }, "C-Space") : null, windows.map((w) => /* @__PURE__ */ React.createElement("span", { key: w.n, className: cx("cn-bar__win", w.active && "cn-bar__win--active") }, w.n, " ", w.name)), /* @__PURE__ */ React.createElement("span", { className: "cn-bar__sessions" }, keep.map(
      (s) => s.status === "waiting" ? /* @__PURE__ */ React.createElement("span", { key: s.n, className: "cn-chip cn-chip--waiting", title: `${s.name} needs you` }, s.n, glyph("status", "waiting"), " ", s.name) : /* @__PURE__ */ React.createElement("span", { key: s.n, className: cx("cn-bar__s", s.current && "cn-bar__s--current"), title: `${s.name}: ${s.status}` }, /* @__PURE__ */ React.createElement("span", { className: "cn-bar__n" }, s.n), /* @__PURE__ */ React.createElement("span", { className: `cn-status--${s.status}` }, glyph("status", s.status)), s.name.length > maxName ? s.name.slice(0, maxName) : s.name, s.zoomed ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "Z") : null)
    ), hidden ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "+", hidden) : null), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), waiting ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--waiting" }, glyph("status", "waiting"), " ", waiting) : null, stale ? /* @__PURE__ */ React.createElement("span", { className: "cn-status--stale" }, glyph("status", "stale"), " ", stale) : null, warnings ? /* @__PURE__ */ React.createElement("span", { className: "cn-level--warning" }, glyph("alert", "warning"), " ", warnings) : null, cost ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, cost) : null, clock ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, clock) : null);
  }

  // ../ds/project/components/src/menus.tsx
  function CommandMenu({ query, commands, highlighted = 0, total }) {
    return /* @__PURE__ */ React.createElement("div", { className: "cn-menu", role: "listbox", "aria-label": "commands" }, /* @__PURE__ */ React.createElement("div", { className: "cn-menu__head" }, /* @__PURE__ */ React.createElement("b", null, "/"), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__query" }, query), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, commands.length, " of ", total != null ? total : commands.length)), commands.map((c, i) => {
      let on = i === highlighted, q = query.toLowerCase(), at = c.name.toLowerCase().indexOf(q);
      return /* @__PURE__ */ React.createElement("div", { key: c.name, role: "option", "aria-selected": on, "aria-disabled": !!c.unavailable, className: cx("cn-menu__item", on && "cn-menu__item--on", c.unavailable && "cn-menu__item--off") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, on ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__name" }, "/", at >= 0 && q ? /* @__PURE__ */ React.createElement(React.Fragment, null, c.name.slice(0, at), /* @__PURE__ */ React.createElement("u", null, c.name.slice(at, at + q.length)), c.name.slice(at + q.length)) : c.name, c.args ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, " ", c.args) : null), /* @__PURE__ */ React.createElement("span", { className: cx("cn-menu__src", `cn-src--${c.source}`) }, c.source), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__desc" }, c.unavailable ? /* @__PURE__ */ React.createElement("i", null, c.unavailable) : c.description));
    }), /* @__PURE__ */ React.createElement("div", { className: "cn-menu__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["↑↓", "move"], ["tab", "complete"], ["enter", "run"], ["esc", "close"]] })));
  }
  function ModelPicker({ models, highlighted = 0, effort = "medium", efforts = ["low", "medium", "high", "max"], focusEffort }) {
    return /* @__PURE__ */ React.createElement("div", { className: "cn-menu cn-picker", role: "dialog", "aria-label": "model" }, /* @__PURE__ */ React.createElement("div", { className: "cn-menu__head" }, /* @__PURE__ */ React.createElement("b", null, "model"), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "applies to the next turn")), /* @__PURE__ */ React.createElement("div", { role: "radiogroup", "aria-label": "model" }, models.map((m, i) => {
      var _a2;
      let on = i === highlighted && !focusEffort;
      return /* @__PURE__ */ React.createElement("div", { key: m.id, role: "radio", "aria-checked": !!m.current, className: cx("cn-menu__item", on && "cn-menu__item--on") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, on ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: cx("cn-radio", m.current && "cn-radio--on") }, m.current ? glyph("misc", "radio_on") : glyph("misc", "radio_off")), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__name" }, i + 1, " ", m.name), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__src" }, (_a2 = m.context) != null ? _a2 : ""), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__desc" }, m.note));
    })), /* @__PURE__ */ React.createElement("div", { className: cx("cn-effort", focusEffort && "cn-effort--focused"), role: "radiogroup", "aria-label": "effort" }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, focusEffort ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "effort"), efforts.map((e) => /* @__PURE__ */ React.createElement("span", { key: e, role: "radio", "aria-checked": e === effort, className: cx("cn-effort__opt", e === effort && "cn-effort__opt--on") }, e))), /* @__PURE__ */ React.createElement("div", { className: "cn-menu__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["1-4", "pick"], ["←→", "effort"], ["enter", "apply"], ["esc", "close"]] })));
  }
  function ResumePicker({ sessions, highlighted = 0, query }) {
    let cur = sessions[highlighted];
    return /* @__PURE__ */ React.createElement("div", { className: "cn-menu cn-resume", role: "dialog", "aria-label": "resume a session" }, /* @__PURE__ */ React.createElement("div", { className: "cn-menu__head" }, /* @__PURE__ */ React.createElement("b", null, "resume"), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "/", query != null ? query : ""), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, sessions.length, " past sessions")), /* @__PURE__ */ React.createElement("div", { className: "cn-resume__body" }, /* @__PURE__ */ React.createElement("div", { className: "cn-resume__list", role: "listbox" }, sessions.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id, role: "option", "aria-selected": i === highlighted, className: cx("cn-menu__item", i === highlighted && "cn-menu__item--on") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, i === highlighted ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-status--stopped" }, glyph("status", "stopped")), /* @__PURE__ */ React.createElement("span", { className: "cn-menu__name" }, s.name), s.tag ? /* @__PURE__ */ React.createElement("span", { className: "cn-tag" }, s.tag) : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, s.when)))), cur ? /* @__PURE__ */ React.createElement("div", { className: "cn-resume__preview", "aria-label": "preview" }, /* @__PURE__ */ React.createElement("div", { className: "cn-dim" }, cur.project, " · ", cur.turns, " turns · ", cur.id.slice(0, 8)), cur.preview.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: l.startsWith("›") ? "cn-msg--prompt cn-b" : "" }, l))) : null), /* @__PURE__ */ React.createElement("div", { className: "cn-menu__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["enter", "resume"], ["f", "fork"], ["t", "tag"], ["/", "search"], ["esc", "close"]] })));
  }

  // ../ds/project/components/src/answer.tsx
  function QuestionCard({ session, questions, current = 0, answers = [], highlighted = 0, otherText, editingOther, state = "open" }) {
    let q = questions[current];
    if (state === "answered")
      return /* @__PURE__ */ React.createElement("div", { className: "cn-card cn-card--answered" }, /* @__PURE__ */ React.createElement("span", { className: "cn-msg--answer" }, glyph("message", "answer")), " ", questions.map((qq, i) => {
        let a = answers[i], text = typeof a == "string" ? a : (a != null ? a : []).map((k) => {
          var _a2;
          return (_a2 = qq.options[k]) == null ? void 0 : _a2.label;
        }).join(", ");
        return /* @__PURE__ */ React.createElement("span", { key: i }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, qq.header, ":"), " ", /* @__PURE__ */ React.createElement("b", null, text), i < questions.length - 1 ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, " · ") : null);
      }));
    let chosen = answers[current], picked = (i) => Array.isArray(chosen) && chosen.includes(i);
    return /* @__PURE__ */ React.createElement("div", { className: cx("cn-card", "cn-card--question", state === "readonly" && "cn-card--readonly"), role: "group", "aria-label": `question from ${session != null ? session : "session"}: ${q.question}` }, /* @__PURE__ */ React.createElement("div", { className: "cn-card__head" }, /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--waiting" }, glyph("status", "waiting"), " ", q.header), questions.length > 1 ? /* @__PURE__ */ React.createElement("span", { className: "cn-steps" }, questions.map((qq, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: cx("cn-steps__s", i === current && "cn-steps__s--on", answers[i] != null && "cn-steps__s--done") }, answers[i] != null ? glyph("message", "answer") : i + 1, " ", qq.header))) : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), session ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, session) : null), /* @__PURE__ */ React.createElement("div", { className: "cn-card__q" }, q.question), /* @__PURE__ */ React.createElement("div", { role: q.multiSelect ? "group" : "radiogroup", className: "cn-opts" }, q.options.map((o, i) => {
      let on = i === highlighted && !editingOther, mark = q.multiSelect ? picked(i) ? glyph("misc", "check_on") : glyph("misc", "check_off") : picked(i) ? glyph("misc", "radio_on") : glyph("misc", "radio_off");
      return /* @__PURE__ */ React.createElement("div", { key: i, role: q.multiSelect ? "checkbox" : "radio", "aria-checked": picked(i), className: cx("cn-opt", on && "cn-opt--on", picked(i) && "cn-opt--picked") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, on ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__mark" }, mark), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__key" }, i + 1), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__label" }, o.label), o.description ? /* @__PURE__ */ React.createElement("span", { className: "cn-opt__desc" }, o.description) : null);
    }), /* @__PURE__ */ React.createElement("div", { className: cx("cn-opt", "cn-opt--other", editingOther && "cn-opt--on") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, editingOther ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__mark" }, typeof chosen == "string" ? glyph("misc", "radio_on") : glyph("misc", "radio_off")), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__key" }, "o"), editingOther ? /* @__PURE__ */ React.createElement("span", { className: "cn-input cn-input--inline" }, /* @__PURE__ */ React.createElement("span", null, otherText), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" })) : /* @__PURE__ */ React.createElement("span", { className: "cn-opt__label cn-dim" }, "Other…"))), /* @__PURE__ */ React.createElement("div", { className: "cn-card__foot" }, state === "readonly" ? /* @__PURE__ */ React.createElement("span", { className: "cn-kind--external" }, glyph("kind", "external"), " external session · answer it in its terminal, or ", /* @__PURE__ */ React.createElement("b", null, "A"), " adopt to answer here") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(KeyHints, { keys: [[`1-${q.options.length}`, q.multiSelect ? "toggle" : "pick"], ["o", "other"], ...questions.length > 1 ? [["tab", "next"]] : [], ["esc", "later"]] }), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("button", { className: "cn-btn cn-btn--primary" }, "Submit ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "enter")))));
  }
  function PermissionPrompt(p) {
    var _a2, _b;
    let h = (_a2 = p.highlighted) != null ? _a2 : 0, opts = [
      ["y", "Allow once", null],
      ["a", "Allow and remember", /* @__PURE__ */ React.createElement("code", { className: "cn-rule" }, p.rule)],
      ["e", "Allow with changes…", null],
      ["n", "Deny, and say why…", null]
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "cn-card cn-card--permission", role: "group", "aria-label": `${p.tool} wants to ${p.verb}` }, /* @__PURE__ */ React.createElement("div", { className: "cn-card__head" }, /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--waiting" }, glyph("status", "waiting"), " ", p.tool), /* @__PURE__ */ React.createElement("span", null, "wants to ", p.verb), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), p.session ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, p.session) : null), /* @__PURE__ */ React.createElement("div", { className: "cn-perm__subject" }, p.diff ? /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, p.subject) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "$ "), /* @__PURE__ */ React.createElement("b", null, p.subject))), p.diff ? /* @__PURE__ */ React.createElement("pre", { className: "cn-diff" }, p.diff.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: l.startsWith("+") ? "cn-diff__add" : l.startsWith("-") ? "cn-diff__del" : "cn-dim" }, l))) : null, p.cwd ? /* @__PURE__ */ React.createElement("div", { className: "cn-dim" }, "in ", p.cwd) : null, (_b = p.risks) == null ? void 0 : _b.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: r.level === "critical" ? "cn-risk cn-risk--critical" : "cn-risk cn-level--warning" }, r.level === "critical" ? /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--critical" }, glyph("alert", "critical"), " ", r.text) : /* @__PURE__ */ React.createElement(React.Fragment, null, glyph("alert", "warning"), " ", r.text))), /* @__PURE__ */ React.createElement("div", { className: "cn-opts", role: "radiogroup" }, opts.map(([key, text, extra], i) => /* @__PURE__ */ React.createElement("div", { key, role: "radio", "aria-checked": i === h, className: cx("cn-opt", i === h && "cn-opt--on", i === 3 && "cn-opt--deny") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, i === h ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__key" }, i + 1), /* @__PURE__ */ React.createElement("span", { className: "cn-opt__label" }, text), extra ? /* @__PURE__ */ React.createElement("span", { className: "cn-opt__desc" }, extra) : null, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-keys__key" }, key)))), p.editing ? /* @__PURE__ */ React.createElement("div", { className: "cn-input" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, p.editing.kind === "changes" ? "$ " : "why: "), /* @__PURE__ */ React.createElement("span", null, p.editing.value), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" })) : null, /* @__PURE__ */ React.createElement("div", { className: "cn-card__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["y", "allow"], ["a", "always"], ["e", "edit"], ["n", "deny"], ["esc", "later"]] })));
  }

  // ../ds/project/components/src/manage.tsx
  var MODES = ["default", "plan", "acceptEdits", "auto", "bypassPermissions", "dontAsk"], MODE_NOTE = {
    default: "asks before edits and commands",
    plan: "reads only until you approve a plan",
    acceptEdits: "edits files without asking",
    auto: "a classifier approves most actions",
    bypassPermissions: "nothing is checked",
    dontAsk: "never asks; denies what is not pre-approved"
  };
  function SessionLauncher(p) {
    var _a2, _b, _c;
    let bypass = p.mode === "bypassPermissions", base = (_a2 = p.folder.split("/").filter(Boolean).pop()) != null ? _a2 : "", confirmed = !bypass || p.bypassConfirm === base, field = (id, lbl, body) => /* @__PURE__ */ React.createElement("div", { className: cx("cn-field", p.focus === id && "cn-field--focused") }, /* @__PURE__ */ React.createElement("span", { className: "cn-field__label" }, lbl), /* @__PURE__ */ React.createElement("div", { className: "cn-field__body" }, body));
    return /* @__PURE__ */ React.createElement("div", { className: cx("cn-dialog", bypass && "cn-dialog--danger"), role: "dialog", "aria-label": "new session" }, /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__title" }, /* @__PURE__ */ React.createElement("b", null, "new session"), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "managed ", glyph("kind", "managed"))), field("folder", "folder", /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "cn-input" }, /* @__PURE__ */ React.createElement("span", null, p.folder), p.focus === "folder" ? /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }) : null), (_b = p.recent) != null && _b.length ? /* @__PURE__ */ React.createElement("div", { className: "cn-recent" }, p.recent.map((r) => /* @__PURE__ */ React.createElement("span", { key: r, className: "cn-tag" }, r))) : null, p.error ? /* @__PURE__ */ React.createElement("div", { className: "cn-status--error" }, glyph("status", "error"), " ", p.error) : null)), field("name", "name", /* @__PURE__ */ React.createElement("span", { className: "cn-input" }, /* @__PURE__ */ React.createElement("span", null, p.name), p.focus === "name" ? /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }) : null)), field("model", "model", /* @__PURE__ */ React.createElement("span", { className: "cn-seg" }, p.models.map((m) => /* @__PURE__ */ React.createElement("span", { key: m, className: cx("cn-seg__opt", m === p.model && "cn-seg__opt--on") }, m === p.model ? glyph("misc", "radio_on") : glyph("misc", "radio_off"), " ", m)))), field("mode", "mode", /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "cn-seg" }, MODES.map((m) => /* @__PURE__ */ React.createElement("span", { key: m, className: cx("cn-seg__opt", m === p.mode && "cn-seg__opt--on") }, /* @__PURE__ */ React.createElement(ModeBadge, { mode: m })))), /* @__PURE__ */ React.createElement("div", { className: "cn-dim" }, MODE_NOTE[p.mode]), bypass ? /* @__PURE__ */ React.createElement("div", { className: "cn-risk cn-risk--critical" }, /* @__PURE__ */ React.createElement("span", { className: "cn-chip cn-chip--critical" }, glyph("alert", "critical"), " bypass"), " every tool runs unchecked in ", /* @__PURE__ */ React.createElement("b", null, p.folder), ". Type ", /* @__PURE__ */ React.createElement("b", null, base), " to confirm:", " ", /* @__PURE__ */ React.createElement("span", { className: "cn-input cn-input--inline" }, /* @__PURE__ */ React.createElement("span", null, (_c = p.bypassConfirm) != null ? _c : ""), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }))) : null)), field("prompt", "prompt", /* @__PURE__ */ React.createElement("span", { className: "cn-input cn-input--multi" }, p.prompt ? /* @__PURE__ */ React.createElement("span", null, p.prompt) : /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__ph" }, "optional first prompt…"))), /* @__PURE__ */ React.createElement("div", { className: "cn-field" }, /* @__PURE__ */ React.createElement("span", { className: "cn-field__label" }, "open in"), /* @__PURE__ */ React.createElement("div", { className: "cn-field__body" }, /* @__PURE__ */ React.createElement("span", { className: "cn-seg" }, /* @__PURE__ */ React.createElement("span", { className: cx("cn-seg__opt", p.openIn !== "window" && "cn-seg__opt--on") }, p.openIn !== "window" ? glyph("misc", "radio_on") : glyph("misc", "radio_off"), " new pane"), /* @__PURE__ */ React.createElement("span", { className: cx("cn-seg__opt", p.openIn === "window" && "cn-seg__opt--on") }, p.openIn === "window" ? glyph("misc", "radio_on") : glyph("misc", "radio_off"), " new window")))), /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["tab", "next field"], ["←→", "choose"]] }), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("button", { className: "cn-btn" }, "Cancel ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "esc")), /* @__PURE__ */ React.createElement("button", { className: cx("cn-btn", bypass ? "cn-btn--danger" : "cn-btn--primary"), disabled: !confirmed, "aria-disabled": !confirmed }, "Start ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "enter"))));
  }
  function ConfirmStop({ name, kind = "managed", waiting, subagents, unsaved }) {
    return /* @__PURE__ */ React.createElement("div", { className: "cn-dialog cn-dialog--danger cn-dialog--small", role: "alertdialog", "aria-label": `stop ${name}?` }, /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__title" }, /* @__PURE__ */ React.createElement("span", { className: "cn-status--error" }, glyph("status", "stopped")), " ", /* @__PURE__ */ React.createElement("b", null, "stop ", name, "?")), /* @__PURE__ */ React.createElement("div", null, "The process ends", kind === "managed" ? "" : " (it was started elsewhere)", ". Its transcript stays: ", /* @__PURE__ */ React.createElement("b", null, "/resume"), " brings it back."), waiting ? /* @__PURE__ */ React.createElement("div", { className: "cn-status--waiting" }, glyph("status", "waiting"), " it is waiting on ", waiting, " question", waiting > 1 ? "s" : "", "; they will go unanswered") : null, subagents ? /* @__PURE__ */ React.createElement("div", { className: "cn-msg--subagent" }, glyph("message", "subagent_started"), " ", subagents, " subagent", subagents > 1 ? "s" : "", " running will stop too") : null, unsaved ? /* @__PURE__ */ React.createElement("div", { className: "cn-level--warning" }, glyph("alert", "warning"), " ", unsaved) : null, /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__foot" }, /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("button", { className: "cn-btn" }, "Cancel ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "esc")), /* @__PURE__ */ React.createElement("button", { className: "cn-btn cn-btn--danger" }, "Stop ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "&"))));
  }
  function BroadcastPrompt({ targets, prompt, cursor = 0 }) {
    let n = targets.filter((t) => t.selected).length, last = "";
    return /* @__PURE__ */ React.createElement("div", { className: "cn-dialog cn-dialog--broadcast", role: "dialog", "aria-label": "send to several sessions" }, /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__title" }, /* @__PURE__ */ React.createElement("span", { className: "cn-msg--sent" }, glyph("message", "sent")), " ", /* @__PURE__ */ React.createElement("b", null, "send to several sessions"), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("span", { className: "cn-msg--sent" }, n, " selected")), /* @__PURE__ */ React.createElement("div", { className: "cn-targets", role: "listbox", "aria-multiselectable": "true" }, targets.map((t, i) => {
      var _a2;
      let head = t.project !== last ? (last = t.project, /* @__PURE__ */ React.createElement("div", { key: "h" + t.project, className: "cn-targets__proj" }, /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, glyph("message", "project")), " ", /* @__PURE__ */ React.createElement("b", null, t.project), " ", /* @__PURE__ */ React.createElement("span", { className: "cn-dim" }, "· p select project"))) : null;
      return /* @__PURE__ */ React.createElement(React.Fragment, { key: t.n }, head, /* @__PURE__ */ React.createElement("div", { role: "option", "aria-selected": t.selected, className: cx("cn-target", i === cursor && "cn-target--on", t.selected && "cn-target--picked") }, /* @__PURE__ */ React.createElement("span", { className: "cn-row__bar" }, i === cursor ? glyph("tree", "cursor") : " "), /* @__PURE__ */ React.createElement("span", { className: "cn-target__check" }, t.selected ? glyph("misc", "check_on") : glyph("misc", "check_off")), /* @__PURE__ */ React.createElement(KindMark, { kind: t.kind }), /* @__PURE__ */ React.createElement("span", { className: "cn-target__name" }, t.name), /* @__PURE__ */ React.createElement("span", { className: "cn-target__status" }, /* @__PURE__ */ React.createElement(StatusBadge, { status: t.status })), /* @__PURE__ */ React.createElement("span", { className: "cn-dim cn-ellipsis" }, (_a2 = t.note) != null ? _a2 : "")));
    })), /* @__PURE__ */ React.createElement("div", { className: "cn-prompt cn-prompt--broadcast cn-prompt--focused" }, /* @__PURE__ */ React.createElement("div", { className: "cn-prompt__line" }, /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__marker" }, glyph("message", "prompt")), /* @__PURE__ */ React.createElement("span", { className: "cn-prompt__value" }, prompt), /* @__PURE__ */ React.createElement("span", { className: "cn-caret" }))), /* @__PURE__ */ React.createElement("div", { className: "cn-dialog__foot" }, /* @__PURE__ */ React.createElement(KeyHints, { keys: [["space", "pick"], ["p", "project"], ["*", "all idle"]] }), /* @__PURE__ */ React.createElement("span", { className: "cn-fill" }), /* @__PURE__ */ React.createElement("button", { className: "cn-btn" }, "Cancel ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "esc")), /* @__PURE__ */ React.createElement("button", { className: "cn-btn cn-btn--broadcast", disabled: !n }, "Send to ", n, " ", /* @__PURE__ */ React.createElement("span", { className: "cn-btn__key" }, "C-enter"))));
  }

  // ../ds/project/components/src/term.tsx
  var FILL_ON = {
    "status-waiting-fill": "on-status-waiting-fill",
    "mode-auto": "on-mode-auto",
    "mode-bypass": "on-mode-bypass",
    "res-critical-fill": "on-res-critical-fill",
    "fill-brand": "on-fill-brand"
  };
  function styleFor(tag) {
    var _a2;
    let s = {}, color, reverse = !1;
    for (let part of tag.trim().split(/\s+/))
      if (part)
        if (part === "b") s.fontWeight = 700;
        else if (part === "i") s.fontStyle = "italic";
        else if (part === "u") s.textDecoration = "underline";
        else if (part === "d")
          color ? s.opacity = 0.75 : color = "var(--fg-muted)";
        else if (part === "r") reverse = !0;
        else if (part.startsWith("on:")) s.background = `var(--${part.slice(3)})`;
        else if (part.startsWith("chip:")) {
          let fill = part.slice(5);
          s.background = `var(--${fill})`, color = `var(--${(_a2 = FILL_ON[fill]) != null ? _a2 : "bg"})`, s.fontWeight = 700;
        } else color = `var(--${part})`;
    return reverse ? (s.background = color != null ? color : "var(--fg)", s.color = "var(--bg)") : color && (s.color = color), s;
  }
  function parseMarkup(line) {
    let out = [], style = {}, buf = "";
    for (let i = 0; i < line.length; i++) {
      let ch = line[i];
      if (ch === "\\" && line[i + 1] === "[") {
        buf += "[", i++;
        continue;
      }
      if (ch === "[") {
        let end = line.indexOf("]", i);
        if (end > i) {
          let tag = line.slice(i + 1, end);
          buf && out.push({ text: buf, style }), buf = "", style = tag === "/" ? {} : styleFor(tag), i = end;
          continue;
        }
      }
      buf += ch;
    }
    return buf && out.push({ text: buf, style }), out;
  }
  function TuiFrame({ lines, title, cols: cols2, className }) {
    return /* @__PURE__ */ React.createElement("figure", { className: cx("cn-tui", className), "aria-label": title ? `Terminal: ${title}` : "Terminal view" }, title ? /* @__PURE__ */ React.createElement("figcaption", { className: "cn-tui__title" }, title) : null, /* @__PURE__ */ React.createElement("pre", { className: "cn-tui__screen", style: cols2 ? { width: `${cols2}ch` } : void 0 }, lines.map((line, i) => /* @__PURE__ */ React.createElement("div", { className: "cn-tui__line", key: i }, parseMarkup(line).map((seg, j) => /* @__PURE__ */ React.createElement("span", { key: j, style: seg.style }, seg.text)), line.length === 0 ? " " : null))));
  }
  function vlen(markup) {
    return parseMarkup(markup).reduce((n, s) => n + Array.from(s.text).length, 0);
  }
  function pad(markup, width) {
    return markup + " ".repeat(Math.max(0, width - vlen(markup)));
  }
  function cols(cells) {
    return cells.map(([m, w]) => pad(m, w)).join("");
  }
  var BORDERS = {
    solid: ["┌", "─", "┐", "│", "└", "┘"],
    heavy: ["┏", "━", "┓", "┃", "┗", "┛"],
    round: ["╭", "─", "╮", "│", "╰", "╯"],
    dashed: ["┏", "╍", "┓", "╏", "┗", "┛"],
    double: ["╔", "═", "╗", "║", "╚", "╝"]
  };
  function box(o) {
    var _a2, _b, _c, _d;
    let [tl, h, tr, v, bl, br] = BORDERS[(_a2 = o.kind) != null ? _a2 : "round"], tok = (_b = o.border) != null ? _b : "line-strong", b = (s) => s ? `[${tok}]${s}[/]` : "", inner = o.width - 2, padX = (_c = o.pad) != null ? _c : 1, edge = (left, right, label2, align = "left") => {
      if (!label2) return b(left + h.repeat(inner) + right);
      let lab = ` ${label2} `, rest = Math.max(0, inner - 1 - vlen(lab));
      return align === "left" ? b(left + h) + lab + b(h.repeat(rest) + right) : b(left + h.repeat(rest)) + lab + b(h + right);
    }, body = o.lines.map((l) => b(v) + " ".repeat(padX) + pad(l, inner - 2 * padX) + " ".repeat(padX) + b(v));
    return [edge(tl, tr, o.title), ...body, edge(bl, br, o.footer, (_d = o.footerAlign) != null ? _d : "left")];
  }
  var tui = { vlen, pad, cols, box };

  // ../ds/project/components/src/index.tsx
  var Constellation = {
    // map
    SessionNode,
    SubagentNode,
    MessageEdge,
    ProjectGroup,
    // tree
    TreeRow,
    TreeFilter,
    // panes
    Pane,
    MessageRow,
    PromptBox,
    StatusLine,
    StatusBar,
    // commands
    CommandMenu,
    ModelPicker,
    ResumePicker,
    // answering
    QuestionCard,
    PermissionPrompt,
    // resources
    ContextBar,
    Sparkline,
    // managing
    SessionLauncher,
    ConfirmStop,
    BroadcastPrompt,
    // atoms
    StatusBadge,
    ModeBadge,
    KindMark,
    Kbd,
    KeyHints,
    WhichKey,
    Spinner,
    MsgGlyph,
    AlertFlag,
    TuiFrame,
    // helpers
    GLYPHS,
    glyph,
    label,
    sparkText,
    edgeTier,
    parseMarkup,
    tui
  }, _a;
  window.Constellation = Object.assign((_a = window.Constellation) != null ? _a : {}, Constellation);
  var index_default = Constellation;
})();
