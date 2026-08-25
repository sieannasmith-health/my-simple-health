/* My Simple Health — Wellbeing Landscape prototype candidate item registry
   This is an evidence-informed reflection prototype, not a validated instrument. */
(function () {
  'use strict';

  const scales = {
    fit5: [
      { value: 'not_at_all', label: 'Not at all', signal: 'attention' },
      { value: 'a_little', label: 'A little', signal: 'attention' },
      { value: 'somewhat', label: 'Somewhat', signal: 'mixed' },
      { value: 'mostly', label: 'Mostly', signal: 'fit' },
      { value: 'very_well', label: 'Very well', signal: 'fit' }
    ],
    amountFit5: [
      { value: 'much_too_little', label: 'Much too little', signal: 'attention', direction: 'low' },
      { value: 'a_little_too_little', label: 'A little too little', signal: 'mixed', direction: 'low' },
      { value: 'about_right', label: 'About right', signal: 'fit', direction: 'fit' },
      { value: 'a_little_too_much', label: 'A little too much', signal: 'mixed', direction: 'high' },
      { value: 'much_too_much', label: 'Much too much', signal: 'attention', direction: 'high' }
    ],
    frequencyPositive5: [
      { value: 'rarely', label: 'Rarely', signal: 'attention' },
      { value: 'not_often', label: 'Not often', signal: 'attention' },
      { value: 'sometimes', label: 'Sometimes', signal: 'mixed' },
      { value: 'often', label: 'Often', signal: 'fit' },
      { value: 'almost_always', label: 'Almost always', signal: 'fit' }
    ],
    frequencyBurden5: [
      { value: 'rarely', label: 'Rarely', signal: 'fit' },
      { value: 'not_often', label: 'Not often', signal: 'fit' },
      { value: 'sometimes', label: 'Sometimes', signal: 'mixed' },
      { value: 'often', label: 'Often', signal: 'attention' },
      { value: 'almost_always', label: 'Almost always', signal: 'attention' }
    ],
    manageability5: [
      { value: 'not_manageable', label: 'Not manageable', signal: 'attention' },
      { value: 'barely_manageable', label: 'Barely manageable', signal: 'attention' },
      { value: 'somewhat_manageable', label: 'Somewhat manageable', signal: 'mixed' },
      { value: 'mostly_manageable', label: 'Mostly manageable', signal: 'fit' },
      { value: 'very_manageable', label: 'Very manageable', signal: 'fit' }
    ]
  };

  const domains = [
    { id: 'physical', label: 'Physical', description: 'Energy, restoration, physical function, and interference.' },
    { id: 'emotional', label: 'Emotional', description: 'Understanding emotions and responding when they are difficult.' },
    { id: 'social', label: 'Social', description: 'Connection, usable support, relationship quality, and interaction fit.' },
    { id: 'environment', label: 'Environment', description: 'Safety, comfort, and whether your surroundings support everyday life.' },
    { id: 'work', label: 'Work & Responsibilities', description: 'The value, function, and fit of the responsibilities you carry.' },
    { id: 'financial', label: 'Financial', description: 'Sufficiency, strain, and room for unexpected needs.' },
    { id: 'mental', label: 'Mental Engagement', description: 'Whether the amount and kind of mental engagement fit you.' },
    { id: 'meaning', label: 'What Matters', description: 'Meaning, direction, and alignment with what matters to you.' },
    { id: 'whole', label: 'Whole Life', description: 'How manageable your overall plate feels and how well the pieces fit together.' }
  ];

  const items = [
    {
      id: 'PHY-01', domain: 'physical', construct: 'energy',
      prompt: 'How well does your physical energy support the things you need and want to do?',
      why: 'This looks at whether your available physical energy supports everyday life, not how productive or active you are.',
      options: scales.fit5
    },
    {
      id: 'PHY-02', domain: 'physical', construct: 'restoration',
      prompt: 'How often do you feel physically restored enough for the life you are living?',
      why: 'Restoration is about whether your body feels replenished enough for your current demands.',
      options: scales.frequencyPositive5
    },
    {
      id: 'PHY-03', domain: 'physical', construct: 'meaningful_function',
      prompt: 'How well can your body do the everyday things that matter to you?',
      why: 'This focuses on personally meaningful function rather than comparing your ability with anyone else.',
      options: scales.fit5
    },
    {
      id: 'PHY-04', domain: 'physical', construct: 'interference',
      prompt: 'How often do physical symptoms, discomfort, or limitations interfere with the things you need or want to do?',
      why: 'This asks about interference with your life. It does not diagnose the reason for that interference.',
      options: scales.frequencyBurden5
    },

    {
      id: 'EMO-01', domain: 'emotional', construct: 'clarity',
      prompt: 'How well can you usually make sense of what you are feeling?',
      why: 'Emotional clarity is the ability to recognize and understand your emotional experience, not the absence of difficult emotions.',
      options: scales.fit5
    },
    {
      id: 'EMO-02', domain: 'emotional', construct: 'response_capacity',
      prompt: 'When emotions are difficult, how well can you respond in ways that work for you and the situation?',
      why: 'This asks about your ability to respond to emotions, not whether you experience them.',
      options: scales.fit5
    },

    {
      id: 'SOC-01', domain: 'social', construct: 'unwanted_disconnection',
      prompt: 'How often do you feel more disconnected from other people than you want to be?',
      why: 'The focus is unwanted disconnection. A small social life is not automatically a problem if it fits you.',
      options: scales.frequencyBurden5
    },
    {
      id: 'SOC-02', domain: 'social', construct: 'support_availability',
      prompt: 'When you genuinely need support, how available does it feel to you?',
      why: 'This asks whether support is available when needed, not how many people are in your network.',
      options: scales.fit5
    },
    {
      id: 'SOC-03', domain: 'social', construct: 'support_fit',
      prompt: 'How well does the support available to you fit the kind of help you would actually want?',
      why: 'Support can exist without being the right kind of support for the situation or the person.',
      options: scales.fit5
    },
    {
      id: 'SOC-04', domain: 'social', construct: 'relationship_quality',
      prompt: 'Overall, how well do your important relationships work for you right now?',
      why: 'This is a broad relationship-quality reflection. You can add context if one relationship differs from the overall picture.',
      options: scales.fit5
    },
    {
      id: 'SOC-05', domain: 'social', construct: 'interaction_amount_fit',
      prompt: 'How does the amount of social interaction in your life feel for you right now?',
      why: 'More interaction is not automatically better. This asks whether the amount fits you.',
      options: scales.amountFit5
    },

    {
      id: 'ENV-01', domain: 'environment', construct: 'safety',
      prompt: 'How safe do the environments where you spend most of your time generally feel?',
      why: 'This asks about your lived sense of safety in your usual environments.',
      options: scales.fit5
    },
    {
      id: 'ENV-02', domain: 'environment', construct: 'comfort',
      prompt: 'How comfortable are the environments where you spend most of your time?',
      why: 'Comfort can include noise, temperature, privacy, crowding, sensory conditions, and other features that affect daily life.',
      options: scales.fit5
    },
    {
      id: 'ENV-03', domain: 'environment', construct: 'functional_support',
      prompt: 'How well do your surroundings support the everyday things you need and want to do?',
      why: 'This looks at whether your environment makes everyday functioning easier or harder.',
      options: scales.fit5
    },

    {
      id: 'WRK-01', domain: 'work', construct: 'role_value',
      prompt: 'How worthwhile do your current responsibilities feel to you overall?',
      why: 'Responsibilities can include paid work, school, homemaking, parenting, caregiving, personal management, and other meaningful roles.',
      options: scales.fit5
    },
    {
      id: 'WRK-02', domain: 'work', construct: 'role_function',
      prompt: 'How workable is the way your current responsibilities are structured?',
      why: 'This asks whether the structure of your responsibilities works in practice, not whether the responsibilities are easy.',
      options: scales.fit5
    },
    {
      id: 'WRK-03', domain: 'work', construct: 'role_fit',
      prompt: 'How well do your current responsibilities fit the life you are trying to live?',
      why: 'A role can be meaningful and still fit poorly with other important parts of life.',
      options: scales.fit5
    },

    {
      id: 'FIN-01', domain: 'financial', construct: 'sufficiency',
      prompt: 'How well are your current financial resources covering the things you need?',
      why: 'This is about sufficiency relative to your actual needs, not income level or comparison with other people.',
      options: scales.fit5
    },
    {
      id: 'FIN-02', domain: 'financial', construct: 'strain',
      prompt: 'How often does managing current financial needs feel difficult or stressful?',
      why: 'Financial strain describes the burden of maintaining current needs, even when those needs may technically be met.',
      options: scales.frequencyBurden5
    },
    {
      id: 'FIN-03', domain: 'financial', construct: 'margin',
      prompt: 'How much room do your finances currently have for an unexpected need or change?',
      why: 'Margin asks whether the current financial system has room to absorb disruption.',
      options: [
        { value: 'none', label: 'None', signal: 'attention' },
        { value: 'very_little', label: 'Very little', signal: 'attention' },
        { value: 'some', label: 'Some', signal: 'mixed' },
        { value: 'a_good_amount', label: 'A good amount', signal: 'fit' },
        { value: 'plenty', label: 'Plenty', signal: 'fit' }
      ]
    },

    {
      id: 'MEN-01', domain: 'mental', construct: 'amount_fit',
      prompt: 'How does the amount of mental engagement in your life feel right now?',
      why: 'Mental engagement includes concentrating, learning, planning, problem-solving, and other sustained mental effort. More is not automatically better.',
      options: scales.amountFit5
    },
    {
      id: 'MEN-02', domain: 'mental', construct: 'kind_fit',
      prompt: 'How well do the kinds of things engaging your mind fit your interests, needs, or what matters to you?',
      why: 'This separates the amount of mental engagement from whether the content itself feels worthwhile or fitting.',
      options: scales.fit5
    },

    {
      id: 'MAT-01', domain: 'meaning', construct: 'meaning',
      prompt: 'How much does your life currently include things that feel meaningful to you?',
      why: 'Meaning is personal. This does not assume which activities, roles, beliefs, or relationships should provide it.',
      options: scales.fit5
    },
    {
      id: 'MAT-02', domain: 'meaning', construct: 'direction',
      prompt: 'How clear does your current sense of direction feel?',
      why: 'Direction can be clear, emerging, or uncertain. Uncertainty is not automatically a problem unless it matters to you.',
      options: scales.fit5
    },
    {
      id: 'MAT-03', domain: 'meaning', construct: 'alignment',
      prompt: 'How well does the way you are living currently line up with what matters to you?',
      why: 'This asks about alignment between everyday life and what you consider important.',
      options: scales.fit5
    },

    {
      id: 'WHO-01', domain: 'whole', construct: 'capacity',
      prompt: 'How manageable does everything you are carrying feel right now?',
      why: 'This looks at your overall plate. Time, mental energy, physical energy, emotional demand, responsibility, and other demands can all affect manageability.',
      options: scales.manageability5
    },
    {
      id: 'WHO-02', domain: 'whole', construct: 'integration',
      prompt: 'How well are the important parts of your life working together right now?',
      why: 'This asks whether important parts of life can coexist without unnecessary conflict, not whether every part is equally important.',
      options: scales.fit5
    }
  ];

  window.MSHLandscapeConfig = {
    version: 'WL-PROTOTYPE-1',
    scales,
    domains,
    items
  };
})();
