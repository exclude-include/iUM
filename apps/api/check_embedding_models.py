import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

def check_embedding_models():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ ERROR: GOOGLE_API_KEY not found in .env file")
        return

    with open("embedding_models_utf8.txt", "w", encoding="utf-8") as f:
        f.write(f"Checking embedding models with API Key: {api_key[:10]}...\n")
        genai.configure(api_key=api_key)

        try:
            f.write("\nFetching available models...\n\n")
            all_models = genai.list_models()
            
            embed_models = []
            for model in all_models:
                if 'embedContent' in model.supported_generation_methods:
                    embed_models.append(model)
            
            if not embed_models:
                f.write("No embedding models found.\n")
                return

            f.write(f"Found {len(embed_models)} embedding model(s):\n\n")
            for model in embed_models:
                f.write(f"Model Name: {model.name}\n")
                f.write(f"   Display Name: {model.display_name}\n")
                f.write(f"   Supported Methods: {model.supported_generation_methods}\n")
                f.write("\n")

        except Exception as e:
            f.write(f"Error: {e}\n")

if __name__ == "__main__":
    check_embedding_models()
