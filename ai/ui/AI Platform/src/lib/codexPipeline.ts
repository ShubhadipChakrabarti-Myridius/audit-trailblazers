import { supabase } from './supabase';
import type { AgentType, ProjectStage } from './types';

type Action =
  | { action: 'start'; projectId: string; problemStatement: string }
  | { action: 'continue'; projectId: string; fromStage: ProjectStage }
  | { action: 'feedback'; projectId: string; feedback: string }
  | { action: 'chat'; projectId: string; message: string };

async function askCodex(message: string): Promise<string> {
  const response = await fetch('/api/codex/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Codex runner returned ${response.status}`);
  if (typeof body.response !== 'string' || !body.response.trim()) throw new Error('Codex returned an empty response');
  return body.response;
}

function parseJSON(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const result = JSON.parse(cleaned);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Codex returned invalid JSON');
  return result;
}

async function saveMessage(projectId: string, agent_type: AgentType, content: string) {
  const { error } = await supabase.from('messages').insert({ project_id: projectId, agent_type, content });
  if (error) throw error;
}

async function stage(projectId: string, current_stage: ProjectStage) {
  const { error } = await supabase.from('projects').update({ current_stage }).eq('id', projectId);
  if (error) throw error;
}

export async function runCodexPipeline(request: Action): Promise<{ status: 'checkpoint' | 'complete' | 'ok' }> {
  const { projectId } = request;
  if (request.action === 'start') {
    const prd = await askCodex(`Act as a Requirements Discovery Agent. Analyze this product idea and write a complete markdown PRD with market analysis, target users, competitors, functional and nonfunctional requirements, open questions, and success metrics. Be specific to the idea.\n\n${request.problemStatement}`);
    const { error } = await supabase.from('prds').insert({ project_id: projectId, content: prd, status: 'pending_review' });
    if (error) throw error;
    await saveMessage(projectId, 'requirements', prd);
    await saveMessage(projectId, 'requirements', 'Review the PRD in the sidebar. Type "approve" to continue, or send feedback.');
    return { status: 'checkpoint' };
  }

  if (request.action === 'feedback') {
    const { data, error } = await supabase.from('prds').select('id, content').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No PRD found to revise');
    const revised = await askCodex(`Revise this full markdown PRD using the user's feedback. Return the entire revised PRD, without commentary.\n\nPRD:\n${data.content}\n\nFeedback:\n${request.feedback}`);
    const updated = await supabase.from('prds').update({ content: revised, status: 'pending_review' }).eq('id', data.id);
    if (updated.error) throw updated.error;
    await saveMessage(projectId, 'requirements', 'I revised the PRD using your feedback. Review it in the sidebar and type "approve" when ready.');
    return { status: 'checkpoint' };
  }

  if (request.action === 'chat') {
    const answer = await askCodex(`You are an assistant in AgentForge, a product development platform. Answer this user message in markdown:\n\n${request.message}`);
    await saveMessage(projectId, 'requirements', answer);
    return { status: 'ok' };
  }

  if (request.fromStage === 'discovery') {
    const { data: prd, error } = await supabase.from('prds').select('content').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!prd) throw new Error('Approve a PRD before continuing');
    const output = await askCodex(`Act as a product manager. Decompose this approved PRD into 4 to 6 epics with 3 to 5 concrete tasks each. Return only a JSON object with this shape: {"epics":[{"title":"...","description":"...","tasks":["..."]}]}.\n\n${prd.content}`);
    const parsed = parseJSON(output);
    if (!Array.isArray(parsed.epics) || parsed.epics.length === 0) throw new Error('Codex returned no epics');
    let count = 0;
    for (const item of parsed.epics) {
      if (!item || typeof item.title !== 'string' || !Array.isArray(item.tasks)) throw new Error('Codex returned an invalid epic');
      const { data: epic, error: epicError } = await supabase.from('epics').insert({ project_id: projectId, title: item.title, description: String(item.description ?? '') }).select('id').single();
      if (epicError) throw epicError;
      for (const task of item.tasks) {
        const { error: taskError } = await supabase.from('tasks').insert({ epic_id: epic.id, project_id: projectId, title: String(task) });
        if (taskError) throw taskError;
        count++;
      }
    }
    await stage(projectId, 'decomposition');
    await saveMessage(projectId, 'pm', `Created ${parsed.epics.length} epics and ${count} tasks. Review them in the sidebar and type "approve" to continue.`);
    return { status: 'checkpoint' };
  }

  if (request.fromStage === 'decomposition') {
    const [epicResult, taskResult] = await Promise.all([
      supabase.from('epics').select('id, title, description').eq('project_id', projectId),
      supabase.from('tasks').select('epic_id, title').eq('project_id', projectId),
    ]);
    if (epicResult.error) throw epicResult.error;
    if (taskResult.error) throw taskResult.error;
    const summary = (epicResult.data ?? []).map(epic => `${epic.title}: ${epic.description}\nTasks: ${(taskResult.data ?? []).filter(task => task.epic_id === epic.id).map(task => task.title).join(', ')}`).join('\n\n');
    const output = await askCodex(`Act as a software architect. Evaluate these epics for a React, TypeScript, Tailwind, Supabase, and Vite application. Return only JSON: {"feasibility":"markdown assessment","mermaid":"graph TD ..."}. Mermaid must be valid graph TD syntax.\n\n${summary}`);
    const parsed = parseJSON(output);
    if (typeof parsed.feasibility !== 'string' || typeof parsed.mermaid !== 'string') throw new Error('Codex returned invalid architecture');
    const { error } = await supabase.from('diagrams').insert({ project_id: projectId, title: 'System Data Flow Diagram', mermaid_syntax: parsed.mermaid });
    if (error) throw error;
    await stage(projectId, 'architecture');
    await saveMessage(projectId, 'architect', parsed.feasibility);
    await saveMessage(projectId, 'architect', 'Review the diagram in the sidebar and type "approve" to continue.');
    return { status: 'checkpoint' };
  }

  if (request.fromStage === 'architecture') {
    const [epicResult, diagramResult] = await Promise.all([
      supabase.from('epics').select('title, description').eq('project_id', projectId),
      supabase.from('diagrams').select('mermaid_syntax').eq('project_id', projectId).limit(1).maybeSingle(),
    ]);
    if (epicResult.error) throw epicResult.error;
    if (diagramResult.error) throw diagramResult.error;
    const output = await askCodex(`Act as a UI/UX designer. Based on these epics and architecture, create one self-contained React TypeScript component using Tailwind CSS. Return only JSON: {"componentTitle":"...","code":"full TSX source","recommendations":"markdown design guidance"}.\n\nEpics: ${JSON.stringify(epicResult.data)}\n\nDiagram: ${diagramResult.data?.mermaid_syntax ?? ''}`);
    const parsed = parseJSON(output);
    if (typeof parsed.componentTitle !== 'string' || typeof parsed.code !== 'string' || typeof parsed.recommendations !== 'string') throw new Error('Codex returned an invalid component');
    const { error } = await supabase.from('ui_components').insert({ project_id: projectId, title: parsed.componentTitle, code: parsed.code, framework: 'react' });
    if (error) throw error;
    await stage(projectId, 'complete');
    await saveMessage(projectId, 'uiux', parsed.recommendations);
    await saveMessage(projectId, 'uiux', 'The component is available in the sidebar. The pipeline is complete.');
    return { status: 'complete' };
  }

  return { status: 'complete' };
}
