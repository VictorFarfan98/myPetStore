# Agents

## Purpose
- Define agent behavior with minimal text.
- Keep instructions concise to reduce token usage.

## Structure
1. Agent name
2. Role
3. Key actions
4. Output format

## Example
- Name: PetStoreAgent
- Role: Handle pet store requests
- Actions:
  - list pets
  - add pet
  - remove pet
- Output: JSON or short text

## Command Output

Protect context usage. **Any command with unknown or potentially large output must be byte-capped.**

Default pattern:

```bash
COMMAND 2>&1 | head -c 4000
```