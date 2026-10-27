// Constellation web components — types as documentation. window.Constellation, React 18.
import type * as React from 'react';

export type Status = 'working' | 'waiting' | 'idle' | 'stale' | 'error' | 'stopped';
export type Mode = 'default' | 'plan' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'dontAsk';
export type Kind = 'managed' | 'external';
export type Level = 'normal' | 'warning' | 'critical';
export type MsgType = 'prompt' | 'slash' | 'tool' | 'question' | 'answer' | 'denied' | 'sent' | 'received' | 'subagent_started' | 'subagent_reported' | 'reply';

/* ── Map ─────────────────────────────────────────────────────────────── */
export interface Subagent { name: string; status: 'working' | 'reported'; tools?: number }
export interface SessionNodeProps {
  name: string; project: string; branch: string; mode: Mode; status: Status; kind?: Kind;
  /** Time since last activity: "12s", "3h". */ ago: string;
  /** The task it was given. */ task: string;
  /** Latest step: "Edit src/limits/route.ts". */ step: string;
  /** Model-written one-liner, only after you ask (s). */ summary?: string;
  ctx?: number; cpu?: number[]; alert?: { level: Level; label: string }; subagents?: Subagent[];
  index?: number; focused?: boolean; selected?: boolean; disabled?: boolean; compact?: boolean;
}
export declare function SessionNode(props: SessionNodeProps): React.ReactElement;
export declare function SubagentNode(props: Subagent): React.ReactElement;
export declare function ProjectGroup(props: { name: string; count: number; waiting?: number; children?: React.ReactNode; style?: React.CSSProperties }): React.ReactElement;

export interface MessageEdgeProps {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  /** 1–2 light, 3–9 heavy, 10+ double. */ count: number;
  kind?: 'peer' | 'subagent'; selected?: boolean; /** A message is in flight. */ live?: boolean; id?: string;
}
/** Returns an SVG <g>; use as a React Flow custom edge. */
export declare function MessageEdge(props: MessageEdgeProps): React.ReactElement;

/* ── Tree ────────────────────────────────────────────────────────────── */
export interface TreeRowProps {
  kind: 'project' | 'session' | MsgType; label: React.ReactNode; meta?: React.ReactNode;
  guides?: boolean[]; last?: boolean; depth?: number; expanded?: boolean; hasChildren?: boolean;
  turn?: number; status?: Status; sessionKind?: Kind;
  cursor?: boolean; match?: boolean; dimmed?: boolean; attention?: boolean; onActivate?: () => void;
}
export declare function TreeRow(props: TreeRowProps): React.ReactElement;
export interface FilterChip { type: MsgType | 'peer' | 'subagent'; count: number; on: boolean }
export declare function TreeFilter(props: { chips: FilterChip[]; query?: string }): React.ReactElement;

/* ── Panes ───────────────────────────────────────────────────────────── */
export interface Message { type: MsgType; text: React.ReactNode; detail?: React.ReactNode; body?: React.ReactNode }
export interface StatusLineProps { model: string; branch: string; ctx: number; mode: Mode; cost?: string; mcp?: { up: number; down: number } }
export interface PromptBoxProps {
  value?: string; placeholder?: string; focused?: boolean; running?: boolean; external?: boolean;
  /** Broadcasting to n sessions. */ broadcast?: number; images?: Array<{ name: string; size: string }>; disabled?: boolean;
}
export interface PaneProps {
  index: number; name: string; project: string; kind?: Kind; status: Status; ago?: string;
  focused?: boolean; zoomed?: boolean; /** Inline rename value. */ renaming?: string;
  messages: Message[]; /** Question card, permission prompt or / menu above the prompt. */ dock?: React.ReactNode;
  activity?: string; prompt?: PromptBoxProps; status_line: StatusLineProps; height?: number;
}
export declare function Pane(props: PaneProps): React.ReactElement;
export declare function MessageRow(props: Message): React.ReactElement;
export declare function PromptBox(props: PromptBoxProps): React.ReactElement;
export declare function StatusLine(props: StatusLineProps): React.ReactElement;

export interface BarSession { n: number; name: string; status: Status; current?: boolean; zoomed?: boolean }
export interface StatusBarProps {
  windows: Array<{ n: number; name: string; active?: boolean }>; sessions: BarSession[];
  /** The prefix key is armed. */ prefix?: boolean; cost?: string; clock?: string; warnings?: number;
  /** Letters kept per non-waiting name. */ maxName?: number; /** Non-waiting sessions shown before "+n". */ limit?: number;
}
export declare function StatusBar(props: StatusBarProps): React.ReactElement;

/* ── Commands ────────────────────────────────────────────────────────── */
export interface Command { name: string; source: 'built-in' | 'skill' | 'command' | 'mcp' | 'plugin'; description: string; args?: string; unavailable?: string }
export interface CommandMenuProps { query: string; commands: Command[]; highlighted?: number; total?: number }
export declare function CommandMenu(props: CommandMenuProps): React.ReactElement;

export interface ModelOption { id: string; name: string; note: string; context?: string; current?: boolean }
export type Effort = 'low' | 'medium' | 'high' | 'max';
export interface ModelPickerProps { models: ModelOption[]; highlighted?: number; effort?: Effort; efforts?: Effort[]; focusEffort?: boolean }
export declare function ModelPicker(props: ModelPickerProps): React.ReactElement;
export interface PastSession { id: string; name: string; project: string; when: string; turns: number; preview: string[]; tag?: string }
export declare function ResumePicker(props: { sessions: PastSession[]; highlighted?: number; query?: string }): React.ReactElement;

/* ── Answering ───────────────────────────────────────────────────────── */
export interface QOption { label: string; description?: string }
export interface Question { header: string; question: string; options: QOption[]; multiSelect?: boolean }
export interface QuestionCardProps {
  session?: string; /** 1–4 */ questions: Question[]; current?: number;
  answers?: Array<number[] | string | null>; highlighted?: number; otherText?: string; editingOther?: boolean;
  state?: 'open' | 'answered' | 'readonly';
}
export declare function QuestionCard(props: QuestionCardProps): React.ReactElement;

export interface PermissionPromptProps {
  session?: string; tool: string; verb: string; subject: string; cwd?: string; diff?: string[];
  risks?: Array<{ level: 'warning' | 'critical'; text: string }>; /** The rule "remember" saves. */ rule: string;
  highlighted?: 0 | 1 | 2 | 3; editing?: { kind: 'changes' | 'reason'; value: string };
}
export declare function PermissionPrompt(props: PermissionPromptProps): React.ReactElement;

/* ── Resources ───────────────────────────────────────────────────────── */
export interface ContextSlice { label: string; tokens: number; tone: 'system' | 'tools' | 'mcp' | 'memory' | 'messages' }
export interface ContextBarProps { value: number; max?: number; compactAt?: number; slices?: ContextSlice[]; showLabel?: boolean; cells?: number }
export declare function ContextBar(props: ContextBarProps): React.ReactElement;
export interface SparklineProps { values: number[]; label: string; current?: string; warn?: number; crit?: number; max?: number; unit?: string }
export declare function Sparkline(props: SparklineProps): React.ReactElement;

/* ── Managing sessions ───────────────────────────────────────────────── */
export interface SessionLauncherProps {
  folder: string; recent?: string[]; name: string; models: string[]; model: string; mode: Mode; prompt?: string;
  openIn?: 'pane' | 'window'; focus?: 'folder' | 'name' | 'model' | 'mode' | 'prompt';
  /** Bypass needs the folder name typed back. */ bypassConfirm?: string; error?: string;
}
export declare function SessionLauncher(props: SessionLauncherProps): React.ReactElement;
export declare function ConfirmStop(props: { name: string; kind?: Kind; waiting?: number; subagents?: number; unsaved?: string }): React.ReactElement;
export interface Target { n: number; name: string; project: string; kind: Kind; status: Status; selected: boolean; note?: string }
export interface BroadcastPromptProps { targets: Target[]; prompt: string; cursor?: number }
export declare function BroadcastPrompt(props: BroadcastPromptProps): React.ReactElement;

/* ── Atoms ───────────────────────────────────────────────────────────── */
export interface StatusBadgeProps { status: Status; compact?: boolean; /** For stale: "3h". */ age?: string }
export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;
export interface ModeBadgeProps { mode: Mode; compact?: boolean }
export declare function ModeBadge(props: ModeBadgeProps): React.ReactElement;
export declare function KindMark(props: { kind: Kind }): React.ReactElement;
export interface KbdProps { children: React.ReactNode }
export declare function Kbd(props: KbdProps): React.ReactElement;
export declare function KeyHints(props: { keys: Array<[string, string]>; prefix?: string }): React.ReactElement;
export declare function WhichKey(props: { prefix?: string; groups: Array<{ title: string; keys: Array<[string, string]> }> }): React.ReactElement;
export declare function Spinner(): React.ReactElement;
export declare function MsgGlyph(props: { type: MsgType }): React.ReactElement;
export declare function AlertFlag(props: { level: Level; label: string }): React.ReactElement | null;
export interface TuiFrameProps { lines: string[]; title?: string; cols?: number; className?: string }
export declare function TuiFrame(props: TuiFrameProps): React.ReactElement;

/* ── Helpers ─────────────────────────────────────────────────────────── */
export declare const GLYPHS: Record<string, any>;
export declare function glyph(category: string, name: string): string;
export declare function label(category: string, name: string): string;
export declare function sparkText(values: number[], max?: number): string;
export declare function edgeTier(count: number): 1 | 2 | 3;
export declare const tui: {
  vlen(markup: string): number;
  pad(markup: string, width: number): string;
  cols(cells: Array<[string, number]>): string;
  box(o: { width: number; lines: string[]; title?: string; footer?: string; footerAlign?: 'left' | 'right'; border?: string; kind?: 'solid' | 'heavy' | 'round' | 'dashed' | 'double'; pad?: number }): string[];
};

declare global {
  interface Window {
    Constellation: {
      SessionNode: typeof SessionNode; SubagentNode: typeof SubagentNode; MessageEdge: typeof MessageEdge; ProjectGroup: typeof ProjectGroup;
      TreeRow: typeof TreeRow; TreeFilter: typeof TreeFilter;
      Pane: typeof Pane; MessageRow: typeof MessageRow; PromptBox: typeof PromptBox; StatusLine: typeof StatusLine; StatusBar: typeof StatusBar;
      CommandMenu: typeof CommandMenu; ModelPicker: typeof ModelPicker; ResumePicker: typeof ResumePicker;
      QuestionCard: typeof QuestionCard; PermissionPrompt: typeof PermissionPrompt;
      ContextBar: typeof ContextBar; Sparkline: typeof Sparkline;
      SessionLauncher: typeof SessionLauncher; ConfirmStop: typeof ConfirmStop; BroadcastPrompt: typeof BroadcastPrompt;
      StatusBadge: typeof StatusBadge; ModeBadge: typeof ModeBadge; KindMark: typeof KindMark; Kbd: typeof Kbd; KeyHints: typeof KeyHints;
      WhichKey: typeof WhichKey; Spinner: typeof Spinner; MsgGlyph: typeof MsgGlyph; AlertFlag: typeof AlertFlag; TuiFrame: typeof TuiFrame;
      GLYPHS: typeof GLYPHS; glyph: typeof glyph; label: typeof label; sparkText: typeof sparkText; edgeTier: typeof edgeTier; tui: typeof tui;
    };
  }
}
