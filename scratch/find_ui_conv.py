import json
import os

transcript_full_path = r"C:\Users\e.bartalucci.INGEGNO.001\.gemini\antigravity\brain\51a13263-4e0f-4d9e-932c-1cdf1458e090\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(transcript_full_path):
    with open(transcript_full_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            if data.get("step_index") == 5102:
                # Let's inspect the entire tool_calls or arguments
                tcs = data.get("tool_calls", [])
                for tc in tcs:
                    args = tc.get("args", {})
                    # If it uses replacement chunks
                    chunks = args.get("ReplacementChunks") or []
                    print(f"Chunks count: {len(chunks)}")
                    for idx, chunk in enumerate(chunks):
                        print(f"--- Chunk {idx} ---")
                        print(f"Start: {chunk.get('StartLine')} End: {chunk.get('EndLine')}")
                        print("Replacement content snippet:")
                        print(chunk.get("ReplacementContent")[:1500])
                        print("====================================")
                    # If it is a whole file replacement
                    content = args.get("ReplacementContent") or args.get("CodeContent")
                    if content:
                        print(f"Whole content size: {len(content)}")
                        # Print occurrences of convCategory or select
                        lines = content.split('\n')
                        for i, l in enumerate(lines):
                            if 'convCategory' in l or 'CATEGORY_LABELS' in l:
                                print(f"{i+1}: {l}")
                break
