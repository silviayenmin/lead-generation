import sys
from dotenv import load_dotenv
import os

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from crm.lead_database import (
    extract_fallback_author,
    extract_author_from_email_or_url,
    is_facebook_fallback_name,
    validate_author_name
)

def run_tests():
    print("Running Facebook author extraction and validation tests...\n")

    # Test case 1: Facebook group URL fallback extraction
    group_url_1 = "https://www.facebook.com/groups/TwinCitiesGeeks/posts/27465171523085547/"
    author_1 = extract_fallback_author("Looking for local logo designer | Facebook", group_url_1)
    print(f"Test 1 (Group URL Fallback + CamelCase): {author_1}")
    assert author_1 == "Twin Cities Geeks", f"Expected 'Twin Cities Geeks', got '{author_1}'"

    # Test case 2: Facebook group URL with valid title
    group_url_2 = "https://www.facebook.com/groups/freelancemalta/posts/26577506265270444/"
    author_2 = extract_fallback_author("Freelance Malta | Facebook", group_url_2)
    print(f"Test 2 (Group URL Fallback with valid title): {author_2}")
    assert author_2 == "Freelance Malta", f"Expected 'Freelance Malta', got '{author_2}'"

    # Test case 2b: Facebook group URL fallback when title is invalid/rejected (resolved via Serper search)
    author_2b = extract_fallback_author("Looking for logo designer | Facebook", group_url_2)
    print(f"Test 2b (Group URL Fallback when title is rejected - resolved via Serper): {author_2b}")
    assert author_2b == "Self Employed & Freelance Malta", f"Expected 'Self Employed & Freelance Malta', got '{author_2b}'"

    # Test case 2c: Facebook group URL segment fallback when title is rejected and Serper returns nothing
    import crm.lead_database
    original_search = crm.lead_database.search_leads
    crm.lead_database.search_leads = lambda *args, **kwargs: []
    try:
        non_existent_url = "https://www.facebook.com/groups/somerandomgroupthatdoesnotexist12345/posts/123456/"
        author_2c = extract_fallback_author("Looking for logo designer | Facebook", non_existent_url)
    finally:
        crm.lead_database.search_leads = original_search

    print(f"Test 2c (Group URL Fallback when Serper returns nothing): {author_2c}")
    assert author_2c == "Somerandomgroupthatdoesnotexist", f"Expected 'Somerandomgroupthatdoesnotexist', got '{author_2c}'"

    # Test case 3: Facebook profile numeric ID should return Unknown
    group_url_3 = "https://www.facebook.com/groups/1581116555860881/posts/1928129261159607/"
    author_3 = extract_fallback_author("Porch designer needed | Facebook", group_url_3)
    print(f"Test 3 (Numeric Group ID): {author_3}")
    assert author_3 == "Unknown", f"Expected 'Unknown', got '{author_3}'"

    # Test case 4: is_facebook_fallback_name check
    is_fallback = is_facebook_fallback_name("Twin Cities Geeks", group_url_1)
    print(f"Test 4 (Is Fallback Name?): {is_fallback}")
    assert is_fallback is True, "Expected True"

    is_fallback_case_insensitive = is_facebook_fallback_name("twin cities geeks", group_url_1)
    print(f"Test 4b (Is Fallback Name Case Insensitive?): {is_fallback_case_insensitive}")
    assert is_fallback_case_insensitive is True, "Expected True"

    # Test case 5: extract_author_from_email_or_url prioritizing email
    email_val = "silvia.yenmin@gmail.com"
    author_email = extract_author_from_email_or_url(email_val, group_url_1)
    print(f"Test 5 (Extract from Email & URL - Priority Email): {author_email}")
    assert author_email == "Silvia Yenmin", f"Expected 'Silvia Yenmin', got '{author_email}'"

    # Test case 6: extract_author_from_email_or_url falling back to URL if email is missing
    author_fallback_url = extract_author_from_email_or_url(None, group_url_1)
    print(f"Test 6 (Extract from Email & URL - Fallback URL): {author_fallback_url}")
    assert author_fallback_url == "Twin Cities Geeks", f"Expected 'Twin Cities Geeks', got '{author_fallback_url}'"

    # Test case 7: validate_author_name relaxed rules for Facebook
    valid_fb_name = validate_author_name("Modern Web Design Development", "facebook")
    print(f"Test 7 (Validate FB author > 3 words): {valid_fb_name}")
    assert valid_fb_name == "Modern Web Design Development", f"Expected 'Modern Web Design Development', got '{valid_fb_name}'"

    invalid_linkedin_name = validate_author_name("Modern Web Design Development", "linkedin")
    print(f"Test 8 (Validate LI author > 3 words): {invalid_linkedin_name}")
    assert invalid_linkedin_name == "Unknown", f"Expected 'Unknown', got '{invalid_linkedin_name}'"

    print("\nAll unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()
