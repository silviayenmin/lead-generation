import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from dotenv import load_dotenv

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from qualification.lead_classifier import classify_lead_intent, clean_json_response
from qualification.lead_scoring import calculate_lead_score

class TestLeadQualificationAndScoring(unittest.TestCase):
    def test_clean_json_response(self):
        raw = "```json\n{\n  \"buyingIntent\": \"High\"\n}\n```"
        cleaned = clean_json_response(raw)
        self.assertEqual(cleaned, "{\n  \"buyingIntent\": \"High\"\n}")
        
        raw_no_wrap = "{\n  \"buyingIntent\": \"Low\"\n}"
        self.assertEqual(clean_json_response(raw_no_wrap), raw_no_wrap)

    @patch('services.ai_agent.client.chat.completions.create')
    def test_classify_lead_intent(self, mock_create):
        # Mock completion response
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = '{"buyingIntent": "High", "intentType": "Looking For Service", "companyName": "Acme Corp", "authorName": "John Doe", "serviceRequired": "SEO Services", "location": "US", "needDescription": "Need to rank first on Google search"}'
        mock_response.choices = [mock_choice]
        mock_create.return_value = mock_response

        res = classify_lead_intent("Looking for SEO agency", "Need Google search ranking help")
        self.assertEqual(res["buyingIntent"], "High")
        self.assertEqual(res["intentType"], "Looking For Service")
        self.assertEqual(res["companyName"], "Acme Corp")
        self.assertEqual(res["serviceRequired"], "SEO Services")

    def test_calculate_lead_score_high_intent(self):
        # Test a scenario with full scores
        high_intent_lead = {
            "buyingIntent": "High",
            "intentType": "Looking For Service",
            "serviceRequired": "Web Design",
            "needDescription": "Need a clean corporate site redesign",
            "companyName": "Acme Corp",
            "location": "New York",
            "authorName": "John Doe"
        }
        scored = calculate_lead_score(high_intent_lead)
        # Expected score:
        # Intent = 40
        # Service = 20
        # Need = 15
        # Company = 10
        # Location = 5
        # Author = 10
        # Total = 100 -> High Intent
        self.assertEqual(scored["leadScore"], 100)
        self.assertEqual(scored["leadCategory"], "High Intent")

    def test_calculate_lead_score_low_intent_fallback(self):
        # Test low intent cap
        low_intent_lead = {
            "buyingIntent": "Low",
            "intentType": "General Discussion",
            "serviceRequired": "SEO",
            "needDescription": "Is SEO still relevant today?",
            "companyName": "Unknown",
            "location": "Unknown",
            "authorName": "Blogger"
        }
        scored = calculate_lead_score(low_intent_lead)
        # Category should be forced to "Low Intent" and score capped at 35
        self.assertEqual(scored["leadCategory"], "Low Intent")
        self.assertTrue(scored["leadScore"] <= 35)

    def test_calculate_lead_score_recruiter(self):
        candidate_lead = {
            "search_type": "recruiter",
            "buyingIntent": "High",
            "intentType": "Candidate/Job Seeker",
            "skills": "React, TypeScript, Python",
            "experienceLevel": "Senior",
            "workPreference": "Remote",
            "companyName": "Freelancer",
            "location": "Berlin",
            "authorName": "Jane Dev"
        }
        scored = calculate_lead_score(candidate_lead)
        # Expected Recruiter score:
        # Intent = 40 (Candidate/Job Seeker)
        # Skills = 20 (React, TypeScript, Python present)
        # Work Preference = 15 (Remote present and not Unknown)
        # Company/School = 10 (Freelancer present)
        # Location = 5 (Berlin present)
        # Author = 10 (Jane Dev present)
        # Total = 100 -> High Intent
        self.assertEqual(scored["leadScore"], 100)
        self.assertEqual(scored["leadCategory"], "High Intent")

if __name__ == "__main__":
    unittest.main()
