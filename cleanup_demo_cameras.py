#!/usr/bin/env python3
"""
Utility script to clean up demo cameras from the database.
Run this to remove any persisted demo cameras that shouldn't be there.
"""

import sys
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mizva import db as dbm

def main():
    # Connect to DB
    db_path = dbm.get_db_path(ROOT)
    conn = dbm.connect(db_path)
    
    # List all cameras
    cameras = dbm.list_cameras(conn)
    print(f"Found {len(cameras)} cameras in database:")
    
    for cam in cameras:
        print(f"  - {cam['id']} ({cam.get('name', 'no name')}) - enabled: {cam.get('enabled', 0)}")
    
    # Ask user which ones to remove
    if cameras:
        print("\nDo you want to remove all cameras? (y/N): ", end="")
        response = input().strip().lower()
        
        if response == 'y':
            for cam in cameras:
                dbm.remove_camera(conn, cam['id'])
                print(f"Removed camera: {cam['id']}")
            print(f"Removed {len(cameras)} cameras.")
        else:
            print("No cameras removed.")
    else:
        print("No cameras to remove.")
    
    conn.close()

if __name__ == "__main__":
    main()