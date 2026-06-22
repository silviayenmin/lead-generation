import os
import pymongo
from dotenv import load_dotenv
import sys

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from qualification.lead_classifier import classify_lead_intent
from qualification.lead_scoring import calculate_lead_score
from crm.lead_database import fetch_title_from_url, validate_author_name, validate_company_name, extract_fallback_author, is_empty_value

def reclassify_leads():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
    client = pymongo.MongoClient(mongo_uri)
    db = client[db_name]
    leads_col = db["leads"]
    
    print("Fetching leads for re-classification...")
    leads = list(leads_col.find({}))
    print(f"Found {len(leads)} leads to process.\n")
    
    success_count = 0
    for doc in leads:
        url = doc.get("sourceUrl")
        current_author = doc.get("authorName")
        current_email = doc.get("contactInfo")
        
        msg = f"Re-classifying: {url}"
        print(msg.encode("ascii", "ignore").decode())
        
        try:
            # 1. Fetch the original search result title
            title = fetch_title_from_url(url)
            if not title:
                title = doc.get("needDescription") or "Lead post"
                
            # 2. Run LLM intent classification
            classified = classify_lead_intent(title, doc.get("needDescription") or "")
            
            # If classification succeeded, update fields
            if classified:
                # Keep fields
                doc["buyingIntent"] = classified.get("buyingIntent", "Low")
                doc["intentType"] = classified.get("intentType", "General Discussion")
                doc["serviceRequired"] = classified.get("serviceRequired", "Unknown")
                doc["industry"] = classified.get("industry", "Unknown")
                doc["location"] = classified.get("location", "Unknown")
                doc["needDescription"] = classified.get("needDescription") or doc.get("needDescription") or ""
                
                # Check author name
                author = classified.get("authorName")
                if is_empty_value(author):
                    author = current_author
                if is_empty_value(author) or author == "Unknown":
                    author = extract_fallback_author(title, url)
                doc["authorName"] = validate_author_name(author, doc.get("platform"))
                
                # Check company name
                company = classified.get("companyName")
                if is_empty_value(company) or company == "Not Specified":
                    company = doc.get("companyName")
                doc["companyName"] = validate_company_name(company)
                
                # Recalculate score
                doc = calculate_lead_score(doc)
                
                leads_col.replace_one({"_id": doc["_id"]}, doc)
                msg_success = f"  -> Success! Score: {doc.get('leadScore')} ({doc.get('leadCategory')}) | Author: {doc.get('authorName')}"
                print(msg_success.encode("ascii", "ignore").decode())
                success_count += 1
            else:
                print("  -> Classification returned empty result.")
        except Exception as e:
            print(f"  -> Error reclassifying lead: {e}")
            
    print(f"\nCompleted! Reclassified {success_count} leads successfully.")

if __name__ == "__main__":
    reclassify_leads()
