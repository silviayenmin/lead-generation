import json
import urllib.request
import urllib.error

url_get = "http://127.0.0.1:8000/api/model-config"
url_post = "http://127.0.0.1:8000/api/model-config"
headers = {
    "X-API-Key": "silvia_dev_key",
    "Content-Type": "application/json"
}

def test_get():
    print("Testing GET /api/model-config...")
    req = urllib.request.Request(url_get, headers={"X-API-Key": "silvia_dev_key"})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print("GET Response:", json.dumps(data, indent=2))
            return data
    except urllib.error.HTTPError as e:
        print("GET Error:", e.code, e.read().decode())
    except Exception as e:
        print("GET Connection Error:", e)

def test_post(payload):
    print("\nTesting POST /api/model-config with payload:", payload)
    req = urllib.request.Request(
        url_post, 
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print("POST Response:", json.dumps(data, indent=2))
            return data
    except urllib.error.HTTPError as e:
        print("POST Error:", e.code, e.read().decode())
    except Exception as e:
        print("POST Connection Error:", e)

if __name__ == "__main__":
    # Get current config
    current_config = test_get()
    
    # Save a test config
    test_payload = {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "openai_api_key": "sk-proj-test12345678901234567890",
        "groq_api_key": "",
        "ollama_host": "http://localhost:11434"
    }
    test_post(test_payload)
    
    # Get configuration again to verify masked response
    updated_config = test_get()
    
    # Restore original config if we had one
    if current_config:
        # We need to unmask the keys if they were masked
        # Note: server.py doesn't overwrite if payload contains "..."
        restore_payload = {
            "provider": current_config.get("provider", "groq"),
            "model": current_config.get("model", ""),
            "openai_api_key": current_config.get("openai_api_key", ""),
            "groq_api_key": current_config.get("groq_api_key", ""),
            "ollama_host": current_config.get("ollama_host", "http://localhost:11434")
        }
        test_post(restore_payload)
        print("\nRestored original configuration.")
