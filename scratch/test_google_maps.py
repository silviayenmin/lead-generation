import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")

from search.google_maps_adapter import GoogleMapsAdapter

class TestGoogleMapsScraper(unittest.TestCase):
    def setUp(self):
        self.adapter = GoogleMapsAdapter()

    @patch('requests.post')
    @patch('requests.get')
    def test_search_and_place_details(self, mock_get, mock_post):
        # 1. Mock Places search (discover place IDs)
        mock_search_response = MagicMock()
        mock_search_response.status_code = 200
        mock_search_response.json.return_value = {
            "places": [
                {"id": "place_id_123"},
                {"id": "place_id_456"}
            ]
        }
        mock_post.return_value = mock_search_response

        # 2. Mock Places details (displayName, address, website)
        mock_details_response = MagicMock()
        mock_details_response.status_code = 200
        mock_details_response.json.return_value = {
            "displayName": {"text": "Google Test Business"},
            "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA",
            "websiteUri": "http://google.com"
        }
        mock_get.return_value = mock_details_response

        # Mock the website crawl step to return a mock email
        with patch.object(self.adapter, 'crawl_website_for_emails', return_value=["contact@google.com"]):
            # Set a temporary API Key
            with patch.dict('os.environ', {'PLACES_API_KEY': 'g_maps_test_key'}):
                results = self.adapter.search("software agency", location="Mountain View")
                
                self.assertEqual(len(results), 2)
                first_result = results[0]
                
                self.assertEqual(first_result["meta_business_name"], "Google Test Business")
                self.assertEqual(first_result["meta_address"], "1600 Amphitheatre Pkwy, Mountain View, CA")
                self.assertEqual(first_result["meta_website"], "http://google.com")
                self.assertEqual(first_result["meta_contact_info"], "contact@google.com")
                self.assertIn("place_id_123", first_result["link"])
                print("Places Search & Details mapping: SUCCESS!")

    def test_email_crawler_regex(self):
        # Mock HTML text containing email addresses
        mock_html = """
        <html>
            <body>
                <p>Welcome to our tech business.</p>
                <p>Feel free to reach out to us at support@example.org or info@example-agency.co.in</p>
                <p>Images shouldn't match: test@image.png, graphic@photos.jpg</p>
            </body>
        </html>
        """
        
        emails = set()
        self.adapter.extract_emails_from_text(mock_html, emails)
        
        # Verify both valid emails are extracted
        self.assertIn("support@example.org", emails)
        self.assertIn("info@example-agency.co.in", emails)
        
        # Verify png/jpg suffixes are filtered correctly in crawl_website_for_emails wrapper logic
        with patch('requests.get') as mock_requests_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = mock_html
            mock_requests_get.return_value = mock_resp
            
            scraped = self.adapter.crawl_website_for_emails("http://example.org")
            self.assertIn("support@example.org", scraped)
            self.assertIn("info@example-agency.co.in", scraped)
            self.assertNotIn("test@image.png", scraped)
            self.assertNotIn("graphic@photos.jpg", scraped)
            print("Website email crawler regex and filters: SUCCESS!")

if __name__ == "__main__":
    unittest.main()
