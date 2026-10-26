from dotenv import load_dotenv
load_dotenv()
from groq import Groq
import os

client = Groq(api_key=os.environ['GROQ_API_KEY'])

# Try all available models
for model in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "allam-2-7b"]:
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in one sentence."}],
            max_tokens=50,
        )
        content = response.choices[0].message.content
        reason = response.choices[0].finish_reason
        print(f"[{model}] OK — reason={reason} — {repr(content[:80])}")
    except Exception as e:
        print(f"[{model}] ERROR: {e}")
