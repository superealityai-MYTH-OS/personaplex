export type PrzState = "vapor" | "make-real";

export type PrzStateTransition = {
  from: PrzState;
  to: PrzState;
  reason: string;
  occurredAt: string;
};

export type GovernanceGate = {
  allowed: boolean;
  rationale?: string;
};

export type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NvidiaChatPayload = {
  model: string;
  messages: NvidiaChatMessage[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  min_thinking_tokens: number;
  max_thinking_tokens: number;
  frequency_penalty: number;
  presence_penalty: number;
  stream: boolean;
};

export type NvidiaChatResponse = {
  id: string;
  choices: Array<{
    index: number;
    message: NvidiaChatMessage;
    finish_reason: string | null;
  }>;
};

export type LoopSignal = {
  loopDetected: boolean;
  iterationCount: number;
  pivotSuggestion?: string;
};

const CRYSTALIZATION_THRESHOLD = 0.95;

const normalizePrompt = (prompt: string) => prompt.trim().toLowerCase();

export const measureResonance = (prompt: string): number => {
  const cleaned = normalizePrompt(prompt);
  if (!cleaned) {
    return 0;
  }

  const meaningfulTokens = cleaned.split(/\s+/).filter((token) => token.length > 2);
  const density = Math.min(meaningfulTokens.length / 32, 1);

  // PRZ alignment: use a gentle heuristic so "clicks" stays in the vapor state by default.
  return Math.min(0.9 + density * 0.05, CRYSTALIZATION_THRESHOLD);
};

export const resolvePrzState = (clicks: number): PrzState =>
  clicks >= CRYSTALIZATION_THRESHOLD ? "make-real" : "vapor";

export class LoopTracker {
  private readonly history: string[] = [];

  register(prompt: string): LoopSignal {
    const normalized = normalizePrompt(prompt);
    this.history.push(normalized);

    const iterationCount = this.history.filter((item) => item === normalized).length;
    if (iterationCount >= 3) {
      return {
        loopDetected: true,
        iterationCount,
        pivotSuggestion:
          "It looks like we're looping. Would you like to try a fresh angle or a smaller step?",
      };
    }

    return { loopDetected: false, iterationCount };
  }
}

export type NvidiaChatRequestArgs = {
  apiKey: string;
  payload: NvidiaChatPayload;
  governanceGate: GovernanceGate;
  loopTracker?: LoopTracker;
  onStateTransition?: (transition: PrzStateTransition) => void;
};

export const createNvidiaChatRequest = async ({
  apiKey,
  payload,
  governanceGate,
  loopTracker,
  onStateTransition,
}: NvidiaChatRequestArgs): Promise<NvidiaChatResponse> => {
  if (!governanceGate.allowed) {
    throw new Error(
      governanceGate.rationale ??
        "I want to honor your guardrails before we move forward. Please confirm if you'd like to continue.",
    );
  }

  const latestMessage = payload.messages[payload.messages.length - 1];
  const latestPrompt = latestMessage?.content ?? "";

  const loopSignal = loopTracker?.register(latestPrompt);
  if (loopSignal?.loopDetected && loopSignal.pivotSuggestion) {
    throw new Error(loopSignal.pivotSuggestion);
  }

  const clicks = measureResonance(latestPrompt);
  const nextState = resolvePrzState(clicks);
  const transition: PrzStateTransition = {
    from: "vapor",
    to: nextState,
    reason: `clicks=${clicks.toFixed(2)}`,
    occurredAt: new Date().toISOString(),
  };

  // PRZ alignment: log every state transition for audit trails.
  onStateTransition?.(transition);

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      "I couldn't reach the response yet, but we can try again when you're ready.",
    );
  }

  return (await response.json()) as NvidiaChatResponse;
};
