# Movement editing requirements

Movement records should be editable after creation without deleting and recreating the record.

## MSH-created movement

Editing should preserve the existing movement ID and update the same record. Editable fields include:

- title
- date and time
- duration
- movement type
- intensity
- sets
- reps
- weight
- distance
- notes
- completion status
- calendar scheduling metadata when present
- associated YouTube/library metadata when applicable

## Apple Health movement

Apple Health source data is immutable from MSH. MSH may attach and edit first-party context around an imported HealthKit record, including notes and completion/context fields, without overwriting the HealthKit source record.

## Save behavior

Saving an edit must not create a duplicate movement. Persistence should address the record by its stable movement ID and update the existing entry in place.
