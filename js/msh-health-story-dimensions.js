/* My Simple Health — wellness dimension classification for Health Story */
(function (root) {
  'use strict';

  const DIMENSIONS = Object.freeze({
    physical: { id: 'physical', label: 'Physical' },
    emotional: { id: 'emotional', label: 'Emotional' },
    social: { id: 'social', label: 'Social' },
    environment: { id: 'environment', label: 'Environment' },
    work_responsibilities: { id: 'work_responsibilities', label: 'Work & Responsibilities' },
    financial: { id: 'financial', label: 'Financial' },
    mental_engagement: { id: 'mental_engagement', label: 'Mental Engagement' },
    what_matters: { id: 'what_matters', label: 'What Matters' },
    whole_life: { id: 'whole_life', label: 'Whole Life' }
  });

  const RULES = [
    {
      dimension: DIMENSIONS.physical,
      confidence: 0.98,
      source: 'activity_type',
      terms: [
        'workout','pilates','yoga','run','running','walk','walking','strength','lifting','weights',
        'cardio','cycling','bike','swim','swimming','hiit','mobility','stretch','exercise','gym',
        'movement','steps','sleep','heart rate','blood pressure','medication','doctor','appointment',
        'healthkit','apple health','body weight','weight','nutrition','meal','food'
      ]
    },
    {
      dimension: DIMENSIONS.social,
      confidence: 0.94,
      source: 'inferred',
      terms: [
        'birthday','anniversary','date night','dinner with','lunch with','brunch with','coffee with',
        'family','friend','friends','mom','mother','dad','father','sister','brother','husband','wife',
        'partner','wedding','party','visit','hangout','social','reunion'
      ]
    },
    {
      dimension: DIMENSIONS.financial,
      confidence: 0.94,
      source: 'inferred',
      terms: ['bill','budget','payment','payday','bank','banking','credit card','loan','mortgage','rent','expense','financial','money','insurance payment']
    },
    {
      dimension: DIMENSIONS.mental_engagement,
      confidence: 0.92,
      source: 'inferred',
      terms: ['class','study','studying','homework','assignment','lecture','exam','quiz','course','school','university','reading','research','learning','practice test']
    },
    {
      dimension: DIMENSIONS.work_responsibilities,
      confidence: 0.91,
      source: 'inferred',
      terms: ['work','meeting','deadline','shift','project','appointment with client','job','interview','presentation','task','errand','chores','responsibility']
    },
    {
      dimension: DIMENSIONS.emotional,
      confidence: 0.90,
      source: 'inferred',
      terms: ['therapy','counseling','journal','journaling','stress','anxiety','mood','emotion','emotional','grief','coping','reflection','meditation','breathwork']
    },
    {
      dimension: DIMENSIONS.environment,
      confidence: 0.90,
      source: 'inferred',
      terms: ['home','garden','gardening','cleaning','air quality','environment','outdoors','nature','park','yard','house','workspace']
    },
    {
      dimension: DIMENSIONS.what_matters,
      confidence: 0.88,
      source: 'inferred',
      terms: ['church','faith','prayer','pray','worship','spiritual','purpose','values','volunteer','service','meaning']
    }
  ];

  function clean(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function contributionText(item) {
    return [
      item && item.title,
      item && item.summary,
      item && item.detail,
      item && item.sourceType,
      ...(Array.isArray(item && item.domainTags) ? item.domainTags : [])
    ].map(clean).filter(Boolean).join(' ');
  }

  function explicitDimension(item) {
    const candidates = [
      item && item.wellnessDimension,
      item && item.dimension,
      item && item.primaryDimension,
      ...(Array.isArray(item && item.domainTags) ? item.domainTags : [])
    ].map(clean).filter(Boolean);

    for (const candidate of candidates) {
      for (const dimension of Object.values(DIMENSIONS)) {
        const aliases = [dimension.id, dimension.label, dimension.label.replace(/ & /g, ' and ')].map(clean);
        if (aliases.includes(candidate)) {
          return {
            primary: dimension,
            dimensions: [dimension],
            source: 'explicit',
            confidence: 1
          };
        }
      }
    }
    return null;
  }

  function classify(item) {
    const explicit = explicitDimension(item);
    if (explicit) return explicit;

    const haystack = contributionText(item);
    const matches = RULES.map(rule => ({
      ...rule,
      matchedTerms: rule.terms.filter(term => haystack.includes(term))
    })).filter(rule => rule.matchedTerms.length);

    if (!matches.length) {
      return {
        primary: DIMENSIONS.whole_life,
        dimensions: [DIMENSIONS.whole_life],
        source: 'inferred',
        confidence: 0.40,
        matchedTerms: []
      };
    }

    matches.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.matchedTerms.length - a.matchedTerms.length;
    });

    const primary = matches[0];
    const dimensions = [];
    matches.forEach(match => {
      if (!dimensions.some(item => item.id === match.dimension.id)) dimensions.push(match.dimension);
    });

    return {
      primary: primary.dimension,
      dimensions: dimensions.slice(0, 3),
      source: primary.source,
      confidence: primary.confidence,
      matchedTerms: primary.matchedTerms
    };
  }

  function enrichContribution(item) {
    if (!item || typeof item !== 'object') return item;
    const classification = classify(item);
    return {
      ...item,
      wellnessDimension: classification.primary,
      wellnessDimensions: classification.dimensions,
      dimensionClassification: {
        source: classification.source,
        confidence: classification.confidence,
        matchedTerms: classification.matchedTerms || []
      }
    };
  }

  function install() {
    if (!root.MSHHealthStory || root.MSHHealthStory.__dimensionClassifierInstalled) return false;

    const originalGetContributions = root.MSHHealthStory.getContributions.bind(root.MSHHealthStory);
    const originalBuildSnapshot = root.MSHHealthStory.buildSnapshot.bind(root.MSHHealthStory);

    root.MSHHealthStory.getContributions = function getContributionsWithDimensions(state) {
      return originalGetContributions(state).map(enrichContribution);
    };

    root.MSHHealthStory.buildSnapshot = function buildSnapshotWithDimensions(state) {
      const snapshot = originalBuildSnapshot(state);
      const contributions = root.MSHHealthStory.getContributions(state).filter(item => item.inclusion !== 'excluded');
      const counts = contributions.reduce((result, item) => {
        const id = item.wellnessDimension && item.wellnessDimension.id || 'whole_life';
        result[id] = (result[id] || 0) + 1;
        return result;
      }, {});
      return { ...snapshot, dimensionCounts: counts };
    };

    root.MSHHealthStory.classifyWellnessDimension = classify;
    root.MSHHealthStory.enrichWithWellnessDimension = enrichContribution;
    root.MSHHealthStory.WELLNESS_DIMENSIONS = DIMENSIONS;
    root.MSHHealthStory.__dimensionClassifierInstalled = true;
    return true;
  }

  root.MSHHealthStoryDimensions = {
    DIMENSIONS,
    classify,
    enrichContribution,
    install
  };

  install();
})(typeof window !== 'undefined' ? window : globalThis);
