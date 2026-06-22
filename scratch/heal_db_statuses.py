import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

print("Healing database leadStatus values...")

healed_count = 0
for doc in leads_col.find({}):
    current_status = doc.get("leadStatus")
    category = doc.get("leadCategory")
    crm_status = doc.get("crmStatus")
    
    new_status = None
    if current_status == "Unqualified" or not current_status:
        if crm_status != "Disqualified":
            if category == "High Intent":
                new_status = "Qualified"
            elif category == "Medium Intent":
                new_status = "Warm Lead"
            elif category == "Low Intent":
                new_status = "Unqualified"
                
    if new_status and new_status != current_status:
        leads_col.update_one({"_id": doc["_id"]}, {"$set": {"leadStatus": new_status}})
        print(f"  - Updated: {doc.get('sourceUrl')}\n    Category: {category} | Status: {current_status} -> {new_status}")
        healed_count += 1

print(f"\nDone! Healed {healed_count} lead documents.")
