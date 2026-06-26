import os
import sys

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from crm import save_twitter_api_key, get_twitter_api_key
from search import get_adapter
from services.serper import search_leads

def test_db_helpers():
    print("Testing DB helpers...")
    email = "silvia.yenmin@gmail.com"
    
    # Save original key if any
    original_key = get_twitter_api_key(email)
    print(f"Original key: '{original_key}'")
    
    test_key = "test_twitter_api_key_12345"
    
    try:
        # Save the key
        saved = save_twitter_api_key(email, test_key)
        print(f"Save key status: {saved}")
        
        # Retrieve the key
        retrieved = get_twitter_api_key(email)
        print(f"Retrieved key: '{retrieved}'")
        assert retrieved == test_key, "Retrieved key does not match saved key!"
        print("DB helpers work successfully!")
    finally:
        # Restore original key
        save_twitter_api_key(email, original_key)
        print("Original key restored.")

def test_serper_and_adapter():
    print("\nTesting Serper & Adapter signatures for all platform adapters...")
    
    platforms = ["twitter", "linkedin", "facebook", "reddit"]
    for plat in platforms:
        print(f"\nChecking adapter for platform: '{plat}'")
        adapter = get_adapter(plat)
        print(f"Loaded adapter type: {type(adapter)}")
        
        # Run a test search with dummy/invalid API key
        try:
            results = adapter.search(keyword="design agency", api_key="dummy_invalid_serper_key_testing")
            print(f"Search executed successfully on {plat}. Results: {results}")
        except TypeError as te:
            print(f"TypeError raised for {plat}: {te}")
            raise te
        except Exception as e:
            print(f"Search on {plat} raised expected exception: {e}")

if __name__ == "__main__":
    test_db_helpers()
    test_serper_and_adapter()
