import sys
import os

# Add project root to path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

from search.linkedin_adapter import LinkedInAdapter
from search.query_generator import IntentQueryGenerator
from dotenv import load_dotenv

load_dotenv()

def test_linkedin_location():
    adapter = LinkedInAdapter()
    keyword = "corporate lawyers"
    location = "San Francisco"
    
    # Generate intent-based queries
    intent_queries = IntentQueryGenerator.generate(keyword)
    
    print(f"Testing LinkedIn search for '{keyword}' in '{location}'")
    print(f"Generated {len(intent_queries)} intent query patterns.")
    
    for i, q in enumerate(intent_queries):
        print(f"\n--- Testing Pattern {i+1} ---")
        # We pass the generated pattern as the keyword
        results = adapter.search(keyword=q, location=location, limit=2)
        
        print(f"Found {len(results)} results:")
        for j, r in enumerate(results):
            print(f"\nResult {j+1}:")
            print(f"Title: {r.get('title')}")
            # Snippet truncated for cleaner output
            print(f"Snippet: {r.get('snippet', '')[:150]}...")
            print(f"Link: {r.get('link')}")

if __name__ == "__main__":
    test_linkedin_location()
