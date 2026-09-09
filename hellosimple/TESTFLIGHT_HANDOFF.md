# HelloSimple TestFlight Handoff — Mira UX Prototype

## Source of truth
Prototype branch: `mira/hellosimple-ux-85-prototype`

## Objective
Bring the updated HelloSimple employee experience into the iOS/TestFlight review path so Siea can evaluate it on-device.

## Product loop to preserve
Today -> Work -> Mission Workspace -> Ask Hello -> Evidence -> Completion -> Growth -> Impact

## Required UX changes from Mira prototype

### Navigation
Use five primary destinations:
- Today
- Work
- Workers
- Growth
- Impact

### Today
- Strong "Your next move" hierarchy
- Needs You
- AI working / kinetic worker state
- Schedule
- Journey progress
- Impact snapshot

### Mission Workspace
- Mission definition / definition of done
- Step-by-step execution
- Hello Workers helping
- Skills being demonstrated
- Evidence/decision capture
- Evidence must exist before mission completion

### Help & Assistance
Every mission must expose:
- Ask AI
- Show me
- Steps
- Troubleshoot
- Contact support

The system should preserve work before troubleshooting and escalate unresolved blockers rather than pretending AI solved them.

### Kinetic information
Use motion/state change to communicate:
- worker activity
- loading/preparation
- progress
- completion
- milestone advancement

Motion must have a reduced-motion equivalent and no critical information may depend on animation alone.

### Growth / motivation
Progression should explain:
- current level
- next level
- distance remaining
- capability required
- what changes when unlocked

Celebration must explain:
1. what the employee accomplished
2. why it mattered to MSH
3. which skill was strengthened
4. what it moved them toward

### Impact
Verified work creates inspectable professional evidence. Do not treat a completion tap alone as verified evidence.

## TestFlight acceptance path
Siea should be able to complete this on-device without explanation:
1. Open HelloSimple
2. See the next move
3. Start a mission
4. Use Show me
5. Use Ask AI / assistance
6. Enter evidence
7. Submit mission
8. See meaningful celebration
9. Open Growth
10. Open Impact and see the recorded contribution

## Product boundary
This is a Mira design/UX handoff. Selah owns the iOS implementation and TestFlight delivery. Nomy should confirm sequencing if the current engineering objective conflicts with this handoff.
