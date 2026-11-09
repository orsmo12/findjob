"""
test_models.py — Compare available Groq models for career analysis quality.
"""
from dotenv import load_dotenv
load_dotenv()
from groq import Groq
import os, time

client = Groq(api_key=os.environ['GROQ_API_KEY'])

prompt = """You are a career coach. A junior developer applies for "Python Backend Engineer" role.
Their skills: Python, React, OpenCV, TensorFlow, Git.
Job requires: Python, FastAPI, PostgreSQL, Docker, CI/CD.

Return JSON only: {"score": 0-100, "top_gap": "most critical missing skill", "one_tip": "specific actionable advice"}"""

for model in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]:
    try:
        t0 = time.time()
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        elapsed = time.time() - t0
        content = r.choices[0].message.content.strip()
        tokens = r.usage.completion_tokens
        print(f"\n[{model}] {elapsed:.1f}s | {tokens} tokens")
        print(content[:300])
    except Exception as e:
        print(f"\n[{model}] ERROR: {e}")
