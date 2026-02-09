export type PrzState = "vapor" | "make-real";

export type ClicksVector = {
  direction: "toward" | "away";
  magnitude: number;
  frequency: number;
};

export type PrzAuditEntry = {
  timestamp: string;
  automationName: string;
  fromState: PrzState;
  toState: PrzState;
  clicks: number;
  allowed: boolean;
  note?: string;
};

export type GovernanceGateInput = {
  automationName: string;
  userApproved: boolean;
  currentState: PrzState;
  clicksVector: ClicksVector;
  loopCount: number;
};

export type GovernanceGateResult = {
  allowed: boolean;
  clicks: number;
  nextState: PrzState;
  message?: string;
  pivotSuggested: boolean;
  auditEntry: PrzAuditEntry;
};

export const MAKE_REAL_THRESHOLD = 0.95;

const normalizeUnit = (value: number): number => {
  return Math.min(1, Math.max(0, value));
};

export const measureClicks = (vector: ClicksVector): number => {
  // Flow Over Force: honor direction and intensity without forcing a binary block.
  const normalizedMagnitude = normalizeUnit(vector.magnitude);
  const normalizedFrequency = normalizeUnit(vector.frequency);
  const directionFactor = vector.direction === "toward" ? 1 : 0.5;
  const blended = normalizedMagnitude * 0.6 + normalizedFrequency * 0.4;
  return Math.min(1, blended * directionFactor);
};

export const deriveStateFromClicks = (clicks: number): PrzState => {
  // Present-Moment: default to vapor unless clicks are strong enough to make real.
  return clicks >= MAKE_REAL_THRESHOLD ? "make-real" : "vapor";
};

export const createAuditTrail = () => {
  const entries: PrzAuditEntry[] = [];
  const logTransition = (entry: PrzAuditEntry) => {
    entries.push(entry);
  };
  return { entries, logTransition };
};

export const checkGovernanceGate = (input: GovernanceGateInput): GovernanceGateResult => {
  const clicks = measureClicks(input.clicksVector);
  const nextState = deriveStateFromClicks(clicks);
  const pivotSuggested = input.loopCount >= 3;
  const allowed = input.userApproved && clicks >= 0.2;

  const message = !allowed
    ? "I can pause here. If you'd like me to continue, just say the word."
    : pivotSuggested
      ? "We’ve tried this a few times. Want to try a different approach?"
      : undefined;

  const note = pivotSuggested ? "Pivot suggested after 3 loops." : undefined;

  return {
    allowed,
    clicks,
    nextState,
    message,
    pivotSuggested,
    auditEntry: {
      timestamp: new Date().toISOString(),
      automationName: input.automationName,
      fromState: input.currentState,
      toState: nextState,
      clicks,
      allowed,
      note,
    },
  };
};
