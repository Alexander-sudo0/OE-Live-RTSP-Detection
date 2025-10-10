#!/usr/bin/env python3

import sqlite3
import os

# Check if database exists
db_path = "mizva/db.sqlite"
if not os.path.exists(db_path):
    print(f"Database does not exist at {db_path}")
    exit(1)

print(f"Database exists at {db_path}")

# Connect and check tables
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# List all tables
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables in database:")
for table in tables:
    print(f"  - {table['name']}")

# Check if events table exists
if 'events' in [t['name'] for t in tables]:
    # Get recent events
    events = conn.execute("SELECT * FROM events ORDER BY ts DESC LIMIT 5").fetchall()
    print(f"\nFound {len(events)} recent events:")
    for event in events:
        print(f"  Event {event['id']}: camera_id={event['camera_id']}, thumb_relpath={event['thumb_relpath']}")
else:
    print("No 'events' table found")

# Check what tables we do have and their structure
for table in tables:
    table_name = table['name']
    print(f"\nTable '{table_name}' structure:")
    columns = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    for col in columns:
        print(f"  - {col['name']} ({col['type']})")
    
    # Show a few sample rows
    sample = conn.execute(f"SELECT * FROM {table_name} LIMIT 3").fetchall()
    if sample:
        print(f"  Sample rows: {len(sample)}")
        for row in sample:
            print(f"    {dict(row)}")
    else:
        print(f"  (empty table)")

conn.close()