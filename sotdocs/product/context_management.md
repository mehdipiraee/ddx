# Context Management Strategies for DDX

## Overview

This document analyzes different approaches to managing conversation context in DDX's multi-turn document creation workflows. The primary challenge is preventing context window overflow while maintaining conversation continuity and document state.

## The Problem

DDX enables iterative document refinement through multi-turn LLM conversations:

```bash
ddx create prd
  → User: "Build a mobile app"
  → AI: "Tell me about the target users"
  → User: "Fitness enthusiasts..."
  → AI: "What features are critical?"
  → ... (conversation continues)

ddx continue prd
  → User: "Add section on security"
  → ... (more refinement)
```

**Without management, conversations grow unbounded:**
- System prompt: 15,000 tokens (template + upstream docs)
- 50 messages × 3,000 tokens avg = 150,000 tokens
- **Total: 165,000 tokens** (approaching Claude's 200k limit)

**Consequences of no management:**
1. Context window overflow → API errors (400 Bad Request)
2. High costs ($5-10 per continue command)
3. Increased latency (8-10 seconds per response)
4. User data loss (conversation becomes unusable)

---

## Strategy Options

### Option 1: Fixed Context Reset

**Concept:** Force user to start fresh after N messages.

#### Implementation

```typescript
class StateManager {
  private readonly MAX_MESSAGES = 15;

  async loadState(conversationId: string): State | null {
    const state = await this.load(conversationId);

    if (state.messages.length >= this.MAX_MESSAGES) {
      throw new Error(
        `Conversation has reached maximum length (${this.MAX_MESSAGES} messages). ` +
        `Use 'ddx create ${state.documentType}' to start a new conversation ` +
        `with the current document as context.`
      );
    }

    return state;
  }
}
```

#### User Experience

```bash
ddx continue prd

# After 15 messages:
❌ Error: Conversation has reached maximum length (15 messages).
   Current document saved to: sotdocs/prd.md

   To continue refining, start a new conversation:
   ddx create prd --from-existing
```

#### Analysis

**Pros:**
- ✅ Extremely simple (10 lines of code)
- ✅ No truncation logic needed
- ✅ No extraction state tracking
- ✅ Predictable behavior
- ✅ Zero risk of losing context incorrectly
- ✅ Forces users to review completed work
- ✅ Natural breaking point in workflow

**Cons:**
- ❌ User must manually restart conversations
- ❌ Less seamless experience
- ❌ Requires `--from-existing` feature implementation
- ❌ Users may perceive as limitation rather than feature
- ❌ Interrupts flow during intensive refinement sessions

**Complexity:** 1/10

**Best For:**
- MVPs and prototypes
- Users comfortable with deliberate workflow breaks
- Projects prioritizing simplicity over seamlessness

---

### Option 2: Auto-Reset with Document Snapshot (RECOMMENDED)

**Concept:** Automatically start new conversation with completed document as context when limit reached.

#### Implementation

```typescript
class ConversationService {
  private readonly MAX_MESSAGES = 20;

  async continueConversation(conversationId: string, userMessage: string) {
    const state = await this.stateManager.loadState(conversationId);

    // Check if we're at limit
    if (state.messages.length >= this.MAX_MESSAGES) {
      console.log('ℹ️  Conversation limit reached. Starting fresh with current document...');

      // Extract current document from disk (single source of truth)
      const currentDoc = await this.documentService.readDocument(state.documentType);

      if (!currentDoc) {
        throw new Error('No document found to reset context from');
      }

      // Create NEW conversation with fresh context
      const newConversationId = `continue_${state.documentType}_${Date.now()}`;
      const systemPrompt = await this.buildSystemPrompt(state.documentType);

      // Start fresh with document as context
      const newState: ConversationState = {
        conversationId: newConversationId,
        documentType: state.documentType,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Here's the current document:\n\n<doc>\n${currentDoc}\n</doc>\n\n` +
                     `Continue refining based on this request: ${userMessage}`
          }
        ],
        messageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in_progress'
      };

      // Archive old conversation (optional: keep for history)
      await this.stateManager.archiveState(conversationId);

      // Save new conversation
      await this.stateManager.saveState(newConversationId, newState);

      return this.sendMessage(newState);
    }

    // Normal flow: add message and continue
    state.messages.push({ role: 'user', content: userMessage });
    state.messageCount = state.messages.length;
    state.updatedAt = new Date().toISOString();

    await this.stateManager.saveState(conversationId, state);
    return this.sendMessage(state);
  }
}
```

#### User Experience

```bash
ddx continue prd

# After 20 messages, automatically:
ℹ️  Conversation reset (reached 20 messages)
   Starting fresh with current document as context...
✨ Ready to continue refining your PRD

# User continues seamlessly
```

#### Analysis

**Pros:**
- ✅ Simple implementation (40 lines of code)
- ✅ Automatic and transparent to user
- ✅ No truncation logic needed
- ✅ Document preserved as complete context
- ✅ No partial state tracking required
- ✅ Single source of truth (document on disk)
- ✅ Conversation ID changes cleanly separate sessions
- ✅ Costs stay bounded (reset prevents unbounded growth)
- ✅ Natural for DDX's document-centric model

**Cons:**
- ⚠️ Loses conversation nuances (previous Q&A context)
- ⚠️ Conversation ID changes (need to handle in UI/REPL)
- ⚠️ Notification might surprise users initially
- ⚠️ Archived conversations accumulate (need cleanup strategy)

**Complexity:** 3/10

**Best For:**
- Production DDX implementation (recommended)
- Document-centric workflows
- Systems where the artifact matters more than the conversation
- Balance of simplicity and user experience

**Why This Works for DDX:**

1. **Documents are self-contained** - The current document IS the important state
2. **Conversation history is auxiliary** - Q&A is just refinement mechanism
3. **Users care about document, not chat log** - They want a good PRD, not a transcript
4. **Disk is source of truth** - Every AI response writes to file
5. **Clean session boundaries** - Natural breaks after 20 messages

---

### Option 3: Sliding Window with Pinned System Prompt

**Concept:** Keep system prompt + last N messages, discard older messages.

#### Implementation

```typescript
class StateManager {
  private readonly MAX_MESSAGES_IN_WINDOW = 20;

  buildContextWindow(conversationId: string): Message[] {
    const state = this.loadState(conversationId);
    if (!state) return [];

    const messages = state.messages;
    const systemPrompt = messages[0];

    // Keep system prompt + last N messages
    if (messages.length <= this.MAX_MESSAGES_IN_WINDOW) {
      return messages;
    }

    return [
      systemPrompt,
      ...messages.slice(-(this.MAX_MESSAGES_IN_WINDOW - 1))
    ];
  }
}

class ConversationService {
  async continueConversation(conversationId: string, userMessage: string) {
    const state = await this.stateManager.loadState(conversationId);

    // Add new message to full history
    state.messages.push({ role: 'user', content: userMessage });

    // Build windowed context for LLM
    const windowedMessages = this.stateManager.buildContextWindow(conversationId);

    // Send only windowed messages to LLM
    const response = await this.llmClient.sendMessage(windowedMessages);

    // Save full history (not windowed)
    state.messages.push({ role: 'assistant', content: response });
    await this.stateManager.saveState(conversationId, state);

    return response;
  }
}
```

#### Extraction State Tracking

Since windowing may truncate mid-document creation, track partial documents:

```typescript
interface ExtractionState {
  status: 'not_started' | 'in_progress' | 'complete';
  accumulatedContent: string;
  lastTagPosition: 'none' | 'opening' | 'closing';
}

class DocumentService {
  extractAndWriteDocument(
    response: string,
    type: string,
    existingState?: ExtractionState
  ): ExtractionState {
    let content = existingState?.accumulatedContent || '';

    // Check for opening tag
    const openMatch = response.match(/<doc>/);
    const closeMatch = response.match(/<\/doc>/);

    if (openMatch && closeMatch) {
      // Complete document in single response
      content = response.match(/<doc>([\s\S]*?)<\/doc>/)?.[1] || '';
      this.fileManager.writeFile(this.getOutputPath(type), content.trim());
      return {
        status: 'complete',
        accumulatedContent: content,
        lastTagPosition: 'closing'
      };
    }

    if (openMatch && !closeMatch) {
      // Start of document
      content = response.split('<doc>')[1];
      return {
        status: 'in_progress',
        accumulatedContent: content,
        lastTagPosition: 'opening'
      };
    }

    if (!openMatch && closeMatch && existingState?.status === 'in_progress') {
      // End of document
      content = existingState.accumulatedContent + response.split('</doc>')[0];
      this.fileManager.writeFile(this.getOutputPath(type), content.trim());
      return {
        status: 'complete',
        accumulatedContent: content,
        lastTagPosition: 'closing'
      };
    }

    if (existingState?.status === 'in_progress') {
      // Middle of document
      content = existingState.accumulatedContent + response;
      return {
        status: 'in_progress',
        accumulatedContent: content,
        lastTagPosition: existingState.lastTagPosition
      };
    }

    // No document tags yet
    return {
      status: 'not_started',
      accumulatedContent: '',
      lastTagPosition: 'none'
    };
  }
}
```

#### State Schema

```json
{
  "conversationId": "create_prd_2026-03-03",
  "documentType": "prd",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    "... (all 50 messages kept in history)"
  ],
  "extractionState": {
    "status": "in_progress",
    "accumulatedContent": "# PRD\n\n## Overview...",
    "lastTagPosition": "opening"
  },
  "messageCount": 50,
  "createdAt": "2026-03-03T10:00:00Z",
  "updatedAt": "2026-03-03T10:30:00Z",
  "status": "in_progress"
}
```

#### User Experience

```bash
ddx continue prd

# No visible change to user
# Behind the scenes: only last 20 messages sent to LLM
# Full history preserved in state file
```

#### Analysis

**Pros:**
- ✅ Preserves full conversation history
- ✅ Same conversation ID throughout
- ✅ Seamless user experience
- ✅ Gradual context reduction (not sudden reset)
- ✅ System prompt always included

**Cons:**
- ❌ Complex implementation (100+ lines)
- ❌ Extraction state tracking required (50+ lines)
- ❌ Risk of truncation bugs (losing partial documents)
- ❌ Full history stored even if not used
- ❌ Window size requires tuning per use case
- ❌ Older context lost forever (can't recover)
- ❌ Testing complexity (need to test window edge cases)

**Complexity:** 7/10

**Best For:**
- Systems where conversation history is critical
- Chat applications (not document generation)
- Use cases with highly interdependent messages
- When user expects continuous conversation

**Why This Is Overkill for DDX:**
- DDX writes documents to disk after each response
- The document IS the state, not the conversation
- Users can always read the current document
- Q&A history is ephemeral refinement, not the product

---

### Option 4: Summary Compression

**Concept:** When approaching limit, use LLM to compress older messages into a summary.

#### Implementation

```typescript
class ConversationService {
  private readonly MAX_MESSAGES = 20;
  private readonly COMPRESSION_THRESHOLD = 18;

  async continueConversation(conversationId: string, userMessage: string) {
    const state = await this.stateManager.loadState(conversationId);

    // Check if we need compression
    if (state.messages.length >= this.COMPRESSION_THRESHOLD) {
      console.log('ℹ️  Compressing conversation history...');

      // Compress older messages
      const systemPrompt = state.messages[0];
      const oldMessages = state.messages.slice(1, -4); // All except last 4
      const recentMessages = state.messages.slice(-4);  // Keep last 4

      // Use LLM to summarize old messages
      const summary = await this.summarizeConversation(oldMessages);

      // Rebuild message array
      state.messages = [
        systemPrompt,
        {
          role: 'assistant',
          content: `[Previous conversation summary]\n${summary}`
        },
        ...recentMessages
      ];

      await this.stateManager.saveState(conversationId, state);
    }

    // Add new message and continue
    state.messages.push({ role: 'user', content: userMessage });
    return this.sendMessage(state);
  }

  private async summarizeConversation(messages: Message[]): Promise<string> {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const prompt = `Summarize this conversation, preserving key decisions and context:\n\n${conversationText}`;

    return await this.llmClient.sendMessage(prompt, {
      maxTokens: 500,
      temperature: 0.3  // Lower temperature for factual summary
    });
  }
}
```

#### User Experience

```bash
ddx continue prd

# After 18 messages:
ℹ️  Compressing conversation history...
✨ Ready to continue (older messages summarized)

# User continues seamlessly
```

#### Analysis

**Pros:**
- ✅ Preserves context via summary
- ✅ No conversation reset
- ✅ Keeps recent messages intact
- ✅ Automatic and transparent
- ✅ Same conversation ID

**Cons:**
- ❌ Extra LLM call (costs ~$0.01-0.05 per compression)
- ❌ Adds latency (1-3 seconds for summary)
- ❌ Summary might lose important details
- ❌ Non-deterministic (different summaries each time)
- ❌ More complex implementation (50+ lines)
- ❌ Recursive problem (summaries need summarizing eventually)
- ❌ Testing difficulty (can't verify summary quality)

**Complexity:** 5/10

**Best For:**
- High-value conversations where context is critical
- Systems with budget for extra LLM calls
- Use cases where conversation nuance matters
- When document doesn't fully capture conversation value

**Why This Is Excessive for DDX:**
- Adds cost and latency for marginal benefit
- Document already captures all important information
- Conversation is just a means to an end
- Users don't read conversation history, they read documents

---

### Option 5: No Management (Warning Mode)

**Concept:** Don't manage at all. Just warn user when approaching limit.

#### Implementation

```typescript
class ConversationService {
  private readonly WARNING_THRESHOLD = 50; // messages

  async continueConversation(conversationId: string) {
    const state = await this.stateManager.loadState(conversationId);

    // Warn if getting large
    if (state.messages.length >= this.WARNING_THRESHOLD) {
      console.warn(`
⚠️  Warning: Conversation has ${state.messages.length} messages
   Consider finishing this document and starting fresh if issues occur.
   API costs and latency may increase with longer conversations.
      `);
    }

    // Send everything (no management)
    return this.sendMessage(state);
  }
}
```

#### User Experience

```bash
ddx continue prd

# After 50 messages:
⚠️  Warning: Conversation has 52 messages
   Consider finishing this document and starting fresh if issues occur.
   API costs and latency may increase with longer conversations.

# User continues at own risk
```

#### Analysis

**Pros:**
- ✅ Trivial implementation (5 lines)
- ✅ No truncation risk
- ✅ User stays in control
- ✅ No complexity

**Cons:**
- ❌ Will eventually fail (context overflow at ~200k tokens)
- ❌ Expensive (sending 100k+ tokens per request = $1-5 per continue)
- ❌ Slow (latency increases linearly with history)
- ❌ Punts problem to user
- ❌ Poor user experience (unpredictable failures)
- ❌ No proactive prevention

**Complexity:** 0.5/10

**Best For:**
- Prototypes and demos
- Short-term testing
- When you need something working immediately

**Why This Is Inadequate for Production:**
- Guarantees eventual failure
- Unpredictable user experience
- High costs at scale
- Not a real solution, just deferred problem

---

## Comparison Matrix

| Strategy | Complexity | Code Lines | User Experience | Cost | Risk | Production Ready |
|----------|-----------|------------|-----------------|------|------|------------------|
| **Fixed Reset** | 1/10 | ~10 | Manual breaks | Low | Very Low | ✅ Yes (simple) |
| **Auto-Reset** | 3/10 | ~40 | Automatic | Low | Low | ✅ **YES (BEST)** |
| **Sliding Window** | 7/10 | ~100 | Seamless | Medium | Medium | ⚠️ Yes (complex) |
| **Summary Compression** | 5/10 | ~50 | Seamless | High | Medium | ⚠️ Maybe (expensive) |
| **Warning Only** | 0.5/10 | ~5 | Poor | Very High | Very High | ❌ No |

---

## Recommendation for DDX: Auto-Reset

### Why Auto-Reset is the Best Choice

**1. Aligns with DDX's Document-Centric Model**

DDX is fundamentally about creating artifacts (documents), not maintaining conversations:

```
Primary Value: quality of document
Secondary Value: ease of refinement
Tertiary Value: conversation history
```

Auto-reset optimizes for the primary value.

**2. Simplicity Without Sacrifice**

- 40 lines of code vs 100+ for sliding window
- No extraction state tracking needed
- Single source of truth (disk)
- Predictable behavior

**3. Natural User Experience**

After 20 messages of refinement, users typically:
- Want to review what they've built
- Have reached a natural breakpoint
- Benefit from seeing the document fresh

Auto-reset enforces this healthy pattern.

**4. Cost and Performance**

- Bounded context = predictable costs
- No expensive summarization calls
- No growing latency over time

**5. Low Risk**

- No truncation bugs (no truncation!)
- No lost partial documents (disk is source of truth)
- Clean session boundaries
- Easy to test

### Implementation in ssd.md

Add to State Manager section:

```markdown
#### State Manager (`src/state-manager.ts`)
- **Responsibilities**:
  - Persist conversation history to `.ddx/state/` folder
  - Restore interrupted workflows
  - Track document creation progress
  - Auto-reset conversations at message limit
- **Storage Format**: JSON files per conversation ID
- **Key Methods**:
  - `saveState(conversationId, state): void`
  - `loadState(conversationId): State | null`
  - `deleteState(conversationId): void`
  - `archiveState(conversationId): void`
- **Context Management Strategy**:
  - Fixed limit: 20 messages per conversation
  - On limit: Auto-reset with current document as context
  - User notification: Transparent transition message
  - Document preservation: Current doc becomes baseline for new conversation
  - Archive old conversations: Optional history retention
- **Boundaries**: No conversation logic; pure persistence and reset orchestration
```

Add to Configuration Schema:

```yaml
conversation:
  max_messages: 20                  # Hard limit per conversation
  auto_reset: true                  # Auto-start fresh when limit reached
  preserve_document_on_reset: true  # Include current doc in new conversation
  archive_old_conversations: true   # Keep history for reference
```

Add to State Schema:

```json
{
  "conversationId": "continue_prd_1709481234567",
  "documentType": "prd",
  "messages": [...],
  "messageCount": 18,
  "createdAt": "2026-03-03T10:00:00Z",
  "updatedAt": "2026-03-03T10:30:00Z",
  "status": "in_progress",
  "previousConversationId": "create_prd_1709480000000"
}
```

---

## Alternative Consideration: Hybrid Approach

For maximum flexibility, implement auto-reset with opt-in sliding window:

```yaml
conversation:
  strategy: "auto_reset"  # or "sliding_window"
  max_messages: 20
  auto_reset: true
  # Only used if strategy = "sliding_window"
  sliding_window_size: 20
  track_extraction_state: false
```

This allows:
- Default: Auto-reset (simple, recommended)
- Advanced users: Sliding window (complex, opt-in)
- Future: Other strategies without breaking changes

**Recommendation: Start with auto-reset only. Add sliding window if users demand it.**

---

## Testing Strategies

### Testing Auto-Reset

```typescript
describe('ConversationService - Auto Reset', () => {
  it('should reset conversation after max messages', async () => {
    // Create conversation with 20 messages
    const conversationId = 'test_conv';
    await createConversationWithMessages(conversationId, 20);

    // Mock document on disk
    mockDocumentService.readDocument.returns('# PRD\n\n## Overview...');

    // Continue should trigger reset
    const result = await conversationService.continueConversation(
      conversationId,
      'Add security section'
    );

    // Verify new conversation created
    expect(result.conversationId).to.not.equal(conversationId);
    expect(result.conversationId).to.match(/^continue_prd_\d+$/);

    // Verify old conversation archived
    expect(stateManager.archiveState).to.have.been.calledWith(conversationId);

    // Verify document included in context
    const newState = await stateManager.loadState(result.conversationId);
    expect(newState.messages[1].content).to.include('# PRD\n\n## Overview');
  });

  it('should not reset before max messages', async () => {
    const conversationId = 'test_conv';
    await createConversationWithMessages(conversationId, 15);

    const result = await conversationService.continueConversation(
      conversationId,
      'Add security section'
    );

    // Same conversation ID
    expect(result.conversationId).to.equal(conversationId);

    // No archive call
    expect(stateManager.archiveState).to.not.have.been.called;
  });
});
```

### Testing Sliding Window

```typescript
describe('StateManager - Sliding Window', () => {
  it('should keep system prompt and last N messages', () => {
    const state = createStateWithMessages(30);
    const window = stateManager.buildContextWindow(state.conversationId);

    // Window should have 20 messages
    expect(window).to.have.length(20);

    // First should be system prompt
    expect(window[0].role).to.equal('system');

    // Last 19 should be most recent messages
    expect(window[window.length - 1]).to.deep.equal(state.messages[29]);
  });

  it('should preserve extraction state across windows', () => {
    const state = createStateWithMessages(25);
    state.extractionState = {
      status: 'in_progress',
      accumulatedContent: '# Doc\n\n## Section 1',
      lastTagPosition: 'opening'
    };

    const window = stateManager.buildContextWindow(state.conversationId);

    // Extraction state should be preserved in full state
    const fullState = stateManager.loadState(state.conversationId);
    expect(fullState.extractionState.status).to.equal('in_progress');
  });
});
```

---

## Migration Path

If starting with auto-reset and later adding sliding window:

### Phase 1: Auto-Reset (v0.1.0)
- Implement auto-reset as default
- Ship to users
- Gather feedback

### Phase 2: Evaluate Need (v0.2.0)
- Analyze user feedback
- Check if anyone hits 20-message limit frequently
- Assess if context loss is a real problem

### Phase 3: Add Sliding Window if Needed (v0.3.0)
- Implement as opt-in feature
- Update config schema with `strategy` field
- Maintain auto-reset as default

**Key Insight:** Start simple. Add complexity only if users demand it.

---

## Conclusion

**For DDX v1.0, implement Option 2: Auto-Reset with Document Snapshot**

**Rationale:**
1. ✅ Simple (40 lines vs 100+)
2. ✅ Low risk (no truncation bugs)
3. ✅ Aligns with document-centric model
4. ✅ Predictable costs and performance
5. ✅ Natural user experience
6. ✅ Easy to test and maintain
7. ✅ Production-ready immediately

**Defer to future versions:**
- Sliding window (if users demand seamless long conversations)
- Summary compression (if context preservation is critical)
- Token counting (if cost optimization becomes priority)

**The principle:** Build the simplest thing that solves the problem. Add complexity only when users demonstrate the need.

---

## Appendix: Token Counting (Future Enhancement)

If implementing sliding window or needing precise budget management:

### Using Anthropic's Token Counting

```typescript
import Anthropic from '@anthropic-ai/sdk';

class TokenCounter {
  private client: Anthropic;

  async countTokens(messages: Message[]): Promise<number> {
    const response = await this.client.messages.countTokens({
      model: 'claude-3-5-sonnet-20241022',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    return response.input_tokens;
  }
}

class ConversationService {
  async continueConversation(conversationId: string) {
    const state = await this.stateManager.loadState(conversationId);
    const tokenCount = await this.tokenCounter.countTokens(state.messages);

    const MAX_TOKENS = 180000; // Leave room for response

    if (tokenCount > MAX_TOKENS) {
      // Trigger reset or window
    }
  }
}
```

### Installation

```bash
npm install @anthropic-ai/sdk
```

**Note:** Only add this if auto-reset proves insufficient. It adds dependency and API call overhead.

---

**Document Version:** 1.0
**Last Updated:** 2026-03-04
**Status:** Recommendation for ssd.md v1.0
