import { useState } from 'react';
import {
  Search,
  FileText,
  Layers,
  GitBranch,
  Code2,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  X,
  Settings,
  AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidRenderer } from './MermaidRenderer';
import type { Project, PRD, Epic, Diagram, UIComponent, ProjectStage } from '@/lib/types';
import { STAGE_LABELS, STAGE_ORDER } from '@/lib/types';

type SidebarTab = 'overview' | 'prd' | 'epics' | 'dfd' | 'components';

interface SidebarProps {
  project: Project | null;
  prd: PRD | null;
  epics: Epic[];
  diagrams: Diagram[];
  uiComponents: UIComponent[];
  taskCounts: Record<string, number>;
  onNewProject: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  llmConfigured: boolean;
}

const stageIcons: Record<ProjectStage, typeof Circle> = {
  discovery: Search,
  decomposition: Layers,
  architecture: GitBranch,
  design: Code2,
  complete: CheckCircle2,
};

export function Sidebar({
  project,
  prd,
  epics,
  diagrams,
  uiComponents,
  taskCounts,
  onNewProject,
  onClose,
  onOpenSettings,
  llmConfigured,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('overview');

  const currentStageIndex = project ? STAGE_ORDER.indexOf(project.current_stage) : -1;

  const tabs: { id: SidebarTab; label: string; icon: typeof Search; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Search },
    { id: 'prd', label: 'PRD', icon: FileText, badge: prd ? 1 : 0 },
    { id: 'epics', label: 'Epics', icon: Layers, badge: epics.length },
    { id: 'dfd', label: 'DFD', icon: GitBranch, badge: diagrams.length },
    { id: 'components', label: 'Components', icon: Code2, badge: uiComponents.length },
  ];

  return (
    <aside className="flex h-full w-full flex-col bg-ink-900 border-r border-ink-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-sm font-bold text-white">AgentForge</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-white"
            title="Codex setup"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Codex runner status banner */}
      {!llmConfigured && (
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-left transition hover:bg-amber-500/10"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300">
            Codex runner offline — click for setup
          </span>
        </button>
      )}

      {/* Project name */}
      <div className="border-b border-ink-800 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Current Project</p>
        <p className="mt-1 truncate text-sm font-semibold text-white">
          {project?.name ?? 'No project selected'}
        </p>
        {project && (
          <button
            onClick={onNewProject}
            className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            + New project
          </button>
        )}
      </div>

      {/* Stage tracker */}
      <div className="border-b border-ink-800 px-4 py-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-500">
          Pipeline Stage
        </p>
        <div className="space-y-1">
          {STAGE_ORDER.map((stage, i) => {
            const Icon = stageIcons[stage];
            const isDone = currentStageIndex > i;
            const isCurrent = currentStageIndex === i;
            return (
              <div
                key={stage}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isCurrent
                    ? 'bg-brand-500/10 text-brand-300'
                    : isDone
                    ? 'text-ink-400'
                    : 'text-ink-600'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent-400" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-brand-400" />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0" />
                )}
                <Icon className={`h-3.5 w-3.5 ${isCurrent || isDone ? 'opacity-100' : 'opacity-40'}`} />
                <span className={`font-medium ${isCurrent ? 'text-white' : ''}`}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-ink-800 px-3 py-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? 'bg-ink-700 text-white'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-0.5 rounded-full bg-ink-600 px-1.5 text-[10px] text-ink-200">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Problem Statement</p>
              <p className="mt-1 text-sm text-ink-200">
                {project?.problem_statement || 'No problem statement yet.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
                <p className="text-2xl font-bold text-white">{epics.length}</p>
                <p className="text-xs text-ink-400">Epics</p>
              </div>
              <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
                <p className="text-2xl font-bold text-white">
                  {Object.values(taskCounts).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-xs text-ink-400">Tasks</p>
              </div>
              <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
                <p className="text-2xl font-bold text-white">{diagrams.length}</p>
                <p className="text-xs text-ink-400">Diagrams</p>
              </div>
              <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
                <p className="text-2xl font-bold text-white">{uiComponents.length}</p>
                <p className="text-xs text-ink-400">Components</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'prd' && (
          <div>
            {prd ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      prd.status === 'approved'
                        ? 'bg-accent-500/15 text-accent-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {prd.status === 'approved' ? 'Approved' : 'Pending Review'}
                  </span>
                </div>
                <div className="rounded-lg border border-ink-800 bg-ink-800/50 p-4 text-sm text-ink-200 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-100 [&_li]:ml-4 [&_code]:rounded [&_code]:bg-ink-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-brand-300 [&_table]:w-full [&_th]:border [&_th]:border-ink-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-ink-700 [&_td]:px-2 [&_td]:py-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {prd.content}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-ink-700" />
                <p className="mt-3 text-sm text-ink-500">
                  No PRD generated yet. Start a project to begin requirements discovery.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'epics' && (
          <div className="space-y-2">
            {epics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-10 w-10 text-ink-700" />
                <p className="mt-3 text-sm text-ink-500">
                  No epics yet. The PM Agent will generate these after PRD approval.
                </p>
              </div>
            ) : (
              epics.map((epic) => (
                <div
                  key={epic.id}
                  className="group rounded-lg border border-ink-800 bg-ink-800/50 p-3 transition hover:border-ink-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{epic.title}</p>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-ink-400" />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{epic.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-ink-300">
                      {taskCounts[epic.id] ?? 0} tasks
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        epic.status === 'done'
                          ? 'bg-accent-500/15 text-accent-400'
                          : epic.status === 'in_progress'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-ink-700 text-ink-400'
                      }`}
                    >
                      {epic.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'dfd' && (
          <div className="space-y-4">
            {diagrams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="h-10 w-10 text-ink-700" />
                <p className="mt-3 text-sm text-ink-500">
                  No diagrams yet. The AI Architect will generate DFDs after epic approval.
                </p>
              </div>
            ) : (
              diagrams.map((d) => (
                <div key={d.id} className="rounded-lg border border-ink-800 bg-ink-800/50 p-3">
                  <p className="mb-3 text-sm font-semibold text-white">{d.title}</p>
                  <MermaidRenderer chart={d.mermaid_syntax} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'components' && (
          <div className="space-y-3">
            {uiComponents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Code2 className="h-10 w-10 text-ink-700" />
                <p className="mt-3 text-sm text-ink-500">
                  No components yet. The UI/UX Co-Pilot will generate these in the design stage.
                </p>
              </div>
            ) : (
              uiComponents.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-ink-800 bg-ink-800/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{c.title}</p>
                    <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-ink-300">
                      {c.framework}
                    </span>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-ink-950 p-3 text-xs text-ink-300">
                    <code>{c.code}</code>
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
