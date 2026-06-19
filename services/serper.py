import requests
import os

def search_leads(query, tbs=None):
    payload = {
        "q": query
    }
    if tbs:
        payload["tbs"] = tbs

    response = requests.post(
        "https://google.serper.dev/search",
        headers={
            "X-API-KEY": os.getenv("SERPER_API_KEY"),
            "Content-Type": "application/json"
        },
        json=payload
    )

    data = response.json()

    return data.get("organic", [])