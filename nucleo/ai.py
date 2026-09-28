"""Único punto de acceso a Gemini para palabras y explicaciones."""
import os
from google import genai

MODELS = ('gemini-flash-latest', 'gemini-2.5-flash')


def generate(prompt):
    key = os.getenv('GEMINI_API_KEY')
    if not key:
        return None, None
    configured = os.getenv('GEMINI_MODEL', MODELS[0]).removeprefix('models/')
    if configured == 'gemini-pro':
        configured = MODELS[0]
    client = genai.Client(api_key=key)
    last_error = None
    for model in dict.fromkeys((configured, *MODELS)):
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            return (response.text or '').strip(), model
        except Exception as exc:
            last_error = exc
    raise last_error
