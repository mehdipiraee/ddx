# Revised Workflow Analysis

## What You're Proposing

```
1. AI reads prompt template → finds first question
2. AI generates suggestions → writes directly to document + shows in CLI
3. Human chooses:
   Option A: Answer in CLI → AI updates document
   Option B: Edit document → Signal AI (e.g., press Enter) → AI reads changes
4. Repeat for next question
```

## Example Flow

```bash
ddx create prd

AI reads template: "Who are your target users?"
AI writes to prd.md:
---
## Target Users
<!-- Suggestions:
- Young professionals (25-35)
- Health-conscious millennials
- Fitness enthusiasts with busy schedules
-->

AI in CLI:
❓ Who are your target users?

   Suggestions written to sotdocs/prd.md

   Choose:
   1. Answer here: [type response]
   2. Edit document: [press 'e' then Enter when done]

User types: "e"
[Opens editor or waits]

User edits prd.md:
## Target Users
Busy parents aged 30-45 who want quick home workouts

User presses Enter in CLI

AI: ✓ Got it. Moving to next question...
AI reads template: "What problem does this solve?"
...
```

## Why This Works

**✅ Best of both worlds:**
- CLI users can stay in terminal
- Document-first users can edit directly
- **Document is always up-to-date** (no separate sync step)

**✅ Solves context problem:**
- Each question = 1-2 messages max
- Total conversation = number of template questions (5-10 messages)
- Document on disk = source of truth

**✅ Simple state:**
- Track: "Currently on question 3 of 8"
- No need to track conversation history
- Just read document for context

## Key Design Decisions

### 1. Signal Mechanism

**Option A: Explicit command**
```bash
User edits file → Runs: ddx continue prd
```

**Option B: Interactive mode**
```bash
User edits file → Presses Enter in CLI
```

**Option C: File watching**
```bash
User edits file → AI auto-detects save
```

**Recommendation:** Start with **Option A** (explicit), add B later for REPL mode.

### 2. Suggestion Format in Document

```markdown
## Target Users
<!-- AI Suggestions (delete after editing):
- Young professionals (25-35) seeking work-life balance
- Health-conscious individuals tracking fitness goals
- Beginners wanting guided workout plans
-->

[Your answer here]
```

**Human deletes suggestions and writes their answer.**

### 3. State Tracking

```json
{
  "conversationId": "create_prd_2026-03-03",
  "documentType": "prd",
  "currentQuestion": 3,
  "totalQuestions": 8,
  "answeredQuestions": ["target_users", "problem_statement"]
}
```

**Simple:** Just track question number, not full conversation.

## Implementation in ssd.md

### Updated Document Creation Flow:

```markdown
1. AI reads prompt template (e.g., prd_prompt.md)
2. AI extracts first question
3. AI generates contextual suggestions
4. AI writes suggestions to document as comments
5. AI prompts user: "Answer in CLI or edit document"
6. User responds:
   - If CLI: AI updates document with response
   - If document: User signals completion, AI reads changes
7. AI validates answer, moves to next question
8. Repeat until all questions answered
9. AI generates final polished document
```

### State Schema:

```json
{
  "conversationId": "create_prd_2026-03-03",
  "documentType": "prd",
  "mode": "template_driven",
  "currentQuestion": 3,
  "totalQuestions": 8,
  "status": "in_progress"
}
```

**No message history needed.**

## Context Management Impact

**Your approach eliminates the context problem:**

- **Old way:** 50 messages about changes → 150k tokens
- **Your way:** 8 questions × 2 messages each = 16 messages total → 5k tokens

**You stay under 20 messages for entire document creation.**

## What I Think

**This is even better than my earlier analysis.**

**Why:**
1. ✅ Structured (template-driven, predictable)
2. ✅ Flexible (CLI or file editing)
3. ✅ Minimal context (just current question)
4. ✅ Document is always source of truth
5. ✅ Natural progression (one question at a time)

**One concern:**
- Templates must be well-designed (questions must be clear)
- Need good default suggestions (not generic fluff)

**Recommendation:**
**Implement this as the v1.0 workflow.** It's simpler, cleaner, and naturally bounded.
