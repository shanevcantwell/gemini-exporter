#!/usr/bin/env python3
"""
Fix thinking block duplication in exported JSON files

Removes assistant_response messages that contain duplicate thinking block text.
Keeps only:
1. The structured thinking message with thinking_stages array
2. The actual assistant response (without thinking text)
"""

import json
import sys
import os
from pathlib import Path


def contains_thinking_stage_text(text, thinking_stages):
    """Check if text contains thinking stage content."""
    if not text or not thinking_stages:
        return False

    # Check if text contains stage names
    for stage in thinking_stages:
        stage_name = stage.get('stage_name', '')
        if stage_name and stage_name in text:
            return True

    return False


def clean_exchange(exchange):
    """Remove duplicate thinking text from exchange messages."""
    messages = exchange.get('messages', [])

    # Find thinking message
    thinking_msg = None
    for msg in messages:
        if msg.get('message_type') == 'thinking':
            thinking_msg = msg
            break

    if not thinking_msg or not thinking_msg.get('thinking_stages'):
        # No thinking to deduplicate
        return exchange

    thinking_stages = thinking_msg['thinking_stages']

    # Filter out assistant responses that contain thinking text
    cleaned_messages = []
    removed_count = 0

    for msg in messages:
        if msg.get('message_type') == 'assistant_response':
            text = msg.get('text', '')
            if contains_thinking_stage_text(text, thinking_stages):
                # This is a duplicate thinking response - skip it
                removed_count += 1
                continue

        # Keep this message
        cleaned_messages.append(msg)

    # Renumber message indices
    for idx, msg in enumerate(cleaned_messages):
        msg['message_index'] = idx

    exchange['messages'] = cleaned_messages

    return exchange, removed_count


def clean_file(input_path, output_path=None, in_place=False):
    """Clean thinking duplicates from a JSON file."""
    print(f"Processing: {input_path}")

    with open(input_path) as f:
        data = json.load(f)

    total_removed = 0
    exchanges_cleaned = 0

    for exchange in data.get('exchanges', []):
        cleaned_exchange, removed = clean_exchange(exchange)
        if removed > 0:
            exchanges_cleaned += 1
            total_removed += removed

    # Update message count
    total_messages = sum(
        len(ex.get('messages', []))
        for ex in data.get('exchanges', [])
    )
    data['message_count'] = total_messages

    # Determine output path
    if in_place:
        output_path = input_path
    elif not output_path:
        # Create new file with .cleaned.json suffix
        base = Path(input_path).stem
        parent = Path(input_path).parent
        output_path = parent / f"{base}.cleaned.json"

    # Write cleaned data
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"  Exchanges cleaned: {exchanges_cleaned}")
    print(f"  Messages removed: {total_removed}")
    print(f"  Output: {output_path}")

    return exchanges_cleaned, total_removed


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Remove duplicate thinking text from JSON exports'
    )
    parser.add_argument(
        'files',
        nargs='+',
        help='JSON file(s) to clean'
    )
    parser.add_argument(
        '--in-place',
        action='store_true',
        help='Modify files in place (default: create .cleaned.json)'
    )
    parser.add_argument(
        '--output-dir',
        help='Output directory for cleaned files'
    )

    args = parser.parse_args()

    total_files = 0
    total_exchanges = 0
    total_messages = 0

    for file_path in args.files:
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            continue

        output_path = None
        if args.output_dir:
            filename = os.path.basename(file_path)
            output_path = os.path.join(args.output_dir, filename)

        try:
            exchanges, messages = clean_file(
                file_path,
                output_path,
                args.in_place
            )
            total_files += 1
            total_exchanges += exchanges
            total_messages += messages
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    print("\n" + "="*60)
    print(f"Total files processed: {total_files}")
    print(f"Total exchanges cleaned: {total_exchanges}")
    print(f"Total messages removed: {total_messages}")
    print("="*60)


if __name__ == '__main__':
    main()
