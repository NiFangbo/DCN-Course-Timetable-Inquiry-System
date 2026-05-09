import json
import os
import subprocess
import sys
import time
import webbrowser
import re

def replace_variables(text: str, context: dict) -> str:
    """Simple variable replacement for ${key.subkey} syntax."""
    pattern = r'\${([^}]+)}'
    
    def replace_match(match):
        key_path = match.group(1)
        keys = key_path.split('.')
        value = context
        try:
            for k in keys:
                value = value[k]
            return str(value)
        except (KeyError, TypeError):
            return match.group(0)
            
    return re.sub(pattern, replace_match, text)

def check_requirements() -> bool:
    """Check if CMake and Python are available."""
    print("[1/5] Checking environment...")
    
    # Check CMake
    try:
        result = subprocess.run(['cmake', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[OK] {result.stdout.splitlines()[0]}")
        else:
            print("[ERROR] CMake not found. Please install CMake and add it to PATH.")
            return False
    except FileNotFoundError:
        print("[ERROR] CMake not found in PATH. Please install CMake first.")
        return False

    # Check MinGW make (critical for Windows)
    try:
        result = subprocess.run(['mingw32-make', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[OK] MinGW Make: {result.stdout.splitlines()[0]}")
        else:
            print("[WARNING] mingw32-make not found. Compilation may fail.")
    except FileNotFoundError:
        print("[ERROR] mingw32-make not found in PATH.")
        print("       Please add MinGW-w64 bin directory to system PATH and restart terminal.")
        return False

    # Check Python
    print(f"[OK] Python {sys.version.split()[0]}")
    return True

def build_project(config: dict, context: dict) -> bool:
    """Run CMake configure and build."""
    print("\n[2/5] Building project...")
    
    for task in config['startupTasks']['build']:
        cmd = replace_variables(task['command'], context)
        print(f"Running: {task['name']}...")
        
        result = subprocess.run(cmd, shell=True)
        if result.returncode != 0:
            print(f"[ERROR] Failed at step: {task['name']}")
            print("       Check the error message above for details.")
            return False
        print(f"[OK] {task['name']} done.")
    return True

def start_services(config: dict, context: dict):
    """Start server and web gui in new windows."""
    print("\n[3/5] Starting services...")
    
    for task in config['startupTasks']['run']:
        # Check required fields
        if 'target' not in task:
            print(f"[ERROR] Task '{task.get('name', 'Unnamed')}' missing 'target' field in config.")
            raise KeyError("'target' field is required for run tasks")
        if 'args' not in task:
            print(f"[ERROR] Task '{task.get('name', 'Unnamed')}' missing 'args' field in config.")
            raise KeyError("'args' field is required for run tasks")
        
        # Build command
        target = replace_variables(task['target'], context)
        args = [replace_variables(arg, context) for arg in task['args']]
        
        print(f"Starting: {task['name']}...")
        
        if sys.platform == 'win32':
            target = target.replace('/', '\\')
            args = [arg.replace('/', '\\') for arg in args]
            
            # Windows: Use 'start' to open a new console window
            full_cmd = subprocess.list2cmdline([target] + args)
            shell_cmd = f'start "{task["name"]}" cmd /k "{full_cmd}"'
        else:
            # Linux/macOS: Run in background
            shell_cmd = f"{target} {' '.join(args)} &"

        subprocess.Popen(shell_cmd, shell=True)
        
        if 'waitSeconds' in task:
            time.sleep(task['waitSeconds'])

def open_browser(config: dict):
    """Open web interface."""
    print("\n[4/5] Opening web interface...")
    try:
        webbrowser.open(config['baseURL'])
        print(f"[OK] Browser opened at {config['baseURL']}")
    except Exception as e:
        print(f"[WARNING] Could not open browser automatically: {e}")
        print(f"         Please manually visit: {config['baseURL']}")

def main():
    # 1. Setup paths
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    # 2. Load config
    config_path = os.path.join(project_root, 'launcher_config.json')
    if not os.path.exists(config_path):
        print(f"[ERROR] Config file not found: {config_path}")
        input("Press Enter to exit...")
        return

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON in config file: {e}")
        input("Press Enter to exit...")
        return

    # 3. Build context for variables
    context = {
        "environment": config['environment'],
        "params": config['params']
    }
    # Ensure paths use forward slashes for internal consistency
    context['params']['projectRoot'] = project_root.replace('\\', '/')

    # 4. Print Header
    print("="*50)
    print(f"   {config['title']}")
    print("="*50)

    # 5. Execute Flow
    try:
        if not check_requirements():
            input("Press Enter to exit...")
            return

        if not build_project(config, context):
            input("Press Enter to exit...")
            return

        start_services(config, context)
        open_browser(config)

        # 6. Complete
        print("\n[5/5] ✅ Startup complete!")
        print("="*50)
        print("   Close the popup windows to stop services.")
        print("   Press Enter here to exit this launcher.")
        print("="*50)
        input()
    except Exception as e:
        print(f"\n[FATAL ERROR] {type(e).__name__}: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()