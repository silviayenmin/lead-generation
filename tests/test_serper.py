import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

from services.serper import search_leads

class TestSerperService(unittest.TestCase):

    @patch('requests.post')
    def test_search_leads_no_pagination_if_small_limit(self, mock_post):
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organic": [{"title": "Post 1", "link": "http://example.com/1"}]
        }
        mock_post.return_value = mock_response

        # Request limit = 5 (<= 10)
        results = search_leads("test query", api_key="fake_key", num=5)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Post 1")
        # Ensure only 1 API call was made
        self.assertEqual(mock_post.call_count, 1)

    @patch('requests.post')
    def test_search_leads_no_pagination_if_few_results(self, mock_post):
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organic": [{"title": "Post 1", "link": "http://example.com/1"}]  # only 1 result (less than 10)
        }
        mock_post.return_value = mock_response

        # Request limit = 20 (> 10)
        results = search_leads("test query", api_key="fake_key", num=20)

        self.assertEqual(len(results), 1)
        # Since first page had < 10 results, it should NOT request page 2
        self.assertEqual(mock_post.call_count, 1)

    @patch('requests.post')
    def test_search_leads_paginates_if_capped_first_page(self, mock_post):
        # First request returns 10 results
        mock_resp_1 = MagicMock()
        mock_resp_1.status_code = 200
        mock_resp_1.json.return_value = {
            "organic": [{"title": f"Post {i}", "link": f"http://example.com/{i}"} for i in range(1, 11)]
        }

        # Second request returns 5 results
        mock_resp_2 = MagicMock()
        mock_resp_2.status_code = 200
        mock_resp_2.json.return_value = {
            "organic": [{"title": f"Post {i}", "link": f"http://example.com/{i}"} for i in range(11, 16)]
        }

        # Mock post side effect to return resp 1, then resp 2
        mock_post.side_effect = [mock_resp_1, mock_resp_2]

        # Request limit = 20 (> 10)
        results = search_leads("test query", api_key="fake_key", num=20)

        # Should combine results: 10 + 5 = 15 results
        self.assertEqual(len(results), 15)
        self.assertEqual(results[0]["title"], "Post 1")
        self.assertEqual(results[14]["title"], "Post 15")
        
        # Ensure 2 API calls were made (first page, then second page)
        self.assertEqual(mock_post.call_count, 2)

        # Check call arguments
        calls = mock_post.call_args_list
        # First call has num = 20
        self.assertEqual(calls[0][1]['json']['num'], 20)
        # Second call has num = 10, page = 2
        self.assertEqual(calls[1][1]['json']['num'], 10)
        self.assertEqual(calls[1][1]['json']['page'], 2)

if __name__ == "__main__":
    unittest.main()
