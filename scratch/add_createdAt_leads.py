import os
import datetime
import pymongo
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

print("Backfilling database leads with createdAt field...")

updated_count = 0
skipped_count = 0

for doc in leads_col.find({}):
    source_url = doc.get("sourceUrl")
    if "createdAt" in doc:
        skipped_count += 1
        continue
        
    created_at = None
    # Try to extract timestamp from ObjectId
    if "_id" in doc:
        try:
            doc_id = doc["_id"]
            if isinstance(doc_id, ObjectId):
                created_at = doc_id.generation_time.isoformat()
            elif isinstance(doc_id, str) and ObjectId.is_valid(doc_id):
                created_at = ObjectId(doc_id).generation_time.isoformat()
        except Exception as e:
            print(f"  - Error parsing ObjectId for {source_url}: {e}")
            
    if not created_at:
        created_at = datetime.datetime.utcnow().isoformat()
        
    leads_col.update_one({"_id": doc["_id"]}, {"$set": {"createdAt": created_at}})
    print(f"  - Set createdAt for {source_url} to {created_at}")
    updated_count += 1

print(f"\nDone! Updated {updated_count} leads, skipped {skipped_count} leads already having createdAt.")
