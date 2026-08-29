# MSH Navigation Continuity

`js/msh-routes.js` is the canonical source for primary My Simple Health destinations and their route class. Components should request a named route from `MSHRoutes` instead of independently deciding whether a primary destination belongs to the private application or public site.

## Private MSH

- My Health — `my-health.html`
- Explore — `my-health.html?view=explore`
- Tools — `my-health.html?view=tools`
- Calendar — `calendar.html`
- Health Landscape — `health-landscape.html`
- Assessments — `assessments.html`
- Horizon — `my-vision.html`
- Path — `my-project.html`
- Practice — `my-practice.html`
- Discovery — `my-learning.html`
- Journey — `my-progress.html`
- Cycle — `calendar.html?view=cycle`
- Movement — `calendar.html?view=movement`
- Hello intelligence — `hello.html` (preserved, but not restored to primary navigation)

`my-landscape.html` remains preserved for its historical/internal implementation and capacity-state compatibility. It is not the canonical Health Landscape doorway. `wellness-wheel.html` remains a deprecated redirect only.

## Public MSH

- Public home — `index.html`
- Science and health topics — `topics.html`
- Public resources — `resources.html`
- Recipes — `recipes.html`
- Public articles, topic pages, guides, legal pages, About, and Contact

Public pages retain their editorial presentation. A link from Private MSH to these pages must read as a doorway to public education, not as a primary app tab.

## External

Absolute off-origin URLs, `mailto:`, and `tel:` destinations are departures from My Simple Health. The route runtime classifies them as `EXTERNAL` and does not present them as private application rooms.

## Transition vocabulary

- Private → Private directory: `glide`
- Private → activity: `open`
- Activity → My Health: `return`
- Private → Public: `doorway`
- Private → External: `departure`

These labels describe continuity and may support restrained feedback. They must not delay navigation.

## Shared state

Every active private page loads the shared theme, environment clock, sensory preference, personal accent, sound preference, core typography, and application shell. Browser history remains the default return mechanism. The route runtime records only lightweight session navigation context; it does not replace browser history or duplicate application data.
