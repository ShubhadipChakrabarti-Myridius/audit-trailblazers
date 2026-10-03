import { X, Key } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-brand-400" />
            <h2 className="font-display text-lg font-bold text-white">Codex setup</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white" aria-label="Close settings">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-ink-300">Sign in to the Codex CLI once, then start the local runner and Vite in separate terminals:</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-950 p-3 text-xs text-brand-300">codex login{`\n`}npm run dev:codex{`\n`}npm run dev</pre>
        <p className="mt-3 text-sm text-ink-400">All agent generation uses the local Codex runner. Supabase stores project messages and generated artifacts; it does not need an LLM API key.</p>
      </div>
    </div>
  );
}
