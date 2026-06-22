import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]

# Check users
users_col = db["users"]
print("Users in DB:")
for u in users_col.find({}):
    print(f"  - Email: {u.get('email')}")

# Check unique user_email in leads
leads_col = db["leads"]
pipeline = [
    {"$group": {"_id": "$user_email", "count": {"$sum": 1}}}
]
results = list(leads_col.aggregate(pipeline))
print("\nLead counts per user_email in DB:")
for r in results:
    print(f"  - user_email: {repr(r['_id'])} | Count: {r['count']}")
