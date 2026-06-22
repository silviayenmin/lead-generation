import os
import pymongo
from dotenv import load_dotenv

load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
leads_col = db["leads"]

print("Leads for silvia.yenmin@gmail.com:")
for doc in leads_col.find({"user_email": "silvia.yenmin@gmail.com"}):
    print(f"  - URL: {doc.get('sourceUrl')}")
    print(f"    leadCategory: {repr(doc.get('leadCategory'))}")
    print(f"    leadStatus: {repr(doc.get('leadStatus'))}")
    print(f"    buyingIntent: {repr(doc.get('buyingIntent'))}")
