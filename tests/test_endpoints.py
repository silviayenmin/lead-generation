import os
import sys
import requests
import unittest
from dotenv import load_dotenv

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from crm.lead_database import create_user, get_mongo_db

class TestServerEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = "http://127.0.0.1:8000"
        cls.email = "test_endpoint_user@example.com"
        cls.password = "Secr3tP@ssword123"
        cls.db = get_mongo_db()
        
        # Ensure test user exists
        cls.db["users"].delete_many({"email": cls.email})
        create_user(cls.email, cls.password)

    @classmethod
    def tearDownClass(cls):
        # Clean up test user and their settings
        cls.db["users"].delete_many({"email": cls.email})
        cls.db["sessions"].delete_many({"user_email": cls.email})

    def setUp(self):
        # Log in to get session token
        login_payload = {
            "email": self.email,
            "password": self.password
        }
        resp = requests.post(f"{self.base_url}/api/auth/login", json=login_payload)
        self.assertEqual(resp.status_code, 200, "Setup failed: login endpoint returned error")
        data = resp.json()
        self.token = data.get("session_token")
        self.assertIsNotNone(self.token, "Setup failed: session_token not returned")
        
        self.headers = {
            "X-API-Key": self.token,
            "Content-Type": "application/json"
        }

    def test_places_api_key_endpoint(self):
        # 1. Fetch initial configuration
        resp = requests.get(f"{self.base_url}/api/outreach/places", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get("is_configured"))

        # 2. Save Places API Key
        save_payload = {"places_api_key": "places_test_key_12345_end"}
        resp = requests.post(f"{self.base_url}/api/outreach/places", headers=self.headers, json=save_payload)
        self.assertEqual(resp.status_code, 200)
        
        # 3. Fetch again and verify masking
        resp = requests.get(f"{self.base_url}/api/outreach/places", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("is_configured"))
        self.assertEqual(data.get("places_api_key"), "plac********_end")

        # 4. Clean up / Reset key
        reset_payload = {"places_api_key": ""}
        resp = requests.post(f"{self.base_url}/api/outreach/places", headers=self.headers, json=reset_payload)
        self.assertEqual(resp.status_code, 200)

    def test_twitter_api_key_endpoint(self):
        # 1. Fetch initial configuration
        resp = requests.get(f"{self.base_url}/api/outreach/twitter", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get("is_configured"))

        # 2. Save Twitter API Key
        save_payload = {"twitter_api_key": "twitter_test_key_12345_end"}
        resp = requests.post(f"{self.base_url}/api/outreach/twitter", headers=self.headers, json=save_payload)
        self.assertEqual(resp.status_code, 200)
        
        # 3. Fetch again and verify masking
        resp = requests.get(f"{self.base_url}/api/outreach/twitter", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("is_configured"))
        self.assertEqual(data.get("twitter_api_key"), "twit********_end")

        # 4. Clean up / Reset key
        reset_payload = {"twitter_api_key": ""}
        resp = requests.post(f"{self.base_url}/api/outreach/twitter", headers=self.headers, json=reset_payload)
        self.assertEqual(resp.status_code, 200)

    def test_search_validation(self):
        # Validate that searching with invalid input throws 400 validation errors
        invalid_search_payload = {
            "keyword": "",  # Empty keyword is invalid
            "platform": "unknown_platform"
        }
        resp = requests.post(f"{self.base_url}/api/search", headers=self.headers, json=invalid_search_payload)
        self.assertEqual(resp.status_code, 400)

if __name__ == "__main__":
    unittest.main()
