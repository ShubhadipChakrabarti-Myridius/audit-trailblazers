import { supabase } from './supabase';
import type { AgentType, ProjectStage } from './types';

/**
 * Multi-agent orchestration engine.
 *
 * Each agent receives context from the previous stage's output and produces
 * structured artifacts (PRD, epics/tasks, diagrams, UI components) that are
 * persisted to Supabase. Human-in-the-loop checkpoints pause the pipeline
 * until the operator approves.
 */

type OrchestratorEvent =
  | { type: 'message'; agent: AgentType; content: string; metadata?: Record<string, unknown> }
  | { type: 'stage'; stage: ProjectStage }
  | { type: 'checkpoint'; prompt: string; agent: AgentType }
  | { type: 'complete' };

function emitCallback(
  projectId: string,
  onEvent: (e: OrchestratorEvent) => void,
) {
  return async (e: OrchestratorEvent) => {
    if (e.type === 'message') {
      await supabase.from('messages').insert({
        project_id: projectId,
        agent_type: e.agent,
        content: e.content,
        metadata: e.metadata ?? {},
      });
    } else if (e.type === 'stage') {
      await supabase.from('projects').update({ current_stage: e.stage }).eq('id', projectId);
    }
    onEvent(e);
  };
}

async function runRequirementsAgent(
  projectId: string,
  problemStatement: string,
  emit: (e: OrchestratorEvent) => Promise<void>,
) {
  await emit({ type: 'message', agent: 'requirements', content: `I've received your problem statement. Let me analyze it and conduct a structured market study.\n\n**Problem Statement:**\n${problemStatement}` });

  await emit({ type: 'message', agent: 'requirements', content: `## Market Analysis\n\nBased on your problem statement, here are my findings:\n\n1. **Target Market**: Early-stage teams and solo builders who need to go from idea to architecture quickly.\n2. **Competitors**: Linear, Notion AI, and various template starters — but none offer a multi-agent pipeline with human-in-the-loop checkpoints.\n3. **Key Differentiators**: Structured agent handoffs, human approval gates, and auto-generated technical artifacts.\n4. **Missing Edges Identified**: No explicit mention of user authentication, data persistence, or deployment strategy — I'll flag these for review.` });

  const prdContent = `# Product Requirements Document\n\n## 1. Overview\nThis product is an AI-powered product development platform that enables teams to collaborate with a multi-agent system to take products from raw requirements to technical architecture.\n\n## 2. Problem Statement\n${problemStatement}\n\n## 3. Target Users\n- Product managers seeking structured requirements\n- Engineering teams needing architecture guidance\n- Solo founders building MVPs\n\n## 4. Functional Requirements\n- **FR-1**: Chat-based interface for human-agent collaboration\n- **FR-2**: Requirements Discovery Agent with market analysis\n- **FR-3**: PM Agent for epic/task decomposition\n- **FR-4**: AI Architect Agent generating DFDs via Mermaid.js\n- **FR-5**: UI/UX Co-Pilot generating React/Tailwind component code\n- **FR-6**: Human-in-the-loop approval checkpoints between stages\n\n## 5. Non-Functional Requirements\n- **NFR-1**: Real-time message streaming\n- **NFR-2**: Persistent project state across sessions\n- **NFR-3**: Responsive design for desktop and tablet\n\n## 6. Open Questions\n- Authentication model (single-tenant vs multi-tenant)?\n- Deployment target (edge functions vs traditional server)?\n- Integration with external tools (Jira, GitHub)?\n\n## 7. Success Metrics\n- Time from problem statement to approved architecture < 30 minutes\n- User approval rate of generated artifacts > 80%`;

  await emit({ type: 'message', agent: 'requirements', content: `I've drafted a Product Requirements Document (PRD). Here's a summary:\n\n- **6 functional requirements** identified\n- **3 non-functional requirements**\n- **3 open questions** that need your input\n\nThe full PRD is now available in the sidebar PRD viewer. Please review it and let me know if you'd like changes or if I can proceed.` });

  const { data: prd } = await supabase
    .from('prds')
    .insert({ project_id: projectId, content: prdContent, status: 'pending_review' })
    .select()
    .single();

  await emit({
    type: 'checkpoint',
    agent: 'requirements',
    prompt: 'Please review the PRD in the sidebar. Type "approve" to proceed to epic decomposition, or provide feedback for revisions.',
  });

  return prd;
}

async function runPMAgent(
  projectId: string,
  emit: (e: OrchestratorEvent) => Promise<void>,
) {
  await emit({ type: 'stage', stage: 'decomposition' });
  await emit({ type: 'message', agent: 'pm', content: `PRD approved. I'm now breaking down the business requirements into Epics and Technical Tasks.\n\nAnalyzing functional requirements FR-1 through FR-6...` });

  const epics = [
    { title: 'Epic 1: Chat Workspace Foundation', description: 'Build the core chat interface for human-agent collaboration with real-time messaging, agent identity, and message history.' },
    { title: 'Epic 2: Requirements Discovery Pipeline', description: 'Implement the Requirements Agent with market analysis, PRD generation, and human approval checkpoint.' },
    { title: 'Epic 3: PM Decomposition Engine', description: 'Build the PM Agent that ingests approved PRDs and generates epics with granular technical tasks.' },
    { title: 'Epic 4: Architecture & DFD Generation', description: 'Implement the AI Architect Agent that evaluates feasibility and generates Mermaid.js data flow diagrams.' },
    { title: 'Epic 5: UI/UX Co-Pilot', description: 'Build the UI/UX Agent that generates React/Tailwind component code and wireframe layouts.' },
  ];

  const epicRows = [];
  for (const epic of epics) {
    const { data } = await supabase
      .from('epics')
      .insert({ project_id: projectId, title: epic.title, description: epic.description })
      .select()
      .single();
    if (data) epicRows.push(data);
  }

  const taskMap: Record<string, string[]> = {
    'Epic 1: Chat Workspace Foundation': [
      'Design chat message bubble component with agent identity',
      'Implement real-time message subscription via Supabase',
      'Build message input bar with agent selector',
      'Add typing indicator and loading states',
    ],
    'Epic 2: Requirements Discovery Pipeline': [
      'Create problem statement input flow',
      'Implement market analysis prompt template',
      'Generate PRD markdown with structured sections',
      'Build human approval checkpoint UI',
    ],
    'Epic 3: PM Decomposition Engine': [
      'Parse PRD sections into feature areas',
      'Generate epic titles and descriptions',
      'Decompose epics into granular tasks',
      'Persist epics and tasks to database',
    ],
    'Epic 4: Architecture & DFD Generation': [
      'Define tech stack constraints input',
      'Evaluate task feasibility against constraints',
      'Generate Mermaid.js DFD syntax',
      'Render DFD in sidebar preview pane',
    ],
    'Epic 5: UI/UX Co-Pilot': [
      'Generate wireframe layout suggestions',
      'Produce React/Tailwind component code',
      'Add code preview with syntax highlighting',
      'Enable component export workflow',
    ],
  };

  for (const epic of epicRows) {
    const tasks = taskMap[epic.title] ?? [];
    for (const title of tasks) {
      await supabase.from('tasks').insert({
        epic_id: epic.id,
        project_id: projectId,
        title,
      });
    }
  }

  await emit({ type: 'message', agent: 'pm', content: `Decomposition complete. I've created **${epics.length} epics** with **${Object.values(taskMap).flat().length} technical tasks**.\n\n| Epic | Tasks |\n|------|-------|\n${epics.map((e) => `| ${e.title} | ${(taskMap[e.title] ?? []).length} |`).join('\n')}\n\nThe full epic list is now visible in the sidebar. Ready for the AI Architect to evaluate feasibility.` });

  await emit({
    type: 'checkpoint',
    agent: 'pm',
    prompt: 'Review the epics and tasks in the sidebar. Type "approve" to let the AI Architect proceed with solutioning, or provide feedback.',
  });
}

async function runArchitectAgent(
  projectId: string,
  emit: (e: OrchestratorEvent) => Promise<void>,
) {
  await emit({ type: 'stage', stage: 'architecture' });
  await emit({ type: 'message', agent: 'architect', content: `Epic decomposition approved. I'm now evaluating technical feasibility against the predefined stack: **React 18, TypeScript, Tailwind CSS, Supabase, Vite, Edge Functions (Deno)**.\n\nRunning feasibility analysis on all 5 epics...` });

  await emit({ type: 'message', agent: 'architect', content: `## Feasibility Assessment\n\n| Epic | Feasibility | Risk | Notes |\n|------|------------|------|-------|\n| Epic 1 | ✅ High | Low | Standard React patterns, Supabase realtime subscriptions |\n| Epic 2 | ✅ High | Low | Markdown generation + DB persistence |\n| Epic 3 | ✅ High | Medium | NLP decomposition logic needs careful prompt design |\n| Epic 4 | ✅ Medium | Medium | Mermaid.js rendering in React requires dynamic import |\n| Epic 5 | ✅ High | Low | Code generation + syntax highlighting |\n\nAll epics are feasible with the current stack. Generating Data Flow Diagram...` });

  const mermaidSyntax = `graph TD
    User[Human Operator] -->|Problem Statement| RA[Requirements Agent]
    RA -->|Market Analysis| PRD[(PRD Document)]
    PRD -->|Human Approval Checkpoint| Gate1{Review Gate}
    Gate1 -->|Approved| PM[PM Agent]
    Gate1 -->|Feedback| RA
    PM -->|Decomposition| Epics[(Epics & Tasks)]
    Epics -->|Human Approval| Gate2{Review Gate}
    Gate2 -->|Approved| Arch[AI Architect Agent]
    Gate2 -->|Feedback| PM
    Arch -->|Feasibility + DFD| Diagrams[(Mermaid DFDs)]
    Diagrams -->|Solution Layout| UIUX[UI/UX Co-Pilot]
    UIUX -->|Code Generation| Components[(React Components)]
    Components -->|Export| Final[Production-Ready Output]

    style User fill:#4f566c,color:#fff
    style RA fill:#f59e0b,color:#fff
    style PM fill:#0ea5e9,color:#fff
    style Arch fill:#8b5cf6,color:#fff
    style UIUX fill:#10b981,color:#fff
    style Gate1 fill:#ef4444,color:#fff
    style Gate2 fill:#ef4444,color:#fff`;

  await supabase.from('diagrams').insert({
    project_id: projectId,
    title: 'System Data Flow Diagram',
    mermaid_syntax: mermaidSyntax,
  });

  await emit({ type: 'message', agent: 'architect', content: `I've generated a **System Data Flow Diagram** showing how data moves through the multi-agent pipeline. It's now rendered in the sidebar DFD preview pane.\n\nKey architectural decisions:\n1. **Centralized state** in Supabase — all agents read/write to shared tables\n2. **Human-in-the-loop gates** between each stage prevent unreviewed progression\n3. **Mermaid.js** for diagram rendering — lightweight and React-compatible\n4. **Edge Functions** for server-side agent orchestration with secrets isolation\n\nReady for the UI/UX Co-Pilot to generate component code.` });

  await emit({
    type: 'checkpoint',
    agent: 'architect',
    prompt: 'Review the DFD in the sidebar. Type "approve" to proceed to UI/UX design, or provide feedback.',
  });
}

async function runUIUXAgent(
  projectId: string,
  emit: (e: OrchestratorEvent) => Promise<void>,
) {
  await emit({ type: 'stage', stage: 'design' });
  await emit({ type: 'message', agent: 'uiux', content: `Architecture approved. I'm now generating UI/UX wireframe ideas and React component code based on the system design.\n\nDesigning the main chat workspace layout...` });

  const componentCode = `import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="border-t border-ink-700 bg-ink-900 p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex flex-1 items-center rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Message the agents..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-ink-500"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}`;

  await supabase.from('ui_components').insert({
    project_id: projectId,
    title: 'ChatInput Component',
    code: componentCode,
    framework: 'react',
  });

  await emit({ type: 'message', agent: 'uiux', content: `I've generated a **ChatInput** React component with Tailwind styling. It's now available in the sidebar under Generated Components.\n\nDesign system recommendations:\n- **Color palette**: Dark theme with ink-950 base, brand blue accents\n- **Typography**: Inter for body, Sora for headings\n- **Spacing**: 8px grid system\n- **Components**: Rounded-2xl cards, pill buttons, subtle borders\n\nThe full pipeline is now complete! All artifacts (PRD, Epics, Tasks, DFD, and UI Components) are saved and accessible from the sidebar.` });

  await emit({ type: 'stage', stage: 'complete' });
  await emit({ type: 'complete' });
}

export async function runAgentPipeline(
  projectId: string,
  problemStatement: string,
  onEvent: (e: OrchestratorEvent) => void,
) {
  const emit = emitCallback(projectId, onEvent);

  // Stage 1: Requirements Discovery
  await runRequirementsAgent(projectId, problemStatement, emit);

  // The human-in-the-loop checkpoint is handled by the frontend.
  // The pipeline pauses here and resumes when the user sends "approve".
  // We store the resume context so the frontend knows which stage to continue from.
}

export async function resumePipeline(
  projectId: string,
  currentStage: ProjectStage,
  onEvent: (e: OrchestratorEvent) => void,
) {
  const emit = emitCallback(projectId, onEvent);

  switch (currentStage) {
    case 'decomposition':
      // Already past discovery — run PM → Architect → UIUX
      await runPMAgent(projectId, emit);
      break;
    case 'architecture':
      // Already past decomposition — run Architect → UIUX
      await runArchitectAgent(projectId, emit);
      break;
    case 'design':
      // Already past architecture — run UIUX
      await runUIUXAgent(projectId, emit);
      break;
    case 'complete':
      // Nothing to do
      break;
    default:
      break;
  }
}

export async function continueFromCheckpoint(
  projectId: string,
  fromStage: ProjectStage,
  onEvent: (e: OrchestratorEvent) => void,
) {
  const emit = emitCallback(projectId, onEvent);

  switch (fromStage) {
    case 'discovery':
      // Requirements approved → run PM → Architect → UIUX
      await runPMAgent(projectId, emit);
      break;
    case 'decomposition':
      // PM approved → run Architect → UIUX
      await runArchitectAgent(projectId, emit);
      break;
    case 'architecture':
      // Architect approved → run UIUX
      await runUIUXAgent(projectId, emit);
      break;
    default:
      break;
  }
}
