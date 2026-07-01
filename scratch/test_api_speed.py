import requests
import time

base_url = "http://127.0.0.1:8000"
headers = {
    "X-API-Key": "silvia_dev_key",
    "Content-Type": "application/json"
}

def test_endpoint(path):
    print(f"Testing {path}...")
    start = time.time()
    try:
        response = requests.get(f"{base_url}{path}", headers=headers, timeout=15)
        elapsed = time.time() - start
        print(f"Status: {response.status_code}")
        print(f"Time taken: {elapsed:.4f} seconds")
        if response.status_code == 200:
            data = response.json()
            # print first few keys
            print(f"Keys: {list(data.keys())}")
            if "leads" in data:
                print(f"Leads count: {len(data['leads'])}")
            elif "count" in data:
                print(f"Count: {data['count']}")
        else:
            print(f"Error output: {response.text[:200]}")
    except Exception as e:
        print(f"Request failed: {e}")

test_endpoint("/api/auth/verify")
test_endpoint("/api/leads")
test_endpoint("/api/notifications")
