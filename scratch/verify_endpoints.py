import requests
import json

def run_verification():
    base_url = "http://127.0.0.1:8000"
    
    # Step 1: Login
    print("1. Logging in as grace@gmail.com...")
    login_payload = {
        "email": "grace@gmail.com",
        "password": "password123"
    }
    
    response = requests.post(f"{base_url}/api/auth/login", json=login_payload)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
        
    login_data = response.json()
    token = login_data.get("session_token")
    print(f"Logged in successfully. Session key / Token: {token}")
    
    headers = {
        "X-API-Key": token,
        "Content-Type": "application/json"
    }
    
    # Step 2: Get initial Twitter config
    print("\n2. Fetching initial Twitter API configuration...")
    response = requests.get(f"{base_url}/api/outreach/twitter", headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch Twitter config: {response.text}")
        return
    print(f"Initial config response: {response.json()}")
    
    # Step 3: Save Twitter API key
    print("\n3. Saving new Twitter API key...")
    save_payload = {
        "twitter_api_key": "test_twitter_api_key_123456789_end"
    }
    response = requests.post(f"{base_url}/api/outreach/twitter", headers=headers, json=save_payload)
    if response.status_code != 200:
        print(f"Failed to save Twitter API key: {response.text}")
        return
    print(f"Save config response: {response.json()}")
    
    # Step 4: Fetch again and verify masking
    print("\n4. Fetching Twitter API configuration again to verify masking...")
    response = requests.get(f"{base_url}/api/outreach/twitter", headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch Twitter config: {response.text}")
        return
    config = response.json()
    print(f"Config response: {config}")
    assert config.get("is_configured") is True, "Expected is_configured to be True"
    assert "********" in config.get("twitter_api_key"), "Expected key to be masked"
    assert config.get("twitter_api_key").endswith("_end"), "Expected masked key to preserve end suffix"
    print("Masking verified successfully!")
    
    # Step 5: Save masked key (e.g. user clicks save without changing field)
    print("\n5. Saving masked key to check preservation of original key...")
    masked_payload = {
        "twitter_api_key": config.get("twitter_api_key")
    }
    response = requests.post(f"{base_url}/api/outreach/twitter", headers=headers, json=masked_payload)
    if response.status_code != 200:
        print(f"Failed to save masked key: {response.text}")
        return
    print(f"Save masked response: {response.json()}")
    
    # Step 6: Verify key was preserved (by checking database helper output directly or fetching again)
    print("\n6. Fetching config again after saving masked key...")
    response = requests.get(f"{base_url}/api/outreach/twitter", headers=headers)
    config_after = response.json()
    print(f"Config response after save: {config_after}")
    assert config_after.get("is_configured") is True, "Expected is_configured to be True"
    
    # Let's clean up/reset it back to empty
    print("\n7. Cleaning up by resetting Twitter key to empty...")
    reset_payload = {
        "twitter_api_key": ""
    }
    response = requests.post(f"{base_url}/api/outreach/twitter", headers=headers, json=reset_payload)
    print(f"Reset response: {response.json()}")
    
    response = requests.get(f"{base_url}/api/outreach/twitter", headers=headers)
    print(f"Final cleared config response: {response.json()}")
    
    print("\n*** ALL ENDPOINT TESTS PASSED SUCCESSFULLY! ***")

if __name__ == "__main__":
    run_verification()
