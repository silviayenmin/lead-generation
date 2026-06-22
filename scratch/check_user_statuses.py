import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

users = ["admin", "silvia.yenmin@gmail.com", "grace@gmail.com", None]

for u in users:
    print(f"\nUser: {repr(u)}")
    pipeline = [
        {"$match": {"user_email": u}},
        {"$group": {"_id": "$leadStatus", "count": {"$sum": 1}}}
    ]
    results = list(leads_col.aggregate(pipeline))
    for r in results:
        print(f"  - Status: {repr(r['_id'])} | Count: {r['count']}")
