import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { SettingsModal } from '@/components/SettingsModal';
import { supabase } from '@/lib/supabase';
import { runCodexPipeline } from '@/lib/codexPipeline';
import type { Project, Message, PRD, Epic, Diagram, UIComponent } from '@/lib/types';

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prd, setPrd] = useState<PRD | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [uiComponents, setUiComponents] = useState<UIComponent[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkpointPrompt, setCheckpointPrompt] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codexReady, setCodexReady] = useState(false);

  useEffect(() => {
    fetch('/api/codex/health')
      .then((response) => setCodexReady(response.ok))
      .catch(() => setCodexReady(false));
  }, [settingsOpen]);

  const loadProjectData = useCallback(async (projectId: string) => {
    const [msgRes, prdRes, epicRes, diagRes, uiRes] = await Promise.all([
      supabase.from('messages').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('prds').select('*').eq('project_id', projectId).order('created_at').maybeSingle(),
      supabase.from('epics').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('diagrams').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('ui_components').select('*').eq('project_id', projectId).order('created_at'),
    ]);

    setMessages((msgRes.data ?? []) as Message[]);
    setPrd((prdRes.data as PRD) ?? null);
    setEpics((epicRes.data ?? []) as Epic[]);
    setDiagrams((diagRes.data ?? []) as Diagram[]);
    setUiComponents((uiRes.data ?? []) as UIComponent[]);

    const epicIds = (epicRes.data ?? []).map((e: Epic) => e.id);
    if (epicIds.length > 0) {
      const counts: Record<string, number> = {};
      for (const eid of epicIds) {
        const { count: c } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('epic_id', eid);
        counts[eid] = c ?? 0;
      }
      setTaskCounts(counts);
    } else {
      setTaskCounts({});
    }
  }, []);

  // Subscribe to realtime updates
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prds', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.new) setPrd(payload.new as PRD);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'epics', filter: `project_id=eq.${projectId}` }, () => {
        loadProjectData(projectId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagrams', filter: `project_id=eq.${projectId}` }, () => {
        loadProjectData(projectId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ui_components', filter: `project_id=eq.${projectId}` }, () => {
        loadProjectData(projectId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload) => {
        if (payload.new) setProject(payload.new as Project);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, loadProjectData]);

  const handleSend = async (text: string) => {
    if (isProcessing) return;

    // If no project yet, create one and start the pipeline
    if (!project) {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          name: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
          problem_statement: text,
          current_stage: 'discovery',
        })
        .select()
        .single();

      if (error || !newProject) return;
      setProject(newProject as Project);

      // Insert the human message
      await supabase.from('messages').insert({
        project_id: newProject.id,
        agent_type: 'human',
        content: text,
      });

      // Generate the PRD with the local Codex runner.
      setIsProcessing(true);
      try {
        await runCodexPipeline({
          projectId: newProject.id,
          action: 'start',
          problemStatement: text,
        });
        setCheckpointPrompt('Please review the PRD in the sidebar. Type "approve" to proceed, or provide feedback for revisions.');
      } catch (err) {
        await supabase.from('messages').insert({
          project_id: newProject.id,
          agent_type: 'requirements',
          content: `Error: ${err instanceof Error ? err.message : 'Failed to start pipeline'}`,
        });
      }
      setIsProcessing(false);
      await loadProjectData(newProject.id);
      return;
    }

    // Existing project
    const lowerText = text.trim().toLowerCase();

    // Insert human message
    await supabase.from('messages').insert({
      project_id: project.id,
      agent_type: 'human',
      content: text,
    });

    // If at a checkpoint and user approves
    if (checkpointPrompt && (lowerText === 'approve' || lowerText === 'approved')) {
      setCheckpointPrompt(null);
      setIsProcessing(true);

      if (project.current_stage === 'discovery') {
        await supabase.from('prds').update({ status: 'approved' }).eq('project_id', project.id);
      }

      try {
        const result = await runCodexPipeline({
          projectId: project.id,
          action: 'continue',
          fromStage: project.current_stage,
        });

        if (result.status === 'checkpoint') {
          setCheckpointPrompt('Review the new artifacts in the sidebar. Type "approve" to continue, or provide feedback.');
        }
      } catch (err) {
        setCheckpointPrompt('The stage could not complete. Type "approve" to retry.');
        await supabase.from('messages').insert({
          project_id: project.id,
          agent_type: 'requirements',
          content: `Error: ${err instanceof Error ? err.message : 'Pipeline failed'}`,
        });
      }
      setIsProcessing(false);
      await loadProjectData(project.id);
      return;
    }

    // If at a checkpoint and user provides feedback (not approve)
    if (checkpointPrompt) {
      setIsProcessing(true);
      try {
        await runCodexPipeline({
          projectId: project.id,
          action: 'feedback',
          feedback: text,
        });
      } catch (err) {
        await supabase.from('messages').insert({
          project_id: project.id,
          agent_type: 'requirements',
          content: `Error processing feedback: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
      setIsProcessing(false);
      await loadProjectData(project.id);
      return;
    }

    // Regular message — free-form chat with Codex.
    setIsProcessing(true);
    try {
      await runCodexPipeline({
        projectId: project.id,
        action: 'chat',
        message: text,
      });
    } catch (err) {
      await supabase.from('messages').insert({
        project_id: project.id,
        agent_type: 'requirements',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
      });
    }
    setIsProcessing(false);
    await loadProjectData(project.id);
  };

  const handleApprove = () => {
    handleSend('approve');
  };

  const handleNewProject = () => {
    setProject(null);
    setMessages([]);
    setPrd(null);
    setEpics([]);
    setDiagrams([]);
    setUiComponents([]);
    setTaskCounts({});
    setCheckpointPrompt(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 font-sans text-white">
      {/* Sidebar — desktop */}
      <div className="hidden w-80 flex-shrink-0 lg:block">
        <Sidebar
          project={project}
          prd={prd}
          epics={epics}
          diagrams={diagrams}
          uiComponents={uiComponents}
          taskCounts={taskCounts}
          onNewProject={handleNewProject}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          llmConfigured={codexReady}
        />
      </div>

      {/* Sidebar — mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw]">
            <Sidebar
              project={project}
              prd={prd}
              epics={epics}
              diagrams={diagrams}
              uiComponents={uiComponents}
              taskCounts={taskCounts}
              onNewProject={() => {
                handleNewProject();
                setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
              onOpenSettings={() => {
                setSidebarOpen(false);
                setSettingsOpen(true);
              }}
              llmConfigured={codexReady}
            />
          </div>
        </div>
      )}

      {/* Main chat workspace */}
      <div className="flex-1">
        <ChatWorkspace
          messages={messages}
          project={project}
          onSend={handleSend}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          isProcessing={isProcessing}
          checkpointPrompt={checkpointPrompt}
          onApprove={handleApprove}
          llmConfigured={codexReady}
        />
      </div>

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
