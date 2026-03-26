# Context Management: The High-Level Story

## The Core Problem

Imagine you're having a conversation with an AI to write a document. You go back and forth:

```
You: "I want to build a fitness app"
AI: "Tell me about your users"
You: "Health-conscious millennials..."
AI: "What features matter most?"
You: "Workout tracking, social sharing..."
... 50 more exchanges ...
```

**The issue:** Every time you say "continue," the AI needs to read the ENTIRE conversation history to understand context. After 50 exchanges, you're sending a novel-length chat history with every message.

**Three bad things happen:**
1. **Eventually breaks** - Claude has a ~200k word limit. You'll hit it and crash.
2. **Gets expensive** - You pay per word sent. Long histories = $5-10 per message.
3. **Gets slow** - More to read = longer to process = 10+ second waits.

---

## Five Possible Solutions

### 1. **"I'm Sorry, We're Closed"** (Fixed Reset)

**The idea:** After 15-20 messages, stop and tell the user "conversation full, start over."

**Like:** A restaurant that kicks you out after 90 minutes whether you're done or not.

**Good:**
- Dead simple
- Never breaks
- Very safe

**Bad:**
- Annoying
- Interrupts flow
- Feels like a limitation

**Verdict:** Works but feels cheap. Users will complain.

---

### 2. **"Fresh Start with Your Work So Far"** (Auto-Reset) ⭐ **RECOMMENDED**

**The idea:** After 20 messages, automatically start a new conversation, but include the current document as context.

**Like:** Starting a new work session, but you bring your completed work with you.

**Example:**
```
You: (20th message) "Add a security section"

System: "Starting fresh with your current document..."

New conversation:
- Here's your PRD so far: [full document]
- User wants to add security section
- Continue from here
```

**Good:**
- Simple to build
- Automatic (user barely notices)
- Document is what matters, and it's preserved
- Costs stay low
- Never breaks

**Bad:**
- Loses the back-and-forth conversation history
- User gets a notification (might be surprising first time)

**Verdict:** **Perfect for DDX** - You care about the document, not the chat log.

---

### 3. **"Keep the Recent Stuff"** (Sliding Window)

**The idea:** Always keep the last 20 messages, throw away older ones. Store all messages, but only send recent ones to AI.

**Like:** A rolling camera that only shows the last 5 minutes of a movie.

**Good:**
- Smooth experience
- No interruptions
- Feels seamless

**Bad:**
- Complex to build (3x more code)
- Need to track partial documents carefully
- Risk of bugs (what if you cut off mid-document?)
- Still lose old context eventually

**Verdict:** **Overkill for DDX** - The complexity doesn't match the benefit.

---

### 4. **"Summarize the Past"** (Summary Compression)

**The idea:** When conversation gets long, use AI to summarize old messages, keep summary + recent messages.

**Like:** Having an assistant write cliff notes of your earlier discussion.

**Good:**
- Preserves some old context
- Smooth experience

**Bad:**
- Extra AI call = extra cost ($0.05 per summary)
- Slower (adds 2-3 seconds for summarizing)
- Summary might miss important details
- Eventually summaries need summarizing too

**Verdict:** **Too expensive for marginal benefit** - You're paying to preserve chat history that users don't care about.

---

### 5. **"Wing It"** (Warning Only)

**The idea:** Do nothing. Just warn users when it's getting big.

**Like:** Driving without a fuel gauge, just a light that says "you'll probably run out soon."

**Good:**
- Trivial to build
- User controls everything

**Bad:**
- WILL break eventually
- Gets expensive ($5+ per continue)
- Gets slow (10+ seconds)
- Just delays the problem

**Verdict:** **Not a real solution** - Fine for prototypes, unacceptable for production.

---

## The Comparison

| Strategy | Complexity | User Experience | Cost | Will It Break? |
|----------|-----------|-----------------|------|----------------|
| Fixed Reset | Very Simple | Okay (interrupts) | Low | No |
| **Auto-Reset** ⭐ | Simple | Good (automatic) | Low | No |
| Sliding Window | Complex | Great (seamless) | Medium | No |
| Summary | Medium | Good | High | No |
| Warning Only | Trivial | Poor | Very High | YES |

---

## Why Auto-Reset Wins for DDX

### The Key Insight

**DDX is about creating documents, not having conversations.**

Think about it:
- **What users want:** A great PRD, SDD, or spec
- **What users don't care about:** The transcript of questions/answers that got them there

**Analogy:** When you go to a restaurant:
- You care about the meal (document)
- You don't care about the conversation with your waiter (chat history)

### Why It Works

1. **The document is already saved to disk** after every AI response
2. **The document IS the context** - it contains all the important decisions
3. **20 messages is a natural breaking point** - you've probably refined one section/aspect
4. **Starting fresh feels good** - like reviewing your work with fresh eyes

### What It Looks Like

```
Messages 1-19: Normal back and forth

Message 20: "Add security section"

System: "📝 Starting fresh with your current document..."

Message 21: New conversation, but your document is the starting point
```

User barely notices. The document keeps evolving. Nothing is lost.

---

## The Decision

### For DDX v1.0: Use Auto-Reset

**Because:**
- ✅ Simple (1 day to build vs 3 days for sliding window)
- ✅ Safe (can't lose partial work - it's on disk)
- ✅ Cheap (costs stay bounded)
- ✅ Natural (fits how people actually work)
- ✅ Aligned with DDX's purpose (document artifacts, not chat logs)

### Save for Later (if users demand it)

- Sliding window (if users complain about losing chat history)
- Summary compression (if context preservation proves critical)

**The principle:** Start with the simplest thing that solves the problem. Only add complexity when users prove you need it.

---

## The Bigger Picture

This decision reveals something important about system design:

**Different problems need different solutions:**

- **Chat applications** (like ChatGPT): Need sliding window because the conversation IS the product
- **Document generators** (like DDX): Need auto-reset because the document IS the product

**DDX's superpower is knowing what it is:** It's not trying to be a chat bot. It's a document creation tool that uses chat as a means to an end.

Auto-reset embraces this identity. Sliding window tries to be something DDX isn't.

---

## Real-World Scenario: What Would Happen Without Management

### Week 1-6: Everything's Great
- Users create documents with 5-10 messages
- All tests pass
- Everyone's happy

### Week 7-10: Subtle Warnings
- Power users hit 30-40 messages
- API costs spike quietly
- Responses get slower (8-10 seconds)
- Nobody complains yet

### Week 11: 💥 Production Failure
```
Error: Context window overflow (205,432 tokens exceeds 200,000 limit)

User sees:
❌ Failed to continue conversation
   Please start a new document
```

**User's perspective:**
- "I've been working on this for a week!"
- "All my context is lost?"
- "This tool is broken!"

### Week 12-14: Emergency Response
- Team scrambles to implement a fix
- Different developers implement different solutions
- CLI behaves differently than Web UI
- User data migration needed
- Trust damaged

**Cost:** 12+ days of unplanned work, delayed roadmap, unhappy users

### With Auto-Reset from Day 1:
- Predictable behavior
- No surprises
- Natural workflow
- Happy users

**Cost:** 1 day of planned implementation

**Lesson:** Context management isn't optional. It's a core requirement.

---

## Decision Framework: How to Choose

Use this flowchart for your project:

```
Is the conversation the product?
├─ YES → Sliding Window or Summary Compression
│         (e.g., ChatGPT, therapy bots, tutoring systems)
│
└─ NO → Is there an artifact being created?
         ├─ YES → Auto-Reset with artifact as context ⭐
         │        (e.g., DDX, code generators, design tools)
         │
         └─ NO → What are you building?
                  You probably need sliding window
```

**DDX clearly falls into:** Artifact creation → Auto-Reset

---

## Common Objections & Responses

### Objection 1: "But users might want to reference old conversations"

**Response:** The document contains all important decisions. If something's important enough to reference, it should be in the document.

**Action:** If users complain, add a `ddx history` command to view archived conversations. But don't optimize for a need that doesn't exist yet.

---

### Objection 2: "20 messages seems arbitrary. What if users need more?"

**Response:** It's configurable. But 20 is a sweet spot:
- Too low (10): Annoying resets
- Too high (50): Expensive, risky
- 20: Natural breakpoint for a focused refinement session

**Action:** Start with 20. Adjust based on real usage data, not speculation.

---

### Objection 3: "Sliding window is only 3x more complex. Why not just do it right?"

**Response:** 3x complexity means:
- 3x more bugs
- 3x longer to test
- 3x harder to maintain
- 3x more code to understand

And for what? A marginal UX improvement that users might not even notice.

**Action:** Ship auto-reset. Measure user satisfaction. Add sliding window only if users ask for it.

---

### Objection 4: "This feels like a hacky workaround"

**Response:** It's not a workaround—it's the right architecture for the problem.

Consider:
- Git commits (snapshots, not continuous history)
- Database savepoints (discrete checkpoints)
- Video game checkpoints (fresh starts with progress preserved)

All successful systems use discrete boundaries. Unbounded continuous history is actually the anti-pattern.

---

## Implementation Checklist

When implementing auto-reset, ensure:

- [ ] Clear user notification on reset
- [ ] Current document included in new conversation
- [ ] Old conversation archived (optional history retention)
- [ ] Conversation ID updated (new session boundary)
- [ ] Config value for max_messages (allow tuning)
- [ ] Logging of reset events (for analytics)
- [ ] Tests for reset behavior
- [ ] Documentation for users

**What NOT to do:**
- ❌ Silent resets (user should know)
- ❌ Lose document state (always preserve)
- ❌ Complex heuristics (keep it simple)

---

## Metrics to Track

Once implemented, monitor:

1. **Reset frequency**
   - How often do users hit the 20-message limit?
   - If > 50% of conversations: maybe limit is too low
   - If < 5% of conversations: limit might be too high

2. **User complaints**
   - Do users complain about reset notifications?
   - Do users report lost context?
   - Do users understand what happened?

3. **Conversation length distribution**
   - Most conversations: 5-15 messages (good)
   - Many conversations: 1-3 messages (config might be wrong)
   - Many hitting limit exactly: users trying to "game" it

4. **Cost per conversation**
   - Should stay bounded (not grow linearly)
   - Resets should keep costs predictable

**Success criteria:**
- < 5% of users complain about resets
- Conversation costs stay under $0.50 per session
- No context overflow errors in production

---

## The Bottom Line

### Context management is not optional

Every multi-turn LLM system needs a strategy. The question isn't "if," it's "which."

### Auto-reset is right for DDX because:

1. **Document-centric architecture** - The artifact is what matters
2. **Disk is source of truth** - Document saved after every response
3. **Simplicity is valuable** - Less code = fewer bugs = faster shipping
4. **Predictable costs** - Bounded context = bounded expenses
5. **Natural workflow** - 20 messages is a good checkpoint

### The meta-lesson:

**Good system design is about matching the solution to the problem, not picking the "best" solution in abstract.**

- Sliding window isn't "better" than auto-reset
- Auto-reset isn't "better" than sliding window
- Each is better *for different problems*

**DDX's job:** Know what problem it's solving (document creation) and pick the right tool (auto-reset).

---

## Further Reading

- **For implementation details:** See `context_management.md` (technical deep-dive)
- **For system architecture:** See `ssd.md` (State Manager section)
- **For configuration:** See `ddx.config.yaml` schema in `ssd.md`

---

**Document Purpose:** High-level strategic overview for non-technical stakeholders, product managers, and developers who need to understand "why" before "how."

**For developers:** Read this first to understand the strategy, then read `context_management.md` for implementation details.

**Last Updated:** 2026-03-04
**Version:** 1.0
**Status:** Approved recommendation for DDX v1.0
