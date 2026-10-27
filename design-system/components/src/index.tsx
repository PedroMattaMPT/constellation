import { AlertFlag, Kbd, KeyHints, KindMark, ModeBadge, MsgGlyph, Spinner, StatusBadge, WhichKey, glyph, label } from './atoms';
import { MessageEdge, ProjectGroup, SessionNode, SubagentNode, edgeTier } from './map';
import { TreeFilter, TreeRow } from './tree';
import { MessageRow, Pane, PromptBox, StatusBar, StatusLine } from './pane';
import { CommandMenu, ModelPicker, ResumePicker } from './menus';
import { PermissionPrompt, QuestionCard } from './answer';
import { ContextBar, Sparkline, sparkText } from './meters';
import { BroadcastPrompt, ConfirmStop, SessionLauncher } from './manage';
import { TuiFrame, parseMarkup, tui } from './term';
import { GLYPHS } from './glyphs';

const Constellation = {
  // map
  SessionNode, SubagentNode, MessageEdge, ProjectGroup,
  // tree
  TreeRow, TreeFilter,
  // panes
  Pane, MessageRow, PromptBox, StatusLine, StatusBar,
  // commands
  CommandMenu, ModelPicker, ResumePicker,
  // answering
  QuestionCard, PermissionPrompt,
  // resources
  ContextBar, Sparkline,
  // managing
  SessionLauncher, ConfirmStop, BroadcastPrompt,
  // atoms
  StatusBadge, ModeBadge, KindMark, Kbd, KeyHints, WhichKey, Spinner, MsgGlyph, AlertFlag, TuiFrame,
  // helpers
  GLYPHS, glyph, label, sparkText, edgeTier, parseMarkup, tui,
};

(window as any).Constellation = Object.assign((window as any).Constellation ?? {}, Constellation);
export default Constellation;
