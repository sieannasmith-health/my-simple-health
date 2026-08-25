/* My Simple Health — Hello + My Health journey intelligence */
(function (root) {
  'use strict';

  const CONTRACT_VERSION = 2;
  const PROVENANCE = Object.freeze({
    USER_STATED: 'USER_STATED',
    SYSTEM_OBSERVED: 'SYSTEM_OBSERVED',
    MODEL_INFERRED: 'MODEL_INFERRED',
    USER_CONFIRMED: 'USER_CONFIRMED'
  });
  const MAX_TEXT = 500;
  const MAX_ITEMS = 18;
  const NAVIGATION_LABELS = Object.freeze({
    preserve: 'Preserve',
    explore: 'Explore',
    develop: 'Develop',
    adapt: 'Adapt',
    prepare: 'Save for Later',
    no_action: 'Leave It Alone'
  });
  const POSITION_LABELS = Object.freeze({
    current_picture: 'Current picture',
    desired_direction: 'Desired direction',
    chosen_project: 'Chosen Project',
    practice_experience: 'Practice experience',
    reflection: 'Reflection',
    learning: 'Learning',
    progress: 'Progress',
    next_decision: 'Next decision'
  });

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value, limit) {
    return typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').slice(0, limit || MAX_TEXT)
      : '';
  }

  function timestamp(value) {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function latest(items, dateFields) {
    const fields = dateFields || ['updatedAt', 'createdAt', 'completedAt'];
    return [...list(items)].sort((a, b) => {
      const timeFor = item => {
        for (const field of fields) {
          const parsed = Date.parse(item && item[field] || '');
          if (Number.isFinite(parsed)) return parsed;
        }
        return 0;
      };
      return timeFor(b) - timeFor(a);
    })[0] || null;
  }

  function active(items) {
    return list(items).find(item => item && item.status === 'active') || null;
  }

  function current(items) {
    return latest(list(items).filter(item => item && item.status === 'current'));
  }

  function recordId(record) {
    return record && typeof record.id === 'string' ? record.id.slice(0, 120) : null;
  }

  function addItem(items, options) {
    const value = text(options.text);
    if (!value) return;
    items.push({
      id: `${options.source}:${options.recordId || items.length}`.slice(0, 160),
      epistemicStatus: options.epistemicStatus,
      source: options.source,
      informationClass: options.informationClass || null,
      text: value,
      recordId: options.recordId || null,
      recordedAt: options.recordedAt || null,
      confirmed: options.epistemicStatus === PROVENANCE.USER_CONFIRMED,
      requiresConfirmation: options.epistemicStatus === PROVENANCE.MODEL_INFERRED,
      priority: options.priority || 0
    });
  }

  function getRecords(state) {
    const safe = state && typeof state === 'object' ? state : {};
    const landscape = latest(list(safe.landscapes).filter(item => item && item.status === 'completed'), ['completedAt', 'updatedAt']);
    const focus = active(safe.focuses);
    const vision = latest(list(safe.visionEntries).filter(entry =>
      entry && entry.status === 'current' && entry.synthesis && entry.synthesis.confirmationStatus === 'confirmed'
    ));
    const project = active(safe.projects) || latest(
      list(safe.projects).filter(item => item && ['paused', 'completed'].includes(item.status))
    );
    const practice = project
      ? list(safe.practices).find(item => item && item.projectId === project.id && item.status === 'active') || null
      : null;
    const attempts = project
      ? list(safe.practiceAttempts).filter(item => item && item.projectId === project.id)
      : [];
    const reflections = project
      ? list(safe.reflections).filter(item => item && item.projectId === project.id)
      : [];
    const learning = list(safe.learningEntries).filter(item => item && item.currentStatus === 'current');
    const progress = project
      ? list(safe.progressEvents).filter(item => item && item.projectId === project.id)
      : list(safe.progressEvents);

    return {
      state: safe,
      landscape,
      focus,
      vision,
      project,
      practice,
      attempts,
      reflections,
      learning,
      progress,
      wheel: safe.wellnessWheel && safe.wellnessWheel.current || null,
      returnPoints: list(safe.returnPoints)
    };
  }

  function recognizeJourneyPosition(state) {
    const records = getRecords(state);
    const { landscape, focus, vision, project, practice, attempts, reflections, learning, progress } = records;
    const navigationChoice = focus && NAVIGATION_LABELS[focus.navigationState]
      ? focus.navigationState
      : null;
    const latestReflection = latest(reflections);

    let key = 'current_picture';
    let reason = 'No completed Landscape or later journey choice is recorded yet.';

    if (project) {
      if (['paused', 'completed'].includes(project.status)) {
        key = 'next_decision';
        reason = `The most recent Project is ${project.status}; the next step remains the person's decision.`;
      } else if (latestReflection && ['modify', 'pause', 'done'].includes(latestReflection.nextStep)) {
        key = 'next_decision';
        reason = 'The latest reflection records a decision point about adapting, pausing, or completing the current Practice.';
      } else if (!practice || (!attempts.length && !reflections.length)) {
        key = 'practice_experience';
        reason = practice
          ? 'An active Practice is ready to be tried in real life.'
          : 'An active Project is recorded; no active Practice has been chosen.';
      } else if (!reflections.length) {
        key = 'reflection';
        reason = 'Practice experience is recorded and can be reflected on without grading it.';
      } else if (!learning.length) {
        key = 'learning';
        reason = 'A reflection is recorded; the person may decide whether anything is useful to carry forward.';
      } else {
        key = 'progress';
        reason = 'Recorded experience has produced learning or progress events.';
      }
    } else if (vision) {
      key = 'chosen_project';
      reason = 'A current Vision is recorded, but no active Project has been chosen.';
    } else if (landscape || focus) {
      key = 'desired_direction';
      reason = 'A current picture is available; the person remains in control of what, if anything, comes next.';
    } else if (learning.length || progress.length) {
      key = 'progress';
      reason = 'Recorded experience has produced learning or progress events.';
    }

    if (navigationChoice === 'prepare' || navigationChoice === 'no_action') {
      key = 'next_decision';
      reason = navigationChoice === 'prepare'
        ? 'The person chose Save for Later; no active Project should be inferred.'
        : 'The person chose Leave It Alone; no active Project should be inferred.';
    }

    return {
      key,
      label: POSITION_LABELS[key],
      reason,
      epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
      navigationChoice,
      navigationLabel: navigationChoice ? NAVIGATION_LABELS[navigationChoice] : null
    };
  }

  function buildContextItems(state) {
    const records = getRecords(state);
    const items = [];
    const { landscape, focus, vision, project, practice, attempts, reflections, learning, progress, wheel, returnPoints } = records;

    if (wheel && wheel.scores && typeof wheel.scores === 'object') {
      Object.entries(wheel.scores).slice(0, 8).forEach(([dimension, score]) => addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: `assessment.wellnessWheel.${dimension}`,
        text: `The person rated ${dimension.replace(/_/g, ' ')} wellness ${text(String(score), 12)} out of 10.`,
        recordId: recordId(wheel),
        recordedAt: timestamp(wheel.completedAt),
        priority: 79
      }));
    }

    if (landscape) {
      addItem(items, {
        epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
        source: 'landscape.completed',
        text: 'A completed Landscape is available. Its summaries are observations, not instructions or diagnoses.',
        recordId: recordId(landscape),
        recordedAt: timestamp(landscape.completedAt || landscape.updatedAt),
        priority: 45
      });
      if (landscape.finalContext) {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'landscape.finalContext',
          text: landscape.finalContext,
          recordId: recordId(landscape),
          recordedAt: timestamp(landscape.completedAt || landscape.updatedAt),
          priority: 84
        });
      }
      if (landscape.correction) {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'landscape.correction',
          text: landscape.correction,
          recordId: recordId(landscape),
          recordedAt: timestamp(landscape.updatedAt),
          priority: 98
        });
      }
    }

    if (landscape && Array.isArray(landscape.responses)) {
      landscape.responses.slice(-6).forEach(response => {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'assessment.response',
          text: `${text(response.construct, 90).replace(/_/g, ' ')}: ${text(response.label || response.value, 180)}${response.context ? ` — ${text(response.context, 220)}` : ''}`,
          recordId: recordId(landscape),
          recordedAt: timestamp(response.answeredAt),
          priority: response.context ? 90 : 74
        });
      });
    }

    if (focus) {
      const label = text(focus.label, 120);
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'focus.choice',
        text: label ? `The person chose ${label} as an area to pay attention to.` : '',
        recordId: recordId(focus),
        recordedAt: timestamp(focus.updatedAt || focus.createdAt),
        priority: 100
      });
      if (NAVIGATION_LABELS[focus.navigationState]) {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'focus.navigationChoice',
          text: `The person chose ${NAVIGATION_LABELS[focus.navigationState]} for this area.`,
          recordId: recordId(focus),
          recordedAt: timestamp(focus.updatedAt || focus.createdAt),
          priority: 100
        });
      }
    }

    if (vision && vision.synthesis && vision.synthesis.statement) {
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_CONFIRMED,
        source: 'vision.synthesis',
        text: vision.synthesis.statement,
        recordId: recordId(vision),
        recordedAt: timestamp(vision.updatedAt || vision.createdAt),
        priority: 92
      });
    }

    if (project) {
      [
        ['project.title', project.title, 94],
        ['project.pointA', project.pointA, 94],
        ['project.pointB', project.pointB, 94],
        ['project.why', project.why, 93],
        ['project.milestone', project.milestone, 82]
      ].forEach(([source, value, priority]) => addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source,
        text: value,
        recordId: recordId(project),
        recordedAt: timestamp(project.updatedAt || project.createdAt),
        priority
      }));
      if (project.capacity) {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'project.capacity',
          text: `The person recorded their available capacity as ${text(project.capacity, 80).replace(/_/g, ' ')}. Capacity is planning context, not a score or measure of worth.`,
          recordId: recordId(project),
          recordedAt: timestamp(project.updatedAt || project.createdAt),
          priority: 96
        });
      }
      if (project.status && project.status !== 'active') {
        addItem(items, {
          epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
          source: 'project.status',
          text: `The most recent Project is ${text(project.status, 40)}. This is a journey status, not a judgment about the person.`,
          recordId: recordId(project),
          recordedAt: timestamp(project.updatedAt || project.createdAt),
          priority: 76
        });
      }
    }

    if (practice) {
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'practice.choice',
        text: `The person chose the Practice: ${text(practice.title, 220)}.`,
        recordId: recordId(practice),
        recordedAt: timestamp(practice.updatedAt || practice.createdAt),
        priority: 91
      });
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'practice.description',
        text: practice.description,
        recordId: recordId(practice),
        recordedAt: timestamp(practice.updatedAt || practice.createdAt),
        priority: 82
      });
    }

    const sortedAttempts = [...attempts].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    if (sortedAttempts.length) {
      const counts = sortedAttempts.reduce((result, attempt) => {
        const outcome = text(attempt.outcome, 40) || 'unknown';
        result[outcome] = (result[outcome] || 0) + 1;
        return result;
      }, {});
      const summary = Object.entries(counts).map(([outcome, count]) => `${count} ${outcome.replace(/_/g, ' ')}`).join(', ');
      addItem(items, {
        epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
        source: 'practice.history',
        text: `Recent Practice history contains ${sortedAttempts.length} recorded experience${sortedAttempts.length === 1 ? '' : 's'}: ${summary}. This is observation, not a compliance score.`,
        recordId: practice ? recordId(practice) : null,
        recordedAt: timestamp(sortedAttempts[0].createdAt),
        priority: 72
      });
      sortedAttempts.slice(0, 2).forEach(attempt => addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'practice.attemptNote',
        text: attempt.note,
        recordId: recordId(attempt),
        recordedAt: timestamp(attempt.createdAt),
        priority: 88
      }));
    }

    const recentReflection = latest(reflections);
    if (recentReflection) {
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'reflection.statement',
        text: recentReflection.statement,
        recordId: recordId(recentReflection),
        recordedAt: timestamp(recentReflection.createdAt),
        priority: 99
      });
      if (recentReflection.nextStep) {
        addItem(items, {
          epistemicStatus: PROVENANCE.USER_STATED,
          source: 'reflection.nextStep',
          text: `The person chose ${text(recentReflection.nextStep, 50)} as the next step after reflecting.`,
          recordId: recordId(recentReflection),
          recordedAt: timestamp(recentReflection.createdAt),
          priority: 97
        });
      }
    }

    [...learning]
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
      .slice(0, 3)
      .forEach(entry => addItem(items, {
        epistemicStatus: entry.provenance && entry.provenance.status === PROVENANCE.USER_CONFIRMED
          ? PROVENANCE.USER_CONFIRMED
          : PROVENANCE.USER_STATED,
        source: 'learning.statement',
        text: entry.statement,
        recordId: recordId(entry),
        recordedAt: timestamp(entry.updatedAt || entry.createdAt),
        priority: entry.confidence === 'confirmed' ? 100 : 89
      }));

    if (progress.length) {
      addItem(items, {
        epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
        source: 'progress.history',
        text: `${progress.length} progress event${progress.length === 1 ? ' is' : 's are'} recorded across practice, reflection, learning, adaptation, or completion.`,
        recordId: null,
        recordedAt: timestamp(latest(progress).createdAt),
        priority: 58
      });
    }

    const cycleCalendar = records.state.calendar;
    if (cycleCalendar && cycleCalendar.privacy && cycleCalendar.privacy.hello === true && root.MSHCycle) {
      const cycleEvents = root.MSHCycle.recordedCycleEvents(records.state);
      const segments = root.MSHCycle.periodSegments(records.state);
      const recent = cycleEvents.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
      if (segments.length) addItem(items, {
        epistemicStatus: PROVENANCE.SYSTEM_OBSERVED,
        informationClass: 'PERSONAL_OBSERVATION',
        source: 'cycle.recordedSummary',
        text: `${segments.length} period start${segments.length === 1 ? ' is' : 's are'} available from dates the person recorded. Predictions remain separate estimates and are not confirmations of ovulation or fertility.`,
        recordId: recent && recordId(recent), recordedAt: recent && timestamp(recent.updatedAt || recent.timestamp), priority: 86
      });
      if (recent) addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        informationClass: 'RECORDED',
        source: 'cycle.recentObservation',
        text: `On ${recent.date}, the person recorded ${recent.value.bleeding !== 'none' ? `${recent.value.bleeding} bleeding` : 'no bleeding'}${recent.value.symptoms.length ? ` and ${recent.value.symptoms.join(', ')}` : ''}.`,
        recordId: recordId(recent), recordedAt: timestamp(recent.updatedAt || recent.timestamp), priority: 87
      });
      if (cycleCalendar.privacy.patternAnalysis === true) {
        root.MSHCycle.calculatePatterns(records.state).slice(0, 2).forEach(pattern => addItem(items, {
          epistemicStatus: PROVENANCE.SYSTEM_OBSERVED, source: 'cycle.personalPattern',
          informationClass: 'PERSONAL_OBSERVATION',
          text: `${pattern.statement} This is a descriptive observation across ${pattern.cyclesIncluded} recorded cycles, not a diagnosis or causal claim.`,
          recordId: pattern.id, recordedAt: null, priority: 83
        }));
      }
    }

    const nextReturn = latest(returnPoints.filter(item => item && item.status !== 'completed'), ['remindAt', 'updatedAt', 'createdAt']);
    if (nextReturn) {
      addItem(items, {
        epistemicStatus: PROVENANCE.USER_STATED,
        source: 'returnPoint.choice',
        text: nextReturn.note || 'The person chose a future point to return to this.',
        recordId: recordId(nextReturn),
        recordedAt: timestamp(nextReturn.updatedAt || nextReturn.createdAt),
        priority: 70
      });
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, MAX_ITEMS);
  }

  function buildPossibility(position) {
    const choice = position.navigationChoice;
    if (choice === 'no_action') return null;
    if (choice === 'prepare') return null;

    const possibilities = {
      current_picture: 'One possibility is to build a current picture before deciding whether anything needs attention.',
      desired_direction: choice === 'preserve'
        ? 'One possibility is to explore what would help protect what is already working.'
        : choice === 'explore'
          ? 'One possibility is to stay curious about this area without turning it into a Project.'
          : 'One possibility is to clarify what you want to preserve, explore, develop, or adapt.',
      chosen_project: 'One possibility is to decide whether this direction matters enough to become a Project.',
      practice_experience: 'One possibility is to choose or revisit a Practice small enough to fit the capacity you described.',
      reflection: 'One possibility is to reflect on what helped, got in the way, or surprised you.',
      learning: 'One possibility is to decide whether anything from that reflection is useful to carry forward.',
      progress: 'One possibility is to review what has changed, what has been learned, and what still fits.',
      next_decision: 'One possibility is to keep, adapt, pause, complete, or leave the current approach alone.'
    };

    return {
      id: `journey-position:${position.key}`,
      epistemicStatus: PROVENANCE.MODEL_INFERRED,
      source: 'journey-position',
      text: possibilities[position.key],
      recordId: null,
      recordedAt: null,
      confirmed: false,
      requiresConfirmation: true,
      confirmationPrompt: 'Does that fit your experience?',
      priority: 10
    };
  }

  function buildHelloContext(state) {
    const position = recognizeJourneyPosition(state);
    const contextItems = buildContextItems(state);
    const possibility = buildPossibility(position);

    return {
      contractVersion: CONTRACT_VERSION,
      currentPosition: position,
      contextItems,
      possibilities: possibility ? [possibility] : [],
      guardrails: [
        'Never turn an inference into a fact.',
        'Never infer sensitive identity or characteristics from patterns.',
        'Do not prescribe a Project from Landscape results.',
        'Respect the recorded navigation choice.',
        'Treat capacity as context, not worth or compliance.'
      ]
    };
  }

  function getHelloBrief(state) {
    const records = getRecords(state);
    const context = buildHelloContext(state);
    const statements = [];

    if (records.focus && records.focus.label) {
      statements.push(`You said ${text(records.focus.label, 120)} matters enough to keep in view.`);
    }
    if (records.attempts.length) {
      statements.push(`Your recent Practice history shows ${records.attempts.length} recorded experience${records.attempts.length === 1 ? '' : 's'}.`);
    }
    const reflection = latest(records.reflections);
    if (reflection && reflection.statement) {
      statements.push(`You reflected that “${text(reflection.statement, 220)}”`);
    }
    if (context.currentPosition.navigationChoice === 'prepare') {
      statements.push('You chose Save for Later, so Hello should keep this visible without turning it into active work.');
    } else if (context.currentPosition.navigationChoice === 'no_action') {
      statements.push('You chose Leave It Alone, so Hello should not steer this toward a Project.');
    } else if (context.possibilities[0]) {
      statements.push(context.possibilities[0].text, context.possibilities[0].confirmationPrompt);
    }

    return {
      position: context.currentPosition,
      headline: `Hello can meet you at ${context.currentPosition.label.toLowerCase()}.`,
      message: statements.join(' ') || 'Hello can help you understand what is true now without deciding what you should do next.',
      hasJourneyData: context.contextItems.length > 0,
      context
    };
  }

  root.MSHIntelligence = Object.freeze({
    CONTRACT_VERSION,
    PROVENANCE,
    NAVIGATION_LABELS,
    POSITION_LABELS,
    recognizeJourneyPosition,
    buildContextItems,
    buildHelloContext,
    getHelloBrief
  });
})(typeof window !== 'undefined' ? window : globalThis);
