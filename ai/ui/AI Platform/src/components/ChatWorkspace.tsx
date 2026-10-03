import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Search,
  Layers,
  GitBranch,
  Code2,
  Menu,
  CheckCircle2,
  AlertCircle,
  Settings,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, AgentType, Project } from '@/lib/types';
import { AGENT_LABELS, AGENT_COLORS, STAGE_LABELS } from '@/lib/types';

interface ChatWorkspaceProps {
  messages: Message[];
  project: Project | null;
  onSend: (text: string) => void;
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
  isProcessing: boolean;
  checkpointPrompt: string | null;
  onApprove: () => void;
  llmConfigured: boolean;
}

const agentIcons: Record<AgentType, typeof Sparkles> = {
  human: Sparkles,
  codex: Sparkles,
  requirements: Search,
  pm: Layers,
  architect: GitBranch,
  uiux: Code2,
};

export function ChatWorkspace({
  messages,
  project,
  onSend,
  onOpenSidebar,
  onOpenSettings,
  isProcessing,
  checkpointPrompt,
  onApprove,
  llmConfigured,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    onSend(input);
    setInput('');
  };

  const isApprove = input.trim().toLowerCase() === 'approve';

  return (
    <div className="flex h-full flex-col bg-ink-950">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">
              {project?.name ?? 'New Project'}
            </h1>
            {project && (
              <p className="text-xs text-ink-500">
                Stage: {STAGE_LABELS[project.current_stage]}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!llmConfigured && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 transition hover:bg-amber-500/20"
            >
              <AlertCircle className="h-3 w-3 text-amber-400" />
              <span className="text-xs text-amber-300">Start Codex runner</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-ink-800 bg-ink-900 px-3 py-1">
            <span className={`flex h-2 w-2 rounded-full ${llmConfigured ? 'bg-accent-400' : 'bg-amber-400'}`} />
            <span className="text-xs text-ink-300">{llmConfigured ? 'Codex ready' : 'Codex offline'}</span>
          </div>
          <button
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-white"
            title="Codex setup"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/20">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="mt-6 font-display text-2xl font-bold text-white">
                Welcome to AgentForge
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink-400">
                Describe your product idea below. The agents use your local Codex CLI to create a PRD, epics, architecture, and UI component.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg) => {
              const Icon = agentIcons[msg.agent_type] ?? Sparkles;
              const colors = AGENT_COLORS[msg.agent_type];
              const isHuman = msg.agent_type === 'human';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isHuman ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${colors.bg} ring-1 ${colors.ring}`}
                  >
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                  </div>
                  <div className={`flex-1 ${isHuman ? 'flex flex-col items-end' : ''}`}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`text-xs font-semibold ${colors.text}`}>
                        {AGENT_LABELS[msg.agent_type]}
                      </span>
                      <span className="text-[10px] text-ink-600">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`inline-block rounded-2xl px-4 py-3 ${
                        isHuman
                          ? 'bg-brand-600 text-white'
                          : 'border border-ink-800 bg-ink-900 text-ink-200'
                      }`}
                    >
                      {isHuman ? (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="[&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-100 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-300 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:text-sm [&_li]:text-ink-300 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-ink-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-brand-300 [&_strong]:text-white [&_table]:w-full [&_th]:border [&_th]:border-ink-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-ink-200 [&_td]:border [&_td]:border-ink-700 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_td]:text-ink-400">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/40">
                  <Sparkles className="h-4 w-4 animate-pulse text-brand-300" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-500" />
                </div>
              </div>
            )}

            {/* Checkpoint prompt */}
            {checkpointPrompt && !isProcessing && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-300">
                      Human-in-the-Loop Checkpoint
                    </p>
                    <p className="mt-1 text-sm text-ink-300">{checkpointPrompt}</p>
                    <button
                      onClick={onApprove}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve & Continue
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-ink-800 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 transition focus-within:border-brand-500/50">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={
                checkpointPrompt
                  ? 'Type "approve" or provide feedback...'
                  : 'Describe your product idea or problem statement...'
              }
              disabled={isProcessing}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-ink-500 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition ${
              isApprove
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            } disabled:cursor-not-allowed disabled:opacity-30`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
