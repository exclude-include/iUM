"""
Script to check available Google Gemini models for the configured API key.
This helps identify the correct model names to use in the RAG chain.
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

def check_available_models():
    """
    Check and list all available Google Gemini models that support generateContent.
    """
    # Get API key from environment (Priority: GOOGLE_GEMINI_API_KEY > GOOGLE_API_KEY)
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        print("❌ ERROR: GOOGLE_GEMINI_API_KEY not found in .env file")
        print("   Please ensure GOOGLE_GEMINI_API_KEY is set in apps/api/.env")
        return
    
    print(f"🔑 Using Gemini API Key: {api_key[:10]}...{api_key[-4:]}")
    print("=" * 60)
    
    try:
        # Configure the API
        genai.configure(api_key=api_key)
        
        # List all available models
        print("\n📋 Fetching available models...\n")
        all_models = genai.list_models()
        
        # Filter models that support generateContent (text generation)
        text_models = []
        for model in all_models:
            # Check if model supports generateContent
            if 'generateContent' in model.supported_generation_methods:
                text_models.append(model)
        
        if not text_models:
            print("⚠️  No models found that support generateContent")
            print("   This might indicate an API key issue or API access problem.")
            return
        
        print(f"✅ Found {len(text_models)} model(s) that support text generation:\n")
        print("-" * 60)
        
        for model in text_models:
            model_name = model.name
            display_name = model.display_name if hasattr(model, 'display_name') else "N/A"
            
            print(f"📌 Model Name: {model_name}")
            print(f"   Display Name: {display_name}")
            
            # Show supported methods
            if hasattr(model, 'supported_generation_methods'):
                methods = model.supported_generation_methods
                print(f"   Supported Methods: {', '.join(methods)}")
            
            # Show input/output token limits if available
            if hasattr(model, 'input_token_limit'):
                print(f"   Input Token Limit: {model.input_token_limit:,}")
            if hasattr(model, 'output_token_limit'):
                print(f"   Output Token Limit: {model.output_token_limit:,}")
            
            print()
        
        print("-" * 60)
        print("\n💡 Usage Tips:")
        print("   - Use the exact 'Model Name' (e.g., 'models/gemini-pro') in your code")
        print("   - Some models may require the full path, others may work with just the short name")
        print("   - For LangChain, try both formats if one doesn't work")
        print("\n📝 Recommended models for chat/text generation:")
        for model in text_models:
            model_name = model.name
            # Extract short name (e.g., "gemini-pro" from "models/gemini-pro")
            short_name = model_name.replace("models/", "")
            print(f"   - {short_name} (full: {model_name})")
        
    except Exception as e:
        print(f"\n❌ ERROR: Failed to fetch models")
        print(f"   Error Type: {type(e).__name__}")
        print(f"   Error Message: {str(e)}")
        print("\n🔍 Troubleshooting:")
        print("   1. Verify your GOOGLE_API_KEY is correct in .env")
        print("   2. Check your internet connection")
        print("   3. Ensure google-generativeai is installed: pip install google-generativeai")
        print("   4. Verify your API key has access to the Generative AI API")
        return

if __name__ == "__main__":
    print("=" * 60)
    print("🔍 Google Gemini Model Checker")
    print("=" * 60)
    check_available_models()

