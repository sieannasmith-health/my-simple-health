/* My Simple Health — guided reflection state guard */
(function (root) {
  'use strict';

  const GREETING = /^(?:(hi|hey|hello)\b(?:[,.!\s]+how are you)?|good\s+(morning|afternoon|evening)|how are you|what's up|whats up)[?!.\s]*$/i;
  const RETURN = /\b(return|resume|continue (?:the|my|this) reflection|go back to (?:the|my|this) reflection)\b/i;
  const PAUSE = /\b(pause|stop|cancel|skip|not now|come back later)\b/i;
  const DETOUR = /\b(change (the )?topic|talk about something else)\b/i;
  const CLARIFICATION = /^(what|why|how|when|where|who|which|can|could|would|will|do|does|did|is|are|am|should|may)\b/i;
  const UNCERTAINTY = /\b(i\s*(do not|don't)\s*know|not sure|unsure|i'm confused|i am confused|what do you mean|can you clarify|could you clarify)\b/i;
  const WORDING_HELP = /\b(help me (word|write|phrase|rewrite|summarize|complete)|how (should|could|would) i (word|write|phrase|answer)|what (should|could|would) i (write|say)|rewrite (this|that|it)|summarize (this|that|it)|make (this|that|it) sound)\b/i;
  const MEANING_LANGUAGE = /\b(because|so that|in order to|would (help|allow|mean|give|make|let)|matters?|important|make possible|the reason|so (i|we|my|our))\b/i;
  const CONTEXT_LANGUAGE = /\b(right now|currently|at the moment|we have|i have|we only|i only|only enough|live in|one income|in school|trying to|the amount of|the size of)\b/i;

  function classify(value, stepKey) {
    const text = String(value || '').trim();
    if (!text) return { kind: 'empty', advances: false };
    if (stepKey === 'confidence') {
      const number = Number(text);
      return Number.isInteger(number) && number >= 1 && number <= 10
        ? { kind: 'answer', advances: true }
        : { kind: 'invalid_confidence', advances: false };
    }
    if (GREETING.test(text)) return { kind: 'conversation', advances: false };
    if (RETURN.test(text)) return { kind: 'return', advances: false };
    if (PAUSE.test(text)) return { kind: 'pause', advances: false };
    if (DETOUR.test(text)) return { kind: 'detour', advances: false };
    if (UNCERTAINTY.test(text)) return { kind: 'uncertainty', advances: false };
    if (WORDING_HELP.test(text)) return { kind: 'wording_help', advances: false };
    if (text.includes('?') || CLARIFICATION.test(text)) return { kind: 'question', advances: false };
    if (stepKey === 'whyMatters' && CONTEXT_LANGUAGE.test(text) && !MEANING_LANGUAGE.test(text)) {
      return { kind: 'context', advances: false };
    }
    return { kind: 'answer', advances: true };
  }

  function activitySignals(classification) {
    const kind = classification && classification.kind || 'conversation';
    return {
      directlyAnsweredCurrentStep: classification && classification.advances === true,
      interactionState: kind,
      allowedDispositions: kind === 'answer'
        ? ['ANSWER', 'CONVERSATION']
        : kind === 'pause'
          ? ['PAUSE', 'CONVERSATION']
          : kind === 'return'
            ? ['RETURN', 'CONVERSATION']
            : ['CONVERSATION']
    };
  }

  root.MSHGuidedReflection = Object.freeze({ classify, activitySignals });
})(typeof window !== 'undefined' ? window : globalThis);
