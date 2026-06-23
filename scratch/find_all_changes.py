import json
import os

transcript_path = r"C:\Users\e.bartalucci.INGEGNO.001\.gemini\antigravity\brain\51a13263-4e0f-4d9e-932c-1cdf1458e090\.system_generated\logs\transcript.jsonl"

found_steps = []
if os.path.exists(transcript_path):
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                tool_calls = data.get("tool_calls", [])
                for tc in tool_calls:
                    args = tc.get("args", {})
                    target_file = str(args.get("TargetFile") or args.get("TargetFile") or "")
                    if "ToolCalcoliVari.tsx" in target_file:
                        found_steps.append((data.get("step_index"), tc.get("name")))
            except Exception as e:
                pass
else:
    print("Transcript not found.")

print("Steps modifying ToolCalcoliVari.tsx:")
for step, tool in found_steps:
    print(f"Step {step} using {tool}")
