
import sys
import os

# Add the apps/api directory to sys.path to allow importing modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/api')))

from utils.react_agent import ReactLearningAgent

def test_generate_chat_message():
    print("Testing _generate_chat_message logic...")
    
    # Initialize agent (mocking dependencies is not strictly needed for this specific method test 
    # as we are just testing the message generation logic which doesn't use the LLM or tools directly)
    # We might need to mock __init__ if it does heavy lifting, but let's try instantiated it.
    # We need a fake API key to avoid init error if strictly checked, but based on code it just gets it.
    if "GOOGLE_API_KEY" not in os.environ:
        os.environ["GOOGLE_API_KEY"] = "dummy"

    try:
        agent = ReactLearningAgent()
    except Exception as e:
        print(f"Agent init failed (expected if no creds, but let's bypass): {e}")
        # If init fails due to missing creds, we can just mock the class or instance.
        class MockAgent(ReactLearningAgent):
            def __init__(self):
                self.accumulated_learning_units = []
                self.detected_topic = "Test Topic"
        agent = MockAgent()
    
    # Ensure detected_topic is set for the test
    agent.detected_topic = "Test Topic"

    # Case 1: No units, No final text -> Should return fallback error
    agent.accumulated_learning_units = []
    msg = agent._generate_chat_message(final_text=None)
    print(f"Case 1 (No units, No text): {msg}")
    assert msg == "답변하기 어렵거나 에러가 발생한 것 같습니다!"

    # Case 2: No units, With final text -> Should return final text (THE FIX)
    agent.accumulated_learning_units = []
    final_text = "I checked the history and found nothing."
    msg = agent._generate_chat_message(final_text=final_text)
    print(f"Case 2 (No units, With text): {msg}")
    assert msg == final_text

    # Case 3: With learning units -> Should return summary message
    agent.accumulated_learning_units = [{"type": "concept", "content": "stuff"}]
    msg = agent._generate_chat_message(final_text="Some text")
    print(f"Case 3 (With units): {msg}")
    assert "explanation about **Test Topic**" in msg

    print("✅ All test cases passed!")

if __name__ == "__main__":
    test_generate_chat_message()
