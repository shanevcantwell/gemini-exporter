# Gemini Exporter - Raw JSON Schema v2.0

## Overview

This document specifies the raw JSON export format produced by the Gemini Conversation Exporter v2.0-raw. Exports contain **all DOM data including duplicates** and require post-processing for deduplication.

## Root Object

```json
{
  "conversation_id": "string",        // Gemini conversation ID from URL (e.g., "210cdaa5f25daa51")
  "title": "string",                  // Extracted conversation title
  "url": "string",                    // Full Gemini URL
  "export_timestamp": "ISO8601",      // When export was performed
  "export_version": "2.0-raw",        // Schema version
  "export_type": "raw",               // Indicates unprocessed data
  "export_note": "string",            // Warning about post-processing requirement
  "exchange_count": integer,          // Number of exchanges (turns)
  "message_count": integer,           // Total messages INCLUDING duplicates
  "exchanges": [Exchange]             // Array of exchange objects
}
```

## Exchange Object

Represents one complete turn (user input → thinking → response).

```json
{
  "exchange_index": integer,          // Zero-based position in conversation
  "container_id": "string|null",      // DOM element ID (e.g., "c61fbdc59e290cd9")
  "raw_user_container_count": integer,// Number of user containers found (typically 3)
  "raw_markdown_panel_count": integer,// Number of response panels found (typically 1-2)
  "messages": [Message]               // Array of message objects
}
```

### Key Points:
- **One exchange per `.conversation-container` DOM element**
- `container_id` can be used for timestamp merging with Google Takeout
- `raw_*_count` fields indicate duplication level

## Message Object

Three message types exist: `user_input`, `thinking`, `assistant_response`.

### User Input Message

```json
{
  "message_index": integer,           // Global message index across conversation
  "speaker": "User",
  "message_type": "user_input",
  "timestamp": null,                  // Always null (no timestamps in DOM)
  "text": "string",                   // User's message text
  "thinking_stages": null,            // Always null for user messages
  "duplicate_index": integer,         // Which duplicate (0, 1, 2)
  "dom_tag": "string",                // HTML tag name (e.g., "div", "span", "user-query-content")
  "dom_classes": "string"             // Space-separated CSS classes
}
```

**Duplication Pattern:**
- Typically **3 duplicates per user input** (nested DOM structure)
- `duplicate_index` = 0, 1, 2
- Text content is identical across duplicates
- Different `dom_tag` values indicate nesting level:
  - `div` (outermost)
  - `user-query-content` (middle)
  - `span` (innermost)

### Thinking Message

```json
{
  "message_index": integer,
  "speaker": "Gemini",
  "message_type": "thinking",
  "timestamp": null,
  "text": null,                       // Always null for thinking messages
  "thinking_stages": [ThinkingStage]  // Array of stage objects
}
```

**Thinking Stage Object:**
```json
{
  "stage_name": "string",             // Bold header text (e.g., "Understanding the Request")
  "text": "string"                    // Stage reasoning content
}
```

**Key Points:**
- **Zero or one thinking message per exchange** (not duplicated)
- Stages are extracted from expanded thinking blocks
- Stage names come from bold/strong text elements
- Empty or missing when no thinking block present

### Assistant Response Message

```json
{
  "message_index": integer,
  "speaker": "Gemini",
  "message_type": "assistant_response",
  "timestamp": null,
  "text": "string",                   // Response text (thinking content removed)
  "thinking_stages": null,            // Always null for response messages
  "duplicate_index": integer          // Which duplicate (0, 1, etc.)
}
```

**Duplication Pattern:**
- Typically **1-2 duplicates per response** (streaming artifacts)
- `duplicate_index` = 0 is usually incomplete (early render)
- `duplicate_index` = 1 is usually complete (final render)
- Empty responses (`text: ""`) marked as "EMPTY" in console logs

## Typical Exchange Structure

A normal exchange with duplicates:

```
Exchange 0 (6 messages):
├── User Input (duplicate_index: 0, dom_tag: "div")
├── User Input (duplicate_index: 1, dom_tag: "user-query-content")
├── User Input (duplicate_index: 2, dom_tag: "span")
├── Thinking (2-5 stages)
├── Response (duplicate_index: 0) [often incomplete]
└── Response (duplicate_index: 1) [final version]
```

## Post-Processing Requirements

### 1. Deduplicate User Messages
**Strategy:** Keep one of the 3 duplicates
- **Option A:** Keep `duplicate_index: 0` (outermost container)
- **Option B:** Keep longest text
- **Option C:** Keep specific `dom_tag` (e.g., "div")

### 2. Deduplicate Response Messages
**Strategy:** Keep final rendered response
- **Keep:** Last non-empty message (`duplicate_index` highest)
- **Discard:** Empty messages and earlier drafts

### 3. Validate Exchange Structure
After deduplication, each exchange should have:
- **Exactly 1** user message
- **0 or 1** thinking message
- **Exactly 1** response message

### 4. Clean Metadata
Remove temporary fields:
- `duplicate_index`
- `dom_tag`
- `dom_classes`
- `raw_user_container_count`
- `raw_markdown_panel_count`

### 5. Merge Timestamps (Optional)
Match exchanges with Google Takeout data using:
1. `container_id` (most reliable)
2. `exchange_index` (fragile if order differs)
3. Text similarity (20% success rate observed)

## Example: Minimal Deduplicated Output

After post-processing, the exchange should look like:

```json
{
  "exchange_index": 0,
  "timestamp": "2025-10-28T16:50:00Z",  // Merged from Takeout
  "messages": [
    {
      "message_index": 0,
      "speaker": "User",
      "message_type": "user_input",
      "timestamp": "2025-10-28T16:50:00Z",
      "text": "User question..."
    },
    {
      "message_index": 1,
      "speaker": "Gemini",
      "message_type": "thinking",
      "timestamp": "2025-10-28T16:50:05Z",
      "thinking_stages": [
        {
          "stage_name": "Understanding the Request",
          "text": "Internal reasoning..."
        }
      ]
    },
    {
      "message_index": 2,
      "speaker": "Gemini",
      "message_type": "assistant_response",
      "timestamp": "2025-10-28T16:50:10Z",
      "text": "Response text..."
    }
  ]
}
```

## Field Reference

| Field | Type | Required | Duplicated | Notes |
|-------|------|----------|------------|-------|
| `conversation_id` | string | Yes | No | From URL pathname |
| `container_id` | string\|null | Yes | No | DOM element ID for merging |
| `exchange_index` | integer | Yes | No | Zero-based position |
| `message_index` | integer | Yes | No | Global across conversation |
| `speaker` | string | Yes | Yes | "User" or "Gemini" |
| `message_type` | string | Yes | Yes | "user_input", "thinking", "assistant_response" |
| `timestamp` | null | Yes | No | Always null in raw export |
| `text` | string\|null | Varies | Yes | Null for thinking messages |
| `thinking_stages` | array\|null | Varies | No | Null except for thinking messages |
| `duplicate_index` | integer | User/Response | Yes | Identifies which duplicate (0, 1, 2...) |
| `dom_tag` | string | User only | Yes | HTML tag name |
| `dom_classes` | string | User only | Yes | CSS classes |
| `raw_user_container_count` | integer | Yes | No | Expected: 3 |
| `raw_markdown_panel_count` | integer | Yes | No | Expected: 1-2 |

## Version History

- **v2.0-raw** (Current): Raw DOM extraction with duplicates preserved
- **v1.0**: Markdown export (deprecated, incomplete thinking blocks)
