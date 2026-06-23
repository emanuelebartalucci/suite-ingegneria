import json
import os

transcript_full_path = r"C:\Users\e.bartalucci.INGEGNO.001\.gemini\antigravity\brain\51a13263-4e0f-4d9e-932c-1cdf1458e090\.system_generated\logs\transcript_full.jsonl"
out_path = r"C:\Users\e.bartalucci.INGEGNO.001\Documents\Antigravity\suite-ingegneria\scratch\step_5112.txt"

if os.path.exists(transcript_full_path):
    with open(transcript_full_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            if data.get("step_index") == 5112:
                tcs = data.get("tool_calls", [])
                for tc in tcs:
                    args = tc.get("args", {})
                    target_file = args.get("TargetFile") or ""
                    if "ToolCalcoliVari.tsx" in target_file:
                        repl = args.get("ReplacementContent") or args.get("CodeContent") or ""
                        with open(out_path, 'w', encoding='utf-8') as out:
                            out.write(repl)
                        print(f"Written step 5112 replacement content to {out_path}")
                        break
else:
    print("Full transcript not found.")
