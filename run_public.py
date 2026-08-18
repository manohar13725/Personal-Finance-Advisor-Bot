#!/usr/bin/env python3
import subprocess
import sys
import time

print("Starting WealthWise Server with local tunnel support...")
server = subprocess.Popen([sys.executable, "app.py"])

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopping server...")
    server.terminate()
