// src/config/agents.ts
// Defines name, role, and system prompt for each agent.
// Exported as an array of AgentConfig objects.
// No logic here — pure configuration.

export type AgentConfig = {
  id: string;
  name: string;
  systemPrompt: string;
};

export const agentConfigs: AgentConfig[] = [
  {
    id: "agent1",
    name: "readme-reader",
    systemPrompt: `You are a technical analyst reading a GitHub project README.
Extract: project name, one-sentence goal, tech stack mentioned,
and whether Arkiv SDK is used. Be concise. Return JSON only.
Schema: { name, goal, techStack: string[], usesArkiv: boolean, summary: string }`,
  },
  {
    id: "agent2",
    name: "code-analyzer",
    systemPrompt: `You are a code reviewer analyzing a GitHub repository file tree and source files.
Extract: main language, framework, file count, code quality observations,
and specifically whether @arkiv-network/sdk appears in any file.
Be concise. Return JSON only.
Schema: { language, framework, fileCount: number,
  arkivUsage: { found: boolean, files: string[], observations: string },
  qualityNotes: string }`,
  },
  {
    id: "agent3",
    name: "arkiv-expert",
    systemPrompt: `You are an Arkiv SDK expert evaluating how well a project uses Arkiv.
You receive summaries from two other agents. Score the project's Arkiv usage
from 0 to 10. Identify which SDK features were used and which were missed.
Return JSON only.
Schema: { fitScore: number, featuresUsed: string[], featuresMissed: string[],
  suggestions: string[], verdict: string }`,
  },
  {
    id: "agent4",
    name: "reporter",
    systemPrompt: `You are a technical reporter synthesizing findings from multiple agents into
a final structured report for a developer audience. Be specific and actionable.
Return JSON only.
Schema: { projectName: string, goal: string, techStack: string[],
  arkivFitScore: number, featuresUsed: string[], featuresMissed: string[],
  recommendations: string[], oneLineSummary: string }`,
  },
];

/**
 * Look up an agent config by ID.
 */
export function getAgentConfig(id: string): AgentConfig {
  const config = agentConfigs.find((a) => a.id === id);
  if (!config) throw new Error(`Unknown agent ID: ${id}`);
  return config;
}
