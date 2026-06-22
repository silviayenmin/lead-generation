import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

print("Analyzing fields for user silvia.yenmin@gmail.com:")

# Get all unique platform values
platforms = {}
crm_statuses = {}

for doc in leads_col.find({"user_email": "silvia.yenmin@gmail.com"}):
    plat = doc.get("platform")
    platforms[plat] = platforms.get(plat, 0) + 1
    
    crm = doc.get("crmStatus")
    crm_statuses[crm] = crm_statuses.get(crm, 0) + 1

print("\nPlatform values and counts:")
for k, v in platforms.items():
    print(f"  - Platform: {repr(k)} | Count: {v}")

print("\ncrmStatus values and counts:")
for k, v in crm_statuses.items():
    print(f"  - crmStatus: {repr(k)} | Count: {v}")
