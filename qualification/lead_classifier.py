import os
import json
from services.ai_agent import client

def clean_json_response(response_text):
    text = response_text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end+1]
    return text

def classify_lead_intent(title: str, snippet: str) -> dict:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    prompt_path = os.path.join(base_dir, "prompts", "lead_prompt.txt")
    with open(prompt_path, "r", encoding="utf-8") as f:
        template = f.read()

    prompt = template.format(title=title, snippet=snippet)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    raw_content = response.choices[0].message.content
    cleaned = clean_json_response(raw_content)
    return json.loads(cleaned)
