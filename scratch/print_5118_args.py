import json
import os

transcript_full_path = r"C:\Users\e.bartalucci.INGEGNO.001\.gemini\antigravity\brain\51a13263-4e0f-4d9e-932c-1cdf1458e090\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(transcript_full_path):
    with open(transcript_full_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            if data.get("step_index") == 5118:
                tcs = data.get("tool_calls", [])
                for tc in tcs:
                    args = tc.get("args", {})
                    print("Tool call name:", tc.get("name"))
                    print("TargetFile:", args.get("TargetFile"))
                    print("StartLine:", args.get("StartLine"))
                    print("EndLine:", args.get("EndLine"))
                    target_content = args.get("TargetContent", "")
                    print(f"TargetContent Length: {len(target_content)}")
                    print("TargetContent:")
                    print(target_content[:200])
                    print("...")
                    print(target_content[-200:])
                    repl_content = args.get("ReplacementContent", "")
                    print(f"ReplacementContent Length: {len(repl_content)}")
                    print("ReplacementContent ends with:")
                    print(repl_content[-300:])
                    break
else:
    print("Full transcript not found.")
