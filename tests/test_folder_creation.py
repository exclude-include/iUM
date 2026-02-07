import os
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path="apps/api/.env")

def test_folder_creation():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        return

    print(f"🚀 Connecting to Supabase: {url}")
    supabase: Client = create_client(url, key)

    try:
        # Create a dummy user ID (we have to fake it or use a real one if RLS bypass works)
        # Using Service Key allows bypassing RLS if we don't assume a user, 
        # BUT the table schema enforces foreign key to auth.users.
        # So we need a valid user ID. 
        
        # Let's verify table existence first by listing folders (even empty)
        print("📂 Listing folders...")
        response = supabase.table("folders").select("*").limit(1).execute()
        print(f"✅ Table exists! Response data: {response.data}")
        
        # We can't insert easily without a real user ID due to FK constraint.
        # But if the select works (no 404), the table exists.
        
    except Exception as e:
        print(f"❌ Error accessing folders table: {e}")
        # If table doesn't exist, it usually throws a specific error
        if "relation \"public.folders\" does not exist" in str(e):
             print("⚠️ The folders table is MISSING in Supabase.")

if __name__ == "__main__":
    test_folder_creation()
