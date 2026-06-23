import os
import zlib

def read_object(git_dir, sha):
    path = os.path.join(git_dir, 'objects', sha[:2], sha[2:])
    if not os.path.exists(path):
        # Let's search inside pack files if it's not a loose object.
        return None
    with open(path, 'rb') as f:
        compressed_data = f.read()
    decompressed_data = zlib.decompress(compressed_data)
    null_idx = decompressed_data.find(b'\x00')
    header = decompressed_data[:null_idx]
    content = decompressed_data[null_idx + 1:]
    obj_type, size = header.split(b' ')
    return obj_type, content

def parse_tree(content):
    entries = []
    i = 0
    n = len(content)
    while i < n:
        space_idx = content.find(b' ', i)
        if space_idx == -1:
            break
        mode = content[i:space_idx]
        null_idx = content.find(b'\x00', space_idx)
        if null_idx == -1:
            break
        name = content[space_idx+1:null_idx].decode('utf-8')
        sha_bytes = content[null_idx+1:null_idx+21]
        sha = sha_bytes.hex()
        entries.append((mode, name, sha))
        i = null_idx + 21
    return entries

def find_in_tree(git_dir, tree_sha, path_parts):
    current_sha = tree_sha
    for part in path_parts:
        res = read_object(git_dir, current_sha)
        if not res:
            return None
        obj_type, content = res
        if obj_type != b'tree':
            return None
        entries = parse_tree(content)
        found = False
        for mode, name, sha in entries:
            if name == part:
                current_sha = sha
                found = True
                break
        if not found:
            return None
    return current_sha

git_dir = 'c:/Users/e.bartalucci.INGEGNO.001/Documents/Antigravity/suite-ingegneria/.git'
commit_sha = '3c69c450e42b7ee6f7afb462aea3363e86845181'

res = read_object(git_dir, commit_sha)
if res:
    obj_type, commit_content = res
    lines = commit_content.split(b'\n')
    tree_sha = lines[0].split(b' ')[1].decode('utf-8')
    print(f"Tree SHA for commit {commit_sha}: {tree_sha}")
    
    tools_tree_sha = find_in_tree(git_dir, tree_sha, ['src', 'tools'])
    if tools_tree_sha:
        print(f"src/tools tree SHA: {tools_tree_sha}")
        _, tools_content = read_object(git_dir, tools_tree_sha)
        entries = parse_tree(tools_content)
        for mode, name, sha in entries:
            if name == 'ToolCalcoliElettrici.tsx':
                print(f"Found {name} with blob SHA {sha}")
                # Let's inspect the first 300 chars of the blob
                _, blob_content = read_object(git_dir, sha)
                print("First 300 chars of ToolCalcoliElettrici.tsx:")
                print(blob_content[:300].decode('utf-8', errors='ignore'))
                # Search for formatNumber in the blob
                if b'formatNumber' in blob_content:
                    print("--> formatNumber is present in this commit!")
                else:
                    print("--> formatNumber is NOT present in this commit.")
    else:
        print("src/tools not found in tree.")
else:
    print(f"Object {commit_sha} not found (could be in pack).")
