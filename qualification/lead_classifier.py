import os
import json
from services.ai_agent import client

def clean_json_response(response_text):
    cleaned = response_text.strip()
    
    # Remove markdown formatting wraps
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
        
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
        
    cleaned = cleaned.strip()
    
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1:
        return cleaned[start:end+1]
    return cleaned

def classify_lead_intent(title: str, snippet: str, search_type: str = "sales") -> dict:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    filename = "candidate_prompt.txt" if str(search_type).lower().strip() == "recruiter" else "lead_prompt.txt"
    prompt_path = os.path.join(base_dir, "prompts", filename)
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
    try:
        cleaned = clean_json_response(raw_content)
        return json.loads(cleaned)
    except Exception as e:
        print(f"[JSON Parsing Error] Failed parsing lead intent LLM response: {e}")
        print(f"[JSON Parsing Error] Raw response was: {raw_content}")
        return {}
