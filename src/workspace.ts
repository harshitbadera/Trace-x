import type { Analysis, CaseData } from '../shared/types';
export type View =
  | 'overview'
  | 'statements'
  | 'trail'
  | 'accounts'
  | 'intelligence'
  | 'connections'
  | 'evidence'
  | 'reports'
  | 'settings';
export type Selection = { kind: 'account' | 'transaction' | 'evidence'; id: string } | null;
export type WorkspaceProps = {
  c: CaseData;
  analysis: Analysis;
  allCases: CaseData[];
  refresh: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
  navigate: (view: View) => void;
  inspect: (selection: Selection) => void;
  selectCase: (id: string) => void;
};
