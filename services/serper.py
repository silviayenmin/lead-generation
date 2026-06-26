import requests
import os

def search_leads(query, tbs=None, api_key=None):
    payload = {
        "q": query
    }
    if tbs:
        payload["tbs"] = tbs

    serper_key = api_key if (api_key and api_key.strip()) else os.getenv("SERPER_API_KEY")

    response = requests.post(
        "https://google.serper.dev/search",
        headers={
            "X-API-KEY": serper_key,
            "Content-Type": "application/json"
        },
        json=payload
    )

    data = response.json()

    return data.get("organic", [])