import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

print(f"Connected to database: {db_name}")
print(f"Total leads in collection: {leads_col.count_documents({})}")

# Let's inspect the unique leadStatus values and count them
pipeline = [
    {"$group": {"_id": "$leadStatus", "count": {"$sum": 1}}}
]
results = list(leads_col.aggregate(pipeline))
print("\nLead statuses and counts:")
for r in results:
    print(f"  - Status: {repr(r['_id'])} | Count: {r['count']}")

# Print a few sample leads with their fields
print("\nSample leads (top 5):")
for doc in leads_col.find({}).limit(5):
    print(f"  - URL: {doc.get('sourceUrl')}")
    print(f"    authorName: {repr(doc.get('authorName'))}")
    print(f"    companyName: {repr(doc.get('companyName'))}")
    print(f"    leadCategory: {repr(doc.get('leadCategory'))}")
    # Show all keys
    print(f"    keys: {list(doc.keys())}")
    print(f"    leadStatus: {repr(doc.get('leadStatus'))}")
    print(f"    buyingIntent: {repr(doc.get('buyingIntent'))}")
