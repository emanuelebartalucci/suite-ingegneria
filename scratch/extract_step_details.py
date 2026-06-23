import json
import os

transcript_full_path = r"C:\Users\e.bartalucci.INGEGNO.001\.gemini\antigravity\brain\51a13263-4e0f-4d9e-932c-1cdf1458e090\.system_generated\logs\transcript_full.jsonl"

target_steps = [5100, 5108, 5112, 5118]

if os.path.exists(transcript_full_path):
    with open(transcript_full_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            step = data.get("step_index")
            if step in target_steps:
                print(f"\n=================== STEP {step} ===================")
                tcs = data.get("tool_calls", [])
                for tc in tcs:
                    args = tc.get("args", {})
                    target_file = args.get("TargetFile") or args.get("TargetFile") or ""
                    if "ToolCalcoliVari.tsx" in target_file:
                        repl = args.get("ReplacementContent") or args.get("CodeContent") or ""
                        if repl:
                            print(f"ReplacementContent ({len(repl)} chars):")
                            print(repl[:1200])
                            if len(repl) > 1200:
                                print("...")
                                print(repl[-1200:])
                        chunks = args.get("ReplacementChunks") or []
                        if chunks:
                            print(f"Chunks ({len(chunks)}):")
                            for idx, chunk in enumerate(chunks):
                                print(f"  Chunk {idx}: Start={chunk.get('StartLine')} End={chunk.get('EndLine')}")
                                print("  Target:")
                                print(chunk.get("TargetContent"))
                                print("  Replacement:")
                                print(chunk.get("ReplacementContent"))
                                print("-" * 30)
else:
    print("Full transcript not found.")
