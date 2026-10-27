// The design system's components as named exports. Its entry (components/src/index.tsx) exports one object,
// the same one it puts on window.Constellation; its types come from components/index.d.ts.
import Constellation from '@ds-src';
import type * as Types from '@ds-types';

const ds = Constellation as typeof Types;

export const {
  SessionNode, SubagentNode, MessageEdge, ProjectGroup,
  TreeRow, TreeFilter,
  Pane, MessageRow, PromptBox, StatusLine, StatusBar,
  CommandMenu, ModelPicker, ResumePicker,
  QuestionCard, PermissionPrompt,
  ContextBar, Sparkline,
  SessionLauncher, ConfirmStop, BroadcastPrompt,
  StatusBadge, ModeBadge, KindMark, Kbd, KeyHints, WhichKey, Spinner, MsgGlyph, AlertFlag, TuiFrame,
  GLYPHS, glyph, label, sparkText, edgeTier, tui,
} = ds;

export type * from '@ds-types';
