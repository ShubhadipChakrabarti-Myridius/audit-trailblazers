export type AgentType = 'human' | 'requirements' | 'pm' | 'architect' | 'uiux' | 'codex';

export type ProjectStage = 'discovery' | 'decomposition' | 'architecture' | 'design' | 'complete';

export interface Project {
  id: string;
  name: string;
  problem_statement: string;
  current_stage: ProjectStage;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  agent_type: AgentType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PRD {
  id: string;
  project_id: string;
  content: string;
  status: 'draft' | 'pending_review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface Epic {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
}

export interface Task {
  id: string;
  epic_id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
}

export interface Diagram {
  id: string;
  project_id: string;
  title: string;
  mermaid_syntax: string;
  created_at: string;
}

export interface UIComponent {
  id: string;
  project_id: string;
  title: string;
  code: string;
  framework: string;
  created_at: string;
}

export const AGENT_LABELS: Record<AgentType, string> = {
  human: 'You',
  codex: 'Codex',
  requirements: 'Requirements Agent',
  pm: 'PM Agent',
  architect: 'AI Architect',
  uiux: 'UI/UX Co-Pilot',
};

export const AGENT_COLORS: Record<AgentType, { bg: string; text: string; ring: string; dot: string }> = {
  codex: { bg: 'bg-brand-500/15', text: 'text-brand-300', ring: 'ring-brand-500/40', dot: 'bg-brand-400' },
  human: { bg: 'bg-ink-700', text: 'text-ink-100', ring: 'ring-ink-500', dot: 'bg-ink-400' },
  requirements: { bg: 'bg-amber-500/15', text: 'text-amber-300', ring: 'ring-amber-500/40', dot: 'bg-amber-400' },
  pm: { bg: 'bg-sky-500/15', text: 'text-sky-300', ring: 'ring-sky-500/40', dot: 'bg-sky-400' },
  architect: { bg: 'bg-violet-500/15', text: 'text-violet-300', ring: 'ring-violet-500/40', dot: 'bg-violet-400' },
  uiux: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-500/40', dot: 'bg-emerald-400' },
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  discovery: 'Requirements Discovery',
  decomposition: 'Epic & Task Decomposition',
  architecture: 'Solution Architecture',
  design: 'UI/UX Design',
  complete: 'Complete',
};

export const STAGE_ORDER: ProjectStage[] = ['discovery', 'decomposition', 'architecture', 'design', 'complete'];
