import sys
import requests
from dotenv import load_dotenv
import os

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

name = "Sundar Pichai"
company = "Google"

print("--- Testing Hunter Raw ---")
try:
    api_key = os.getenv("HUNTER_API_KEY")
    domain = "google.com"
    resp = requests.get(
        "https://api.hunter.io/v2/email-finder",
        params={
            "domain": domain,
            "first_name": "Sundar",
            "last_name": "Pichai",
            "api_key": api_key
        },
        timeout=8
    )
    print("Hunter Status:", resp.status_code)
    print("Hunter Body:", resp.text)
except Exception as e:
    print("Hunter Error:", e)

print("\n--- Testing Apollo Raw ---")
try:
    api_key = os.getenv("APOLLO_API_KEY")
    resp = requests.post(
        "https://api.apollo.io/v1/contacts/search",
        json={
            "q_keywords": "Sundar Pichai",
            "q_organization_name": "Google",
            "page": 1,
            "per_page": 1
        },
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json"
        },
        timeout=8
    )
    print("Apollo Status:", resp.status_code)
    print("Apollo Body:", resp.text)
except Exception as e:
    print("Apollo Error:", e)

print("\n--- Testing Prospeo Raw ---")
try:
    api_key = os.getenv("PROSPEO_API_KEY")
    resp = requests.post(
        "https://api.prospeo.io/enrich-person",
        json={
            "data": {
                "full_name": "Sundar Pichai",
                "company_website": "google.com"
            }
        },
        headers={
            "X-KEY": api_key,
            "Content-Type": "application/json"
        },
        timeout=8
    )
    print("Prospeo Status:", resp.status_code)
    print("Prospeo Body:", resp.text)
except Exception as e:
    print("Prospeo Error:", e)
