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
        "active_provider": "openai",
        "providers": {
            "openai": {
                "provider_type": "openai",
                "model": "gpt-4o",
                "temperature": 0.1,
                "openai_api_key": "should_be_stripped"
            },
            "groq": {
                "provider_type": "groq",
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.7
            }
        }
    }
    test_post(test_payload)
    
    # Get configuration again to verify masked response
    updated_config = test_get()
    
    # Restore original config if we had one
    if current_config:
        test_post(current_config)
        print("\nRestored original configuration.")
