#!/usr/bin/env python
"""
Compile script for PharmaNFT contract
Supports multiple Python versions and compilation methods
"""
import sys
import os
import subprocess
import platform

if len(sys.argv) < 2:
    print("Usage: python compile.py <contract_file>")
    sys.exit(1)

contract_file = sys.argv[1]
if not os.path.exists(contract_file):
    print(f"❌ Error: Contract file not found: {contract_file}")
    sys.exit(1)

print(f"📦 Compiling {contract_file}...")
print(f"   Python version: {sys.version}")

# Method 1: Try neo3-boa.exe from Scripts directory
def try_neo3_boa_exe():
    """Try to find and use neo3-boa.exe"""
    python_version = f"Python{sys.version_info.major}{sys.version_info.minor}"
    
    # Try common locations
    possible_paths = [
        os.path.expanduser(f'~\\AppData\\Roaming\\{python_version}\\Scripts\\neo3-boa.exe'),
        os.path.expanduser(f'~\\AppData\\Local\\Programs\\Python\\{python_version}\\Scripts\\neo3-boa.exe'),
        os.path.join(os.path.dirname(sys.executable), 'Scripts', 'neo3-boa.exe'),
    ]
    
    for exe_path in possible_paths:
        if os.path.exists(exe_path):
            print(f"   Found: {exe_path}")
            result = subprocess.run([exe_path, 'compile', contract_file], 
                                  capture_output=True, text=True, cwd=os.getcwd())
            if result.returncode == 0:
                print("✅ Compilation successful!")
                if result.stdout:
                    print(result.stdout)
                return True
            else:
                print(f"❌ Error: {result.stderr}")
                return False
    
    return False

# Method 2: Try python -m boa
def try_python_module():
    """Try to use python -m boa"""
    try:
        result = subprocess.run([sys.executable, '-m', 'boa', 'compile', contract_file],
                              capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0:
            print("✅ Compilation successful!")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    except Exception as e:
        return False

# Method 3: Try with site-packages path
def try_with_site_packages():
    """Try with explicit site-packages path"""
    python_version = f"Python{sys.version_info.major}{sys.version_info.minor}"
    possible_sites = [
        os.path.expanduser(f'~\\AppData\\Roaming\\{python_version}\\site-packages'),
        os.path.expanduser(f'~\\AppData\\Local\\Programs\\Python\\{python_version}\\site-packages'),
    ]
    
    for site_path in possible_sites:
        if os.path.exists(site_path):
            python_cmd = f"""
import sys
sys.path.insert(0, r'{site_path}')
try:
    from boa import compile
    compile(r'{os.path.abspath(contract_file)}')
except ImportError:
    import neo3_boa
    neo3_boa.compile(r'{os.path.abspath(contract_file)}')
"""
            result = subprocess.run([sys.executable, '-c', python_cmd],
                                  capture_output=True, text=True, cwd=os.getcwd())
            if result.returncode == 0:
                print("✅ Compilation successful!")
                return True
    
    return False

# Try methods in order
success = False
if not success:
    print("   Trying Method 1: neo3-boa.exe...")
    success = try_neo3_boa_exe()

if not success:
    print("   Trying Method 2: python -m boa...")
    success = try_python_module()

if not success:
    print("   Trying Method 3: with site-packages...")
    success = try_with_site_packages()

if not success:
    print("\n❌ All compilation methods failed!")
    print("\n💡 Solutions:")
    print("   1. Install neo3-boa: pip install neo3-boa")
    print("   2. Use Python 3.8-3.11 (Python 3.14 not supported)")
    print("   3. Compile online: https://neocompiler.io/")
    sys.exit(1)

# Check if output files exist
nef_file = contract_file.replace('.py', '.nef')
manifest_file = contract_file.replace('.py', '.manifest.json')

if os.path.exists(nef_file) and os.path.exists(manifest_file):
    print(f"\n✅ Output files created:")
    print(f"   - {nef_file}")
    print(f"   - {manifest_file}")
else:
    print(f"\n⚠️  Warning: Output files not found!")
    print(f"   Expected: {nef_file}, {manifest_file}")
