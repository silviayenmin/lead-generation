import os
import pymongo
from dotenv import load_dotenv
import sys

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from crm.lead_database import extract_fallback_author, validate_author_name, extract_author_from_email_or_url

def migrate():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
    client = pymongo.MongoClient(mongo_uri)
    db = client[db_name]
    leads_col = db["leads"]
    
    print("Starting database migration for Facebook Unknown authors...")
    query = {"platform": "facebook", "authorName": "Unknown"}
    unknown_leads = list(leads_col.find(query))
    print(f"Found {len(unknown_leads)} Facebook leads with Unknown authors.\n")
    
    updated_count = 0
    for doc in unknown_leads:
        url = doc.get("sourceUrl")
        email = doc.get("contactInfo")
        print(f"Processing URL: {url}")
        
        resolved_name = "Unknown"
        
        # 1. Try to extract from email if email is present
        if email:
            email_author = extract_author_from_email_or_url(email, url)
            if email_author and email_author != "Unknown":
                resolved_name = validate_author_name(email_author, "facebook")
                
        # 2. Try extract_fallback_author if email-based failed/not found
        if resolved_name == "Unknown":
            fallback_author = extract_fallback_author(None, url)
            if fallback_author and fallback_author != "Unknown":
                resolved_name = validate_author_name(fallback_author, "facebook")
                
        if resolved_name != "Unknown":
            msg = f"  -> Healed: {doc.get('authorName')} -> {resolved_name}"
            print(msg.encode("ascii", "ignore").decode())
            leads_col.update_one({"_id": doc["_id"]}, {"$set": {"authorName": resolved_name}})
            updated_count += 1
        else:
            print("  -> Could not resolve a name, skipped.")
            
    print(f"\nMigration completed! Successfully updated {updated_count} leads.")

if __name__ == "__main__":
    migrate()
