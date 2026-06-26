import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from dotenv import load_dotenv

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from search.linkedin_adapter import LinkedInAdapter
from search.facebook_adapter import FacebookAdapter
from search.twitter_adapter import TwitterAdapter
from search.google_maps_adapter import GoogleMapsAdapter
from search import get_adapter

class TestPlatformAdapters(unittest.TestCase):
    
    @patch('search.linkedin_adapter.search_leads')
    def test_linkedin_adapter(self, mock_search_leads):
        # Mock search results returned by search_leads
        mock_results = [{"title": "LinkedIn post", "link": "http://linkedin.com/posts/1", "snippet": "Need developer"}]
        mock_search_leads.return_value = mock_results
        
        adapter = get_adapter("linkedin")
        self.assertIsInstance(adapter, LinkedInAdapter)
        
        res = adapter.search("web development", timeframe="qdr:m3", match_type="partial", api_key="test_serper_key")
        self.assertEqual(res, mock_results)
        
        # Verify search_leads was called with custom api_key
        mock_search_leads.assert_called_once_with('site:linkedin.com/posts web development', tbs='qdr:m3', api_key='test_serper_key')

    @patch('search.facebook_adapter.search_leads')
    def test_facebook_adapter(self, mock_search_leads):
        mock_results = [{"title": "Facebook post", "link": "http://facebook.com/posts/1", "snippet": "Need designer"}]
        mock_search_leads.return_value = mock_results
        
        adapter = get_adapter("facebook")
        self.assertIsInstance(adapter, FacebookAdapter)
        
        res = adapter.search("graphic design", timeframe="qdr:w", location="New York", api_key="fb_key")
        self.assertEqual(res, mock_results)
        mock_search_leads.assert_called_once_with('site:facebook.com graphic design "New York"', tbs='qdr:w', api_key='fb_key')

    @patch('search.twitter_adapter.search_leads')
    def test_twitter_adapter(self, mock_search_leads):
        mock_results = [{"title": "Twitter post", "link": "http://x.com/status/1", "snippet": "Need copywriter"}]
        mock_search_leads.return_value = mock_results
        
        adapter = get_adapter("twitter")
        self.assertIsInstance(adapter, TwitterAdapter)
        
        res = adapter.search("copywriter", match_type="exact", industry="Tech", api_key="tw_key")
        self.assertEqual(res, mock_results)
        mock_search_leads.assert_called_once_with('(site:x.com OR site:twitter.com) "copywriter" "Tech"', tbs='qdr:m3', api_key='tw_key')

    @patch('requests.post')
    @patch('requests.get')
    def test_google_maps_adapter_api(self, mock_get, mock_post):
        # Mock Google Places Text Search (place discovery)
        mock_search_resp = MagicMock()
        mock_search_resp.status_code = 200
        mock_search_resp.json.return_value = {"places": [{"id": "google_hq_id"}]}
        mock_post.return_value = mock_search_resp
        
        # Mock Google Places Place Details
        mock_details_resp = MagicMock()
        mock_details_resp.status_code = 200
        mock_details_resp.json.return_value = {
            "displayName": {"text": "Google HQ"},
            "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA",
            "websiteUri": "http://google.com"
        }
        mock_get.return_value = mock_details_resp

        adapter = get_adapter("google_maps")
        self.assertIsInstance(adapter, GoogleMapsAdapter)

        # Mock the crawler helper
        with patch.object(adapter, 'crawl_website_for_emails', return_value=["careers@google.com"]):
            results = adapter.search("software development", location="Mountain View", api_key="fake_places_key", limit=1)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["meta_business_name"], "Google HQ")
            self.assertEqual(results[0]["meta_contact_info"], "careers@google.com")

if __name__ == "__main__":
    unittest.main()
