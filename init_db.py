#!/usr/bin/env python3

import sys
import os
sys.path.append('mizva')

import db as dbm

# Initialize database
DB_PATH = "mizva/db.sqlite"
print(f"Initializing database at {DB_PATH}")

conn = dbm.connect(DB_PATH)
print("Connected to database")

dbm.init_db(conn)
print("Database initialized")

# Check tables
import sqlite3
conn.row_factory = sqlite3.Row
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables created:")
for table in tables:
    print(f"  - {table['name']}")

conn.close()
print("Done!")