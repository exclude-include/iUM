import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/agent"

def test_memory():
    print("1. Starting Session - Query 1: 'My favorite color is blue'")
    
    # 1. First Request (New Session)
    payload1 = {
        "message": "My favorite color is blue.",
        "conversation_id": None # New session
    }
    
    session_id = None
    
    try:
        # Using streaming endpoint /message
        response = requests.post(f"{BASE_URL}/message", json=payload1, stream=True)
        response.raise_for_status()
        
        print("Response Stream 1:")
        full_response_1 = ""
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    json_str = decoded_line[6:]
                    data = json.loads(json_str)
                    
                    if data.get("status") == "progress":
                        print(f"  [{data['step']}] {data['message']}")
                    elif data.get("status") == "complete":
                        result = data.get("data", {})
                        full_response_1 = result.get("message")
                        session_id = result.get("conversation_id")
                        print(f"  [COMPLETE] Answer: {full_response_1}")
                        print(f"  [SESSION ID]: {session_id}")
        
    except Exception as e:
        print(f"Error in Request 1: {e}")
        return

    import time
    
    # ... previous code ...

    if not session_id:
        print("Failed to get session_id")
        return

    print(f"Session ID received: {session_id}")
    print("Waiting for async save to complete...")
    time.sleep(2) # Wait for backend to save message

    print("\n" + "="*50 + "\n")
    print(f"2. Continuing Session ({session_id}) - Query 2: 'What is my favorite color?'")

    # 2. Second Request (Existing Session)
    payload2 = {
        "message": "What is my favorite color?",
        "conversation_id": session_id # Reuse session_id
    }
    
    try:
        response = requests.post(f"{BASE_URL}/message", json=payload2, stream=True)
        response.raise_for_status()
        
        print("Response Stream 2:")
        full_response_2 = ""
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    json_str = decoded_line[6:]
                    data = json.loads(json_str)
                    
                    if data.get("status") == "progress":
                        print(f"  [{data['step']}] {data['message']}")
                    elif data.get("status") == "complete":
                        result = data.get("data", {})
                        full_response_2 = result.get("message")
                        print(f"  [COMPLETE] Answer: {full_response_2}")
        
        # Validation
        if "blue" in full_response_2.lower():
            print("\n✅ TEST PASSED: Memory successfully recalled context.")
        else:
            print("\n❌ TEST FAILED: Memory did not recall context.")
            
    except Exception as e:
        print(f"Error in Request 2: {e}")

if __name__ == "__main__":
    test_memory()
