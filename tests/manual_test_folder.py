import requests
import json
import time

API_URL = "http://localhost:8000/api/agent/message"

def run_test(folder_id: str, case_name: str, expected_found: bool):
    print(f"\n--- Running Test Case: {case_name} (Folder ID: {folder_id}) ---")
    
    payload = {
        "message": "What is in this document?", # 내용 무관하게 검색되는지 확인
        "conversation_id": f"test-sess-{int(time.time())}",
        "folder_id": folder_id
    }
    
    found_sources = False
    
    try:
        with requests.post(API_URL, json=payload, stream=True) as response:
            if response.status_code != 200:
                print(f"Error: {response.status_code} - {response.text}")
                return

            print("Response Stream:")
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith("data: "):
                        data_str = decoded_line[6:]
                        try:
                            data = json.loads(data_str)
                            status = data.get("status")
                            
                            if status == "progress":
                                # print(f"  [{data.get('step')}] {data.get('message')}")
                                pass
                            
                            elif status == "complete":
                                result = data.get("data", {})
                                sources = result.get("sources", [])
                                print(f"  [COMPLETE] Sources found: {len(sources)}")
                                if sources:
                                    print(f"  - Source 1: {sources[0].get('title')}")
                                    found_sources = True
                                else:
                                    print("  - No sources found.")
                                    
                        except json.JSONDecodeError:
                            pass
                            
    except Exception as e:
        print(f"Request failed: {e}")

    if expected_found and found_sources:
        print(f"✅ PASSED: Document found as expected.")
    elif not expected_found and not found_sources:
        print(f"✅ PASSED: Document correctly NOT found.")
    else:
        print(f"❌ FAILED: Expected found={expected_found}, but got found={found_sources}")

if __name__ == "__main__":
    # Test 1: Right Folder ID
    run_test("test-folder-123", "Correct Folder", expected_found=True)
    
    # Test 2: Wrong Folder ID
    run_test("wrong-folder-999", "Wrong Folder", expected_found=False)
