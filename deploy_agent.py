#!/usr/bin/env python3
"""
InterviewReady Deployment Agent - GUI Version
Automates GitHub repo creation and Netlify deployment
"""

import os
import sys
import subprocess
import json
import time
import shutil
import threading
from pathlib import Path
from datetime import datetime

# Try to import tkinter
try:
    import tkinter as tk
    from tkinter import ttk, scrolledtext, messagebox, filedialog
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False
    print("ERROR: tkinter is not available. Please install tkinter.")
    sys.exit(1)

# Get script directory for cross-platform paths
SCRIPT_DIR = Path(__file__).parent.absolute()
APP_DIR = SCRIPT_DIR / "app"
BUILD_DIR = SCRIPT_DIR / "app" / "dist"
LOG_FILE = SCRIPT_DIR / "deploy_log.txt"


class DeploymentAgentGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("InterviewReady Deployment Agent")
        self.root.geometry("900x700")
        self.root.minsize(800, 600)
        
        self.root.grid_rowconfigure(1, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        
        self.github_token = tk.StringVar()
        self.netlify_token = tk.StringVar()
        self.github_username = tk.StringVar()
        self.repo_name = tk.StringVar(value="interview-ready")
        self.site_name = tk.StringVar(value="interview-ready-app")
        self.is_running = False
        
        self.create_widgets()
        self.log_message("=" * 60)
        self.log_message("InterviewReady Deployment Agent Started")
        self.log_message("=" * 60)
        self.log_message(f"Log file: {LOG_FILE}")
        self.log_message(f"App directory: {APP_DIR}")
        self.log_message("")
        self.log_message("Please enter your credentials and click 'Start Deployment'")
        self.log_message("")
        
    def create_widgets(self):
        # Header
        header_frame = tk.Frame(self.root, bg="#2d333b", padx=20, pady=15)
        header_frame.grid(row=0, column=0, sticky="ew")
        
        title_label = tk.Label(header_frame, text="InterviewReady Deployment Agent",
                               font=("Helvetica", 16, "bold"), fg="#ffffff", bg="#2d333b")
        title_label.pack()
        
        subtitle_label = tk.Label(header_frame, text="GitHub Repository Creation + Netlify Deployment",
                                  font=("Helvetica", 10), fg="#adbac7", bg="#2d333b")
        subtitle_label.pack()
        
        # Main content
        content_frame = tk.Frame(self.root, padx=20, pady=15)
        content_frame.grid(row=1, column=0, sticky="nsew")
        content_frame.grid_rowconfigure(2, weight=1)
        content_frame.grid_columnconfigure(0, weight=1)
        
        # Credentials frame
        cred_frame = tk.LabelFrame(content_frame, text="Credentials & Configuration",
                                   font=("Helvetica", 11, "bold"), padx=15, pady=15)
        cred_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        cred_frame.grid_columnconfigure(1, weight=1)
        
        # Input fields
        tk.Label(cred_frame, text="GitHub Token:", font=("Helvetica", 10)).grid(row=0, column=0, sticky="w", pady=5)
        self.github_token_entry = tk.Entry(cred_frame, textvariable=self.github_token, show="*", width=50)
        self.github_token_entry.grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=5)
        tk.Button(cred_frame, text="Show", command=lambda: self.toggle_show(self.github_token_entry)).grid(row=0, column=2, padx=(5, 0))
        
        tk.Label(cred_frame, text="Netlify Token:", font=("Helvetica", 10)).grid(row=1, column=0, sticky="w", pady=5)
        self.netlify_token_entry = tk.Entry(cred_frame, textvariable=self.netlify_token, show="*", width=50)
        self.netlify_token_entry.grid(row=1, column=1, sticky="ew", padx=(10, 0), pady=5)
        tk.Button(cred_frame, text="Show", command=lambda: self.toggle_show(self.netlify_token_entry)).grid(row=1, column=2, padx=(5, 0))
        
        tk.Label(cred_frame, text="GitHub Username:", font=("Helvetica", 10)).grid(row=2, column=0, sticky="w", pady=5)
        tk.Entry(cred_frame, textvariable=self.github_username, width=50).grid(row=2, column=1, sticky="ew", padx=(10, 0), pady=5)
        
        tk.Label(cred_frame, text="Repository Name:", font=("Helvetica", 10)).grid(row=3, column=0, sticky="w", pady=5)
        tk.Entry(cred_frame, textvariable=self.repo_name, width=50).grid(row=3, column=1, sticky="ew", padx=(10, 0), pady=5)
        
        tk.Label(cred_frame, text="Netlify Site Name:", font=("Helvetica", 10)).grid(row=4, column=0, sticky="w", pady=5)
        tk.Entry(cred_frame, textvariable=self.site_name, width=50).grid(row=4, column=1, sticky="ew", padx=(10, 0), pady=5)
        
        # Help text
        help_frame = tk.Frame(content_frame)
        help_frame.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        
        help_text = """How to get your tokens:
  GitHub Token: https://github.com/settings/tokens (repo scope required)
  Netlify Token: https://app.netlify.com/user/applications#personal-access-tokens

Troubleshooting npm not found:
  Make sure Node.js is installed: https://nodejs.org/
  If npm is still not found, reinstall Node.js and select "Add to PATH""""
        
        help_label = tk.Label(help_frame, text=help_text, font=("Helvetica", 9), fg="#666666", justify=tk.LEFT)
        help_label.pack(anchor="w")
        
        # Log frame
        log_frame = tk.LabelFrame(content_frame, text="Deployment Log", font=("Helvetica", 11, "bold"), padx=10, pady=10)
        log_frame.grid(row=2, column=0, sticky="nsew", pady=(0, 10))
        log_frame.grid_rowconfigure(0, weight=1)
        log_frame.grid_columnconfigure(0, weight=1)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, font=("Consolas", 10),
                                                   bg="#1e1e1e", fg="#d4d4d4", padx=10, pady=10)
        self.log_text.grid(row=0, column=0, sticky="nsew")
        
        # Buttons
        button_frame = tk.Frame(content_frame)
        button_frame.grid(row=3, column=0, sticky="ew")
        
        self.start_button = tk.Button(button_frame, text="Start Deployment", command=self.start_deployment,
                                      bg="#238636", fg="white", font=("Helvetica", 11, "bold"),
                                      padx=30, pady=10, cursor="hand2")
        self.start_button.pack(side=tk.LEFT, padx=(0, 10))
        
        tk.Button(button_frame, text="Clear Log", command=self.clear_log, font=("Helvetica", 10),
                  padx=20, pady=10).pack(side=tk.LEFT, padx=(0, 10))
        
        tk.Button(button_frame, text="Open Log File", command=self.open_log_file, font=("Helvetica", 10),
                  padx=20, pady=10).pack(side=tk.LEFT)
        
        # Status bar
        self.status_var = tk.StringVar(value="Ready")
        status_bar = tk.Label(self.root, textvariable=self.status_var, bd=1, relief=tk.SUNKEN, anchor=tk.W, font=("Helvetica", 9))
        status_bar.grid(row=2, column=0, sticky="ew")
        
    def toggle_show(self, entry):
        entry.config(show="" if entry.cget("show") == "*" else "*")
            
    def log_message(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] {message}\n"
        
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.root.update_idletasks()
        
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(log_line)
        except Exception as e:
            pass
            
    def clear_log(self):
        self.log_text.delete(1.0, tk.END)
        
    def open_log_file(self):
        try:
            if LOG_FILE.exists():
                if sys.platform == "darwin":
                    subprocess.run(["open", str(LOG_FILE)])
                elif sys.platform == "win32":
                    os.startfile(str(LOG_FILE))
                else:
                    subprocess.run(["xdg-open", str(LOG_FILE)])
            else:
                messagebox.showinfo("Log File", f"Log file not found at:\n{LOG_FILE}")
        except Exception as e:
            messagebox.showerror("Error", f"Could not open log file:\n{e}")
            
    def validate_inputs(self):
        if not self.github_token.get().strip():
            messagebox.showerror("Error", "Please enter your GitHub Token!")
            return False
        if not self.netlify_token.get().strip():
            messagebox.showerror("Error", "Please enter your Netlify Token!")
            return False
        if not self.github_username.get().strip():
            messagebox.showerror("Error", "Please enter your GitHub Username!")
            return False
        if not self.repo_name.get().strip():
            messagebox.showerror("Error", "Please enter a Repository Name!")
            return False
        if not self.site_name.get().strip():
            messagebox.showerror("Error", "Please enter a Netlify Site Name!")
            return False
        return True
        
    def start_deployment(self):
        if not self.validate_inputs():
            return
        if self.is_running:
            messagebox.showwarning("Warning", "Deployment is already running!")
            return
            
        self.is_running = True
        self.start_button.config(state=tk.DISABLED, text="Deploying...")
        self.status_var.set("Deployment in progress...")
        
        self.log_text.delete(1.0, tk.END)
        self.log_message("=" * 60)
        self.log_message("Starting Deployment Process")
        self.log_message("=" * 60)
        
        thread = threading.Thread(target=self.run_deployment, daemon=True)
        thread.start()
        
    def run_deployment(self):
        try:
            success = self.deploy()
            if success:
                self.status_var.set("Deployment completed successfully!")
                self.root.after(0, lambda: messagebox.showinfo("Success", 
                    f"Deployment completed!\n\nGitHub: https://github.com/{self.github_username.get()}/{self.repo_name.get()}\n"
                    f"Netlify: https://{self.site_name.get()}.netlify.app"))
            else:
                self.status_var.set("Deployment failed!")
                self.root.after(0, lambda: messagebox.showerror("Error", "Deployment failed! Check the log for details."))
        except Exception as e:
            self.log_message(f"\nFATAL ERROR: {e}")
            self.status_var.set(f"Error: {e}")
            self.root.after(0, lambda: messagebox.showerror("Error", f"Deployment failed:\n{e}"))
        finally:
            self.is_running = False
            self.root.after(0, lambda: self.start_button.config(state=tk.NORMAL, text="Start Deployment"))
            
    def run_command(self, cmd, cwd=None, check=True):
        self.log_message(f"  Running: {' '.join(cmd)}")
        
        # Use shell=True on Windows for better compatibility
        use_shell = sys.platform == "win32"
        
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=use_shell)
        
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    self.log_message(f"    {line}")
                
        if result.returncode != 0:
            if result.stderr:
                for line in result.stderr.strip().split('\n'):
                    if line.strip():
                        self.log_message(f"    ERROR: {line}")
            if check:
                raise subprocess.CalledProcessError(result.returncode, cmd)
                
        return result.stdout.strip()
        
    def check_dependencies(self):
        self.log_message("")
        self.log_message("=" * 60)
        self.log_message("Checking Dependencies")
        self.log_message("=" * 60)
        
        # Check git
        try:
            self.run_command(["git", "--version"], check=False)
            self.log_message("  Git: OK")
        except FileNotFoundError:
            self.log_message("  ERROR: Git not found. Please install git: https://git-scm.com/")
            return False
            
        # Check Node.js
        try:
            self.run_command(["node", "--version"], check=False)
            self.log_message("  Node.js: OK")
        except FileNotFoundError:
            self.log_message("  ERROR: Node.js not found. Please install Node.js: https://nodejs.org/")
            return False
            
        # Check npm - try multiple methods
        npm_found = False
        try:
            self.run_command(["npm", "--version"], check=False)
            self.log_message("  npm: OK")
            npm_found = True
        except FileNotFoundError:
            # Try to find npm in common locations
            if sys.platform == "win32":
                npm_paths = [
                    Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "nodejs" / "npm.cmd",
                    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "nodejs" / "npm.cmd",
                    Path.home() / "AppData" / "Roaming" / "npm" / "npm.cmd",
                ]
                for npm_path in npm_paths:
                    if npm_path.exists():
                        self.log_message(f"  Found npm at: {npm_path}")
                        npm_found = True
                        break
                        
        if not npm_found:
            self.log_message("  ERROR: npm not found in PATH!")
            self.log_message("")
            self.log_message("  To fix this issue:")
            self.log_message("  1. Download and reinstall Node.js from https://nodejs.org/")
            self.log_message("  2. During installation, make sure 'Add to PATH' is checked")
            self.log_message("  3. Restart this application after installation")
            self.log_message("")
            self.log_message("  Alternative: Add npm to PATH manually:")
            self.log_message("  - npm is usually in: C:\\Program Files\\nodejs\\")
            self.log_message("  - Or: %LOCALAPPDATA%\\Programs\\nodejs\\")
            return False
            
        return True
        
    def build_app(self):
        self.log_message("")
        self.log_message("=" * 60)
        self.log_message("Building Application")
        self.log_message("=" * 60)
        
        if not APP_DIR.exists():
            self.log_message(f"  ERROR: App directory not found: {APP_DIR}")
            return False
            
        self.log_message("  Installing dependencies...")
        self.run_command(["npm", "install"], cwd=APP_DIR)
        
        self.log_message("  Building application...")
        self.run_command(["npm", "run", "build"], cwd=APP_DIR)
        
        self.log_message("  Build completed successfully!")
        return True
        
    def create_github_repo(self):
        self.log_message("")
        self.log_message("=" * 60)
        self.log_message("Creating GitHub Repository")
        self.log_message("=" * 60)
        
        import urllib.request
        import urllib.error
        
        github_token = self.github_token.get()
        github_username = self.github_username.get()
        repo_name = self.repo_name.get()
        
        # Check if repo already exists
        try:
            req = urllib.request.Request(
                f"https://api.github.com/repos/{github_username}/{repo_name}",
                headers={"Authorization": f"token {github_token}", "Accept": "application/vnd.github.v3+json"}
            )
            urllib.request.urlopen(req)
            self.log_message(f"  Repository {repo_name} already exists.")
            return True
        except urllib.error.HTTPError as e:
            if e.code != 404:
                self.log_message(f"  ERROR checking repo: {e}")
                return False
                
        # Create new repo
        data = json.dumps({
            "name": repo_name,
            "description": "InterviewReady - Free Marriage-Based Immigration Interview Practice",
            "private": False,
            "auto_init": True
        }).encode()
        
        req = urllib.request.Request(
            "https://api.github.com/user/repos",
            data=data,
            headers={"Authorization": f"token {github_token}", "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"}
        )
        
        try:
            response = urllib.request.urlopen(req)
            result = json.loads(response.read().decode())
            self.log_message(f"  Repository created: {result['html_url']}")
            return True
        except urllib.error.HTTPError as e:
            error_msg = e.read().decode()
            self.log_message(f"  ERROR creating repo: {error_msg}")
            return False
            
    def push_to_github(self):
        self.log_message("")
        self.log_message("=" * 60)
        self.log_message("Pushing to GitHub")
        self.log_message("=" * 60)
        
        github_token = self.github_token.get()
        github_username = self.github_username.get()
        repo_name = self.repo_name.get()
        
        # Initialize git if needed
        git_dir = APP_DIR / ".git"
        if not git_dir.exists():
            self.log_message("  Initializing git repository...")
            self.run_command(["git", "init"], cwd=APP_DIR)
            
        # Configure git
        self.run_command(["git", "config", "user.email", "deploy@interviewready.app"], cwd=APP_DIR)
        self.run_command(["git", "config", "user.name", "Deploy Agent"], cwd=APP_DIR)
        
        # Add remote
        remote_url = f"https://{github_token}@github.com/{github_username}/{repo_name}.git"
        
        try:
            remotes = self.run_command(["git", "remote", "-v"], cwd=APP_DIR)
            if "origin" in remotes:
                self.run_command(["git", "remote", "remove", "origin"], cwd=APP_DIR)
        except:
            pass
            
        self.run_command(["git", "remote", "add", "origin", remote_url], cwd=APP_DIR)
        
        # Create .gitignore
        gitignore_path = APP_DIR / ".gitignore"
        gitignore_content = """# Dependencies
node_modules
.pnp
.pnp.js

# Build
dist
dist-ssr
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment
.env
.env.local
.env.*.local
"""
        with open(gitignore_path, "w") as f:
            f.write(gitignore_content)
            
        self.log_message("  Adding files...")
        self.run_command(["git", "add", "."], cwd=APP_DIR)
        
        self.log_message("  Committing...")
        try:
            self.run_command(["git", "commit", "-m", "Initial commit: InterviewReady app with Supabase integration"], cwd=APP_DIR)
        except subprocess.CalledProcessError:
            self.log_message("  Nothing to commit, continuing...")
            
        self.log_message("  Pushing to GitHub...")
        self.run_command(["git", "branch", "-M", "main"], cwd=APP_DIR)
        self.run_command(["git", "push", "-u", "origin", "main", "--force"], cwd=APP_DIR)
        
        self.log_message(f"  Code pushed to: https://github.com/{github_username}/{repo_name}")
        return True
        
    def deploy_to_netlify(self):
        self.log_message("")
        self.log_message("=" * 60)
        self.log_message("Deploying to Netlify")
        self.log_message("=" * 60)
        
        import urllib.request
        import urllib.error
        import zipfile
        
        netlify_token = self.netlify_token.get()
        site_name = self.site_name.get()
        
        # Check if site exists
        try:
            req = urllib.request.Request(
                f"https://api.netlify.com/api/v1/sites/{site_name}",
                headers={"Authorization": f"Bearer {netlify_token}"}
            )
            response = urllib.request.urlopen(req)
            site_data = json.loads(response.read().decode())
            site_id = site_data["id"]
            self.log_message(f"  Site exists: {site_data['url']}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.log_message("  Creating new Netlify site...")
                data = json.dumps({"name": site_name}).encode()
                req = urllib.request.Request(
                    "https://api.netlify.com/api/v1/sites",
                    data=data,
                    headers={"Authorization": f"Bearer {netlify_token}", "Content-Type": "application/json"}
                )
                response = urllib.request.urlopen(req)
                site_data = json.loads(response.read().decode())
                site_id = site_data["id"]
                self.log_message(f"  Site created: {site_data['url']}")
            else:
                self.log_message(f"  ERROR: {e.read().decode()}")
                return False
                
        self.log_message("  Deploying files...")
        
        if not BUILD_DIR.exists():
            self.log_message(f"  ERROR: Build directory not found: {BUILD_DIR}")
            return False
            
        # Create zip of build directory
        import tempfile
        zip_path = Path(tempfile.gettempdir()) / "netlify_deploy.zip"
        self.log_message("  Creating deployment archive...")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(BUILD_DIR):
                for file in files:
                    file_path = Path(root) / file
                    arcname = str(Path(root).relative_to(BUILD_DIR) / file)
                    zipf.write(file_path, arcname)
                    
        with open(zip_path, "rb") as f:
            req = urllib.request.Request(
                f"https://api.netlify.com/api/v1/sites/{site_id}/deploys",
                data=f.read(),
                headers={"Authorization": f"Bearer {netlify_token}", "Content-Type": "application/zip"}
            )
            
            try:
                response = urllib.request.urlopen(req)
                deploy_data = json.loads(response.read().decode())
                self.log_message(f"  Deploy initiated!")
                self.log_message(f"  Deploy URL: {deploy_data['deploy_url']}")
                self.log_message(f"  Site URL: {deploy_data['url']}")
                self.log_message("  Waiting for deployment to complete...")
                time.sleep(5)
                return True
            except urllib.error.HTTPError as e:
                self.log_message(f"  ERROR deploying: {e.read().decode()}")
                return False
                
    def deploy(self):
        try:
            if not self.check_dependencies():
                return False
            if not self.build_app():
                return False
            if not self.create_github_repo():
                return False
            if not self.push_to_github():
                return False
            if not self.deploy_to_netlify():
                return False
                
            self.log_message("")
            self.log_message("=" * 60)
            self.log_message("DEPLOYMENT SUCCESSFUL!")
            self.log_message("=" * 60)
            self.log_message(f"\nGitHub Repository: https://github.com/{self.github_username.get()}/{self.repo_name.get()}")
            self.log_message(f"Live Site: https://{self.site_name.get()}.netlify.app")
            self.log_message("\nNext steps:")
            self.log_message("  1. Set up your Supabase project")
            self.log_message("  2. Add environment variables to Netlify:")
            self.log_message("     - VITE_SUPABASE_URL")
            self.log_message("     - VITE_SUPABASE_ANON_KEY")
            self.log_message("  3. Configure your admin user in Supabase")
            
            return True
            
        except Exception as e:
            self.log_message(f"\nERROR: Deployment failed - {e}")
            import traceback
            self.log_message(traceback.format_exc())
            return False


def main():
    # Clear or create log file
    try:
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write(f"Deployment Log - Started {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 60 + "\n\n")
    except Exception as e:
        print(f"Warning: Could not create log file: {e}")
        
    root = tk.Tk()
    app = DeploymentAgentGUI(root)
    
    def on_closing():
        if app.is_running:
            if messagebox.askokcancel("Quit", "Deployment is still running. Are you sure you want to quit?"):
                root.destroy()
        else:
            root.destroy()
            
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
