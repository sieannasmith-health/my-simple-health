# MSH Mobile Product Objective — 2026-09-09

Status: APPROVED FOR IMPLEMENTATION
Owner: Selah (Engineering)
UX: Mira
Product: Nomy
Delivery target: TestFlight

## Founder direction
The active product objective is the iPhone application. Design reviews, handoffs, and web prototypes do not satisfy this objective by themselves. Work is complete only when the requested mobile changes are implemented in the iOS codebase, validated, and delivered in a new TestFlight build for Siea to test.

## Immediate implementation slice
1. Preserve the current native SwiftUI shell: My Health / Explore / Simple / Progress / Me.
2. Improve My Health -> Ask Simple -> conversation continuity so Simple feels like part of the iOS product rather than a disconnected web destination.
3. Implement member message correction in Simple:
   - long-press an own sent message
   - Edit action
   - editable message with Save and Cancel
   - subtle Edited indicator after save
   - only member messages editable
   - corrected message replaces the old text as conversational truth
   - downstream Simple reasoning must no longer use the superseded text; regenerate/re-evaluate affected downstream response/context when appropriate
   - preserve required audit/history behind the visible experience
4. Maintain native accessibility: 44pt+ interactive targets, VoiceOver labels/traits, Dynamic Type where native, text state equivalents, and Reduce Motion behavior.
5. Do not add decorative glass or motion. Movement must communicate activity, state, relationship, progress, or accomplishment.

## Acceptance path
My Health -> Ask Simple -> send member message -> long-press -> Edit -> Save -> Edited indicator -> Simple uses corrected content -> return to My Health.

## Delivery definition
- Code implemented in the iOS/TestFlight path.
- Tests/build checks pass.
- New TestFlight build uploaded and available to Siea.
- Post `📱 SIEA CHECK` only after the build is actually available, with build number and exact test steps.

This objective supersedes continued HelloSimple web refinement until the mobile slice is delivered, unless Nomy explicitly reprioritizes.