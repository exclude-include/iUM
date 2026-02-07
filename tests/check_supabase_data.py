import os
import sys

# Add app directory to path to import utils
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from dotenv import load_dotenv
load_dotenv("apps/api/.env")

from utils.supabase_client import get_supabase_client

def check_data():
    try:
        client = get_supabase_client()
        
        # Check Sessions
        print("Checking Chat Sessions...")
        sessions = client.table("chat_sessions").select("*").execute()
        print(f"Total Sessions: {len(sessions.data)}")
        for s in sessions.data:
            print(f" - {s['id']} (User: {s['user_id']})")
            
        print("\nChecking Chat Messages...")
        messages = client.table("chat_messages").select("*").execute()
        print(f"Total Messages: {len(messages.data)}")
        for m in messages.data:
            print(f" - [{m['role']}] {m['content']} (Session: {m['session_id']})")
            
    except Exception as e:
        print(f"Error checking Supabase: {e}")

if __name__ == "__main__":
    check_data()
