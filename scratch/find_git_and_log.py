import os
import subprocess

possible_git_paths = [
    r"C:\Program Files\Git\cmd\git.exe",
    r"C:\Program Files\Git\bin\git.exe",
    r"C:\Program Files (x86)\Git\cmd\git.exe",
    r"C:\Users\e.bartalucci.INGEGNO.001\AppData\Local\Programs\Git\cmd\git.exe"
]

git_path = "git"
for path in possible_git_paths:
    if os.path.exists(path):
        git_path = path
        break

print(f"Using Git path: {git_path}")

def run_git(args):
    try:
        res = subprocess.run([git_path] + args, capture_output=True, text=True, cwd=r"c:\Users\e.bartalucci.INGEGNO.001\Documents\Antigravity\suite-ingegneria")
        return res.stdout, res.stderr
    except Exception as e:
        return "", str(e)

# Run git log
stdout, stderr = run_git(["log", "-n", "5", "--oneline"])
print("Git Log:")
print(stdout)
if stderr:
    print("Error:", stderr)

# Check differences between f74939e657bef453a1bd2790177680fe8ec9ec8f and 3c69c450e42b7ee6f7afb462aea3363e86845181
stdout, stderr = run_git(["diff", "--name-status", "f74939e657bef453a1bd2790177680fe8ec9ec8f", "3c69c450e42b7ee6f7afb462aea3363e86845181"])
print("\nDiff name-status:")
print(stdout)
