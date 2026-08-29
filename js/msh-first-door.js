/* My Simple Health — Gate A.1 first-use intent routing */
(function (root) {
  'use strict';

  const intents = Object.freeze([
    {
      id: 'health_question',
      label: 'I have a health question',
      prompt: 'What would you like help understanding?',
      placeholder: 'Ask the question in your own words…',
      optional: false,
      orientation: 'Explore evidence-informed health information and choose the depth that is useful to you. General education does not diagnose you or decide what your question means for your life.',
      primary: { label: 'Explore health information', href: 'topics.html' }
    },
    {
      id: 'not_working',
      label: 'Something isn’t working for me',
      prompt: 'What feels off, difficult, or less workable than you want right now?',
      placeholder: 'Share only what feels useful to begin…',
      optional: true,
      orientation: 'You do not need to decide whether this is a problem, goal, or something to fix. You can look at what is happening in context before choosing what—if anything—you want to do.',
      primary: { label: 'Look at my broader picture', href: 'my-landscape.html' },
      secondary: { label: 'Explore health information', href: 'topics.html' }
    },
    {
      id: 'work_on_something',
      label: 'I want to work on something',
      prompt: 'What would you like to work on right now?',
      placeholder: 'For example, something you want to change, build, protect, or make more workable…',
      optional: false,
      orientation: 'You can begin with what matters now without completing a broad assessment first. My Project will help you describe where things are, what you want to be different, and a realistic first sign of movement.',
      primary: { label: 'Start with a Project', href: 'my-project.html' }
    },
    {
      id: 'care_support',
      label: 'I’m looking for care or support',
      prompt: 'What kind of care or support would be useful to think about?',
      placeholder: 'You can name the concern, the kind of visit, or what you need help finding…',
      optional: true,
      orientation: 'You can explore existing resources or use this space to organize what you want to ask during a future visit. My Simple Health does not currently provide a verified provider directory.',
      primary: { label: 'Explore available resources', href: 'resources.html' }
    },
    {
      id: 'clearer_picture',
      label: 'I want a clearer picture of my health',
      prompt: '',
      placeholder: '',
      optional: true,
      orientation: 'Landscape can begin with one question and return something useful after each answer. You can stop with a partial picture, say you are not sure, or leave an area open.',
      primary: { label: 'Begin with one question', href: 'my-landscape.html?start=dimensions' }
    },
    {
      id: 'exploring',
      label: 'I’m just exploring',
      prompt: '',
      placeholder: '',
      optional: true,
      orientation: 'You can look around without sharing personal information. See how the personal workspace works, explore a broader health picture, or browse general health topics.',
      primary: { label: 'See the broader workspace', href: 'my-health.html?view=workspace' },
      secondary: { label: 'Browse health topics', href: 'topics.html' }
    }
  ]);

  function getIntent(id) {
    return intents.find(intent => intent.id === id) || null;
  }

  function hasMeaningfulContext(state) {
    const source = state && typeof state === 'object' ? state : {};
    const lists = ['landscapes','focuses','visionEntries','projects','practices','practiceAttempts','reflections','learningEntries','progressEvents','returnPoints'];
    return Boolean(
      source.wellnessWheel && source.wellnessWheel.current ||
      lists.some(key => Array.isArray(source[key]) && source[key].length) ||
      source.calendar && Array.isArray(source.calendar.events) && source.calendar.events.length
    );
  }

  function helloDraft(intent, context) {
    const value = String(context || '').trim();
    if (!value) return '';
    if (intent === 'health_question') return value;
    if (intent === 'not_working') return `Something isn’t working for me: ${value}`;
    if (intent === 'care_support') return `I’m looking for care or support with: ${value}`;
    return value;
  }

  root.MSHFirstDoor = Object.freeze({ intents, getIntent, hasMeaningfulContext, helloDraft });
})(typeof window !== 'undefined' ? window : globalThis);
