import urllib.request
import json
import os
import pymongo
from dotenv import load_dotenv

load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

# Connect to DB to find session token
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]

user_email = "silvia.yenmin@gmail.com"
session = db["sessions"].find_one({"user_email": user_email})
if session:
    api_key = session["session_token"]
else:
    import secrets
    import datetime
    api_key = secrets.token_hex(24)
    db["sessions"].insert_one({
        "session_token": api_key,
        "user_email": user_email,
        "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    })

url_sync = "http://127.0.0.1:8000/api/outreach/sync-replies"
url_leads = "http://127.0.0.1:8000/api/leads"

headers = {
    "X-API-Key": api_key,
    "Content-Type": "application/json"
}

print("1. Triggering API Sync Replies...")
req_sync = urllib.request.Request(url_sync, method="POST", headers=headers)
try:
    with urllib.request.urlopen(req_sync) as response:
        sync_res = json.loads(response.read().decode())
        print(f"Sync Response: {sync_res}")
except Exception as e:
    print(f"Error during API Sync: {e}")

print("\n2. Fetching Leads from API...")
req_leads = urllib.request.Request(url_leads, headers=headers)
try:
    with urllib.request.urlopen(req_leads) as response:
        leads_res = json.loads(response.read().decode())
        leads = leads_res.get("leads", [])
        for l in leads:
            email = l.get("contactInfo")
            if email in ["gayathri.yenmin@gmail.com", "madhusudhanan.yenmin@gmail.com"]:
                print(f"\nLead: {email}")
                print(f"Status: {l.get('crmStatus')}")
                print(f"Replies: {l.get('replies', [])}")
except Exception as e:
    print(f"Error fetching leads: {e}")
