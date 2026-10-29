import os
import sys
import posixpath
from pathlib import Path
import paramiko

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Default server configuration
SERVER_HOST = os.getenv("DEPLOY_HOST", "192.168.1.85")
SERVER_PORT = int(os.getenv("DEPLOY_PORT", "22"))
SERVER_USER = os.getenv("DEPLOY_USER", "root")
SERVER_PASSWORD = os.getenv("DEPLOY_PASSWORD", "123456789")
REMOTE_DIR = os.getenv("DEPLOY_DIR", "/opt/qqm")

# Root directory of this repository (parent of scripts/)
REPO_ROOT = Path(__file__).resolve().parent.parent

# Files/folders to ignore during SFTP sync
IGNORED_DIRS = {
    "node_modules",
    ".git",
    ".github",
    ".gemini",
    ".vscode",
    ".claude",
    "dist",
    "uploads",
    "coverage",
    "scratch",
    "__pycache__",
    ".system_generated",
}

IGNORED_FILES = {
    ".env",           # Do NOT overwrite server-side production secrets!
    ".DS_Store",
    "Thumbs.db",
}

def log(msg: str):
    print(f"[\033[94mDEPLOY\033[0m] {msg}", flush=True)

def error_log(msg: str):
    print(f"[\033[91mERROR\033[0m] {msg}", file=sys.stderr, flush=True)

def success_log(msg: str):
    print(f"[\033[92mSUCCESS\033[0m] {msg}", flush=True)

def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str):
    parts = remote_path.strip("/").split("/")
    current = "/"
    for part in parts:
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except IOError:
            try:
                sftp.mkdir(current)
            except IOError:
                pass

def sync_files(sftp: paramiko.SFTPClient):
    log(f"Syncing project files to {SERVER_HOST}:{REMOTE_DIR}...")
    uploaded_count = 0

    for root, dirs, files in os.walk(REPO_ROOT):
        # Exclude ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        rel_dir = os.path.relpath(root, REPO_ROOT)
        if rel_dir == ".":
            target_remote_dir = REMOTE_DIR
        else:
            target_remote_dir = posixpath.join(REMOTE_DIR, rel_dir.replace("\\", "/"))

        ensure_remote_dir(sftp, target_remote_dir)

        for f in files:
            if f in IGNORED_FILES:
                continue
            if f.endswith((".log", ".tmp")):
                continue

            local_path = os.path.join(root, f)
            remote_path = posixpath.join(target_remote_dir, f)

            # Compare file size & mtime to avoid unnecessary transfers
            local_stat = os.stat(local_path)
            need_upload = True
            try:
                remote_stat = sftp.stat(remote_path)
                if remote_stat.st_size == local_stat.st_size and int(remote_stat.st_mtime) >= int(local_stat.st_mtime):
                    need_upload = False
            except IOError:
                need_upload = True

            if need_upload:
                try:
                    sftp.put(local_path, remote_path)
                    sftp.utime(remote_path, (int(local_stat.st_atime), int(local_stat.st_mtime)))
                    uploaded_count += 1
                except Exception as ex:
                    error_log(f"Failed to upload {local_path} -> {remote_path}: {ex}")

    log(f"Synced {uploaded_count} updated/new file(s) to remote server.")

def execute_remote_cmd(ssh: paramiko.SSHClient, cmd: str) -> int:
    log(f"Running on {SERVER_HOST}:\n  {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    # Stream live output
    for line in iter(stdout.readline, ""):
        try:
            print(line, end="", flush=True)
        except Exception:
            try:
                print(line.encode("ascii", errors="replace").decode("ascii"), end="", flush=True)
            except Exception:
                pass

    exit_code = stdout.channel.recv_exit_status()
    return exit_code

def main():
    log(f"Connecting to {SERVER_USER}@{SERVER_HOST}:{SERVER_PORT}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(
            hostname=SERVER_HOST,
            port=SERVER_PORT,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=10,
        )
        success_log("Connected to server successfully.")

        # 1. Sync project source code
        sftp = ssh.open_sftp()
        try:
            sync_files(sftp)
        finally:
            sftp.close()

        # 2. Build and restart containers using Docker Compose Production overlay
        deploy_cmd = (
            f"cd {REMOTE_DIR} && "
            "export VITE_API_BASE_URL=http://192.168.1.85:4000/api && "
            "docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
        )
        
        exit_code = execute_remote_cmd(ssh, deploy_cmd)
        if exit_code != 0:
            error_log(f"Deploy command failed with exit code: {exit_code}")
            sys.exit(exit_code)

        # 3. Check container status
        status_cmd = f"cd {REMOTE_DIR} && docker compose ps"
        execute_remote_cmd(ssh, status_cmd)

        success_log(f"Deployment finished! Application is live at:")
        print(f"  -> Frontend: http://{SERVER_HOST}:5173")
        print(f"  -> Backend API: http://{SERVER_HOST}:4000/api")

    except Exception as e:
        error_log(f"SSH/Deployment error: {e}")
        sys.exit(1)
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

