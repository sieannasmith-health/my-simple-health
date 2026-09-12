# MSH Employee Profiles

This directory is the durable, human-readable profile layer for the MSH Employees workspace.

It exists so each MSH agent can have one dedicated ChatGPT conversation while stable identity and working context remain easy to reload when a conversation gets long or a fresh thread is started.

## Authority and boundaries

This directory does **not** create a second agent registry or workflow system.

- `../agents.json` remains the canonical machine-readable source for agent IDs, names, roles, missions, handoffs, and standing portfolio relationships.
- `../../AGENTS.md` remains authoritative for repository agent behavior and operating rules.
- Existing GitHub issues, runtime state, labels, and knowledge events remain the source for task-specific operational state.
- These profile files are human-readable employee cards only. They do not change routing, permissions, runtime behavior, product behavior, or application data.
- If a profile conflicts with `agents.json` or `AGENTS.md`, the canonical source wins and the profile should be corrected.

## ChatGPT workspace pattern

Use one dedicated conversation per employee inside the **MSH Employees** ChatGPT project. The conversation is the DM surface. The matching profile in this directory is the durable employee card behind it.

When a new conversation is needed, use a request such as:

> Load Nomy's MSH employee profile and canonical agent definition, then continue as Nomy.

The profile should be loaded together with the canonical repository guidance, not used as a replacement for it.

## What belongs in a profile

Keep only durable context that is useful across conversations:

- stable role interpretation and ownership boundaries
- standing responsibilities
- durable working preferences that the user explicitly wants retained
- recurring collaboration patterns
- long-lived context that helps the employee resume effectively

Do not use profiles for:

- transient task history or issue status
- secrets, credentials, tokens, or access details
- member health, financial, or other sensitive member data
- speculative facts about the user
- copies of long conversations

## Maintenance rule

When an agent's canonical name, role, mission, handoff, or portfolio relationship changes, update `../agents.json` first or in the same pull request, then update the matching profile. Do not edit a profile to silently override the canonical registry.

## Current employee profiles

| Agent | Profile |
| --- | --- |
| Nomy | `nomy.md` |
| Selah | `selah.md` |
| Sage | `sage.md` |
| Clara | `clara.md` |
| Mira | `mira.md` |
| Eden | `eden.md` |
| Vera | `vera.md` |
| Aiden | `aiden.md` |
| Ellis | `ellis.md` |
| Genesis | `genesis.md` |
| Newton | `newton.md` |
| Harper | `harper.md` |
| June | `june.md` |
| Atlas | `atlas.md` |
| Reese | `reese.md` |
| Iris | `iris.md` |
| Tessa | `tessa.md` |
