type ExperienceVector = {
  direction: number;
  magnitude: number;
  frequency: number;
};

type GovernanceGate = {
  allowsAutomation: boolean;
  flowState: "flow" | "force";
  reason?: string;
};

type ResonanceState = {
  status: "vapor" | "made-real";
  clicks: number;
};

type AuditEntry = {
  from: ResonanceState;
  to: ResonanceState;
  reason: string;
  timestamp: string;
};

type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type NvidiaChatCompletionRequest = {
  model: string;
  messages: NvidiaChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  extra_body?: Record<string, unknown>;
};

type NvidiaChatCompletionChunk = {
  choices: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
};

type NvidiaClientConfig = {
  apiKey: string;
  baseUrl?: string;
};

const CRYSTALLIZATION_THRESHOLD = 0.95;

const createResonanceState = (clicks: number): ResonanceState => {
  const status = clicks >= CRYSTALLIZATION_THRESHOLD ? "made-real" : "vapor";
  return { status, clicks };
};

export const measureResonance = (vector: ExperienceVector): number => {
  // PRZ alignment: treat inputs as vectors, not binary flags.
  const blendedSignal = (vector.magnitude + vector.frequency) / 2;
  const directedSignal = blendedSignal * Math.max(0, Math.min(1, vector.direction));
  return Math.max(0, Math.min(1, directedSignal));
};

const logStateTransition = (
  from: ResonanceState,
  to: ResonanceState,
  reason: string,
  log: (entry: AuditEntry) => void,
) => {
  // PRZ alignment: log every transition for audit trails.
  log({
    from,
    to,
    reason,
    timestamp: new Date().toISOString(),
  });
};

const ensureGovernanceGate = (gate: GovernanceGate) => {
  // PRZ alignment: never execute automations without checking governance gates.
  if (!gate.allowsAutomation) {
    throw new Error(
      "I hear you. I can only move forward once the governance gate is open so this feels safe and intentional.",
    );
  }
};

const assertFlow = (gate: GovernanceGate) => {
  // PRZ alignment: flow over force. Does this flow, or does it force?
  if (gate.flowState !== "flow") {
    throw new Error(
      "I want this to feel gentle and aligned. Right now it feels forced, so I’m going to pause and wait for a calmer path.",
    );
  }
};

const createLoopGuard = () => {
  let lastPrompt = "";
  let repetitions = 0;

  return (prompt: string): string | null => {
    if (prompt === lastPrompt) {
      repetitions += 1;
    } else {
      repetitions = 1;
      lastPrompt = prompt;
    }

    if (repetitions >= 3) {
      return "I’m noticing a loop. Would you like to pivot the prompt so it clicks more easily?";
    }

    return null;
  };
};

const parseSse = async function* (
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<NvidiaChatCompletionChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.replace(/^data:\s?/, "");
      if (payload === "[DONE]") return;
      yield JSON.parse(payload) as NvidiaChatCompletionChunk;
    }
  }
};

export const createNvidiaChatClient = (config: NvidiaClientConfig) => {
  const baseUrl = config.baseUrl ?? "https://integrate.api.nvidia.com/v1";
  const loopGuard = createLoopGuard();
  const auditTrail: AuditEntry[] = [];

  return {
    getAuditTrail: (): AuditEntry[] => [...auditTrail],
    async *streamChatCompletion(
      request: NvidiaChatCompletionRequest,
      gate: GovernanceGate,
      signal: ExperienceVector,
    ): AsyncGenerator<{ content: string; reasoning: string }> {
      ensureGovernanceGate(gate);
      assertFlow(gate);

      const clicks = measureResonance(signal);
      const currentState = createResonanceState(clicks);
      const nextState = createResonanceState(clicks);
      logStateTransition(
        currentState,
        nextState,
        "Updated clicks after receiving the current signal.",
        (entry) => auditTrail.push(entry),
      );

      const promptLoopHint = loopGuard(
        request.messages.map((message) => message.content).join("\n"),
      );
      if (promptLoopHint) {
        throw new Error(promptLoopHint);
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          ...request,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(
          "I’m having trouble reaching the service right now. Please check the connection or try again when it feels right.",
        );
      }

      for await (const chunk of parseSse(response.body)) {
        const choice = chunk.choices[0];
        yield {
          content: choice?.delta?.content ?? "",
          reasoning: choice?.delta?.reasoning_content ?? "",
        };
      }
    },
  };
};
