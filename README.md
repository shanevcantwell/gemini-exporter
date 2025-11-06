# Gemini Conversation Exporter

A Chrome extension to export Google Gemini conversations to markdown files with images.

## Status

**✅ Fully tested and working** - Successfully exported 663+ conversations with proper titles, images, and metadata.

**⚠️ UI brittleness warning**: This extension relies on Gemini's DOM structure, which Google may change without notice. If exports stop working after a Gemini update, the selectors in `content.js` may need updating.

## Features

- **Auto-click mode**: Automatically iterates through conversations with human-like random delays (15-25s)
- **Batch export**: Export all conversations or start from a specific index
- **Manual export**: Export current conversation with Ctrl+Shift+E
- **Smart title extraction**: Pulls actual conversation titles from sidebar with retry logic
- **Image download**: Saves all conversation images to `./images/` subdirectories
- **Thinking blocks**: Automatically expands and includes Claude's thinking blocks
- **Error recovery**: Continues on errors rather than stopping entire batch
- **Proper sequencing**: Files numbered correctly (0000, 0001, etc.)

## Installation

1. Clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `gemini-exporter` directory
6. Navigate to Google Gemini and open the extension popup

## Usage

### Auto-click Mode (Recommended for bulk export)
1. Check "Auto-click mode" in the extension popup
2. Set starting conversation number (default: 0)
3. Click "Export All Conversations (Batch)"
4. **Keep your desktop unlocked** - Chrome suspends tabs when locked
5. Let it run (15-25s per conversation)

### Manual Mode
1. Enable "Manual auto-export mode"
2. Manually click through conversations in Gemini
3. Each conversation auto-exports as you view it
4. Or press Ctrl+Shift+E to export current conversation

### Single Conversation
Click "Export Current Conversation" button or press Ctrl+Shift+E

## Export Format

**As of v2.0-raw**, conversations are exported as **raw JSON files with ALL DOM data including duplicates**:

```
gemini_export/
├── 0000_Conversation_Title_abc123def456/
│   └── 0000_Conversation_Title_abc123def456.json
├── 0001_Another_Conversation_xyz789/
│   └── 0001_Another_Conversation_xyz789.json
```

### JSON Structure (Raw Export)

Each conversation is exported with:
- **Exchange-based organization**: One exchange per `.conversation-container` DOM element
- **Container IDs**: Each exchange includes `container_id` (DOM element ID) for timestamp merging with Google Takeout data
- **Message types**: `user_input`, `thinking`, `assistant_response`
- **Thinking stages**: Preserved as structured objects with stage names and content
- **RAW duplicates preserved**: User messages appear 3x (nested DOM structure), responses may appear multiple times (streaming artifacts)
- **Duplicate tracking**: Each message includes `duplicate_index` to identify which copy it is
- **DOM metadata**: User messages include `dom_tag` and `dom_classes` for post-processing
- **Export metadata**: Marked as `"export_type": "raw"` indicating post-processing needed

Example structure:
```json
{
  "conversation_id": "abc123def456",
  "title": "Conversation Title",
  "export_version": "2.0-raw",
  "export_type": "raw",
  "export_note": "Raw DOM extraction with all duplicates preserved. Post-processing required to deduplicate and clean data.",
  "exchange_count": 1,
  "message_count": 5,
  "exchanges": [
    {
      "exchange_index": 0,
      "container_id": "c61fbdc59e290cd9",
      "raw_user_container_count": 3,
      "raw_markdown_panel_count": 1,
      "messages": [
        {
          "message_index": 0,
          "speaker": "User",
          "message_type": "user_input",
          "text": "User question...",
          "duplicate_index": 0,
          "dom_tag": "div",
          "dom_classes": "user-query-container"
        },
        {
          "message_index": 1,
          "speaker": "User",
          "message_type": "user_input",
          "text": "User question...",
          "duplicate_index": 1,
          "dom_tag": "user-query-content",
          "dom_classes": "user-query-container"
        },
        {
          "message_index": 2,
          "speaker": "User",
          "message_type": "user_input",
          "text": "User question...",
          "duplicate_index": 2,
          "dom_tag": "span",
          "dom_classes": "user-query-container"
        },
        {
          "message_index": 3,
          "speaker": "Gemini",
          "message_type": "thinking",
          "thinking_stages": [
            {
              "stage_name": "Understanding the Request",
              "text": "Internal reasoning..."
            }
          ]
        },
        {
          "message_index": 4,
          "speaker": "Gemini",
          "message_type": "assistant_response",
          "text": "Response text...",
          "duplicate_index": 0
        }
      ]
    }
  ]
}
```

See [SCHEMA.md](SCHEMA.md) for complete field reference and post-processing guide.

## Known Limitations

- **Raw data requires post-processing** - Exports include all DOM duplicates and need deduplication
- **No timestamps** in export (timestamps can be added via Google Takeout data cross-indexing)
- **Desktop must stay unlocked** during overnight runs (Chrome limitation)
- **DOM dependency** - Google may change Gemini's HTML structure at any time
- **Images not included** in v2.0 JSON exports (focus is on text and thinking stages)
- **Larger file sizes** - Raw exports with duplicates are ~3x larger than deduplicated exports

## Contributing

This extension exports raw DOM data successfully. The next tool needed is a **post-processor** to:

- **Deduplicate user messages** - Keep the most complete version of the 3 nested user containers
- **Deduplicate responses** - Filter out empty streaming artifacts, keep final rendered response
- **Clean message structure** - Remove duplicate_index, dom_tag, dom_classes after deduplication
- **Merge timestamps from Google Takeout** - Match exchanges by `container_id`, `exchange_index`, or text similarity
- **Validate data integrity** - Ensure each exchange has exactly 1 user, 0-1 thinking, 1 response

Other potential improvements:

- **Timestamp extraction** from browser storage or API responses
- **Better error reporting** in the UI
- **Robustness improvements** for DOM changes

Feel free to fork, improve, and submit PRs. Or open an issue if you need help or find bugs after a Gemini update.

## Technical Notes

- **Export format**: v2.0-raw uses structured JSON with raw DOM data (duplicates preserved)
- **Parent container**: Uses `.conversation-container` as the atomic unit (each contains one complete turn)
- **Container ID extraction**: Captures DOM `id` attribute from each container for timestamp merging with Google Takeout
- **Title extraction**: Tries main header → sidebar → document.title with 10 retries
- **Thinking block expansion**: Scrolls into view, clicks, verifies content loaded (up to 10 retry attempts per block)
- **Exchange detection**: One exchange per `.conversation-container` element found in main
- **User message extraction**: Extracts ALL `.user-query-container` elements (typically 3 nested duplicates per turn)
- **Response extraction**: Extracts ALL `.markdown-main-panel` elements (may include streaming artifacts)
- **Duplicate tracking**: Each message includes `duplicate_index` and DOM metadata for post-processing
- **Thinking stage parsing**: Extracts bold headers as stage names, following text as stage content
- **Conversation detection**: Uses `div.conversation-items-container` and `jslog` attributes for sidebar matching

## License

MIT - use freely, no warranties provided

## Author

Built with Claude Code assistance for personal data archival needs.
