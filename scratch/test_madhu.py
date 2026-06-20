import os
import pymongo
import imaplib
import email
from email.utils import parseaddr
import sys
from dotenv import load_dotenv

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from services.imap_listener import normalize_subject, decode_mime_header

# Connect to DB to get credentials
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
client = pymongo.MongoClient(mongo_uri)
db = client[db_name]

user_email = "silvia.yenmin@gmail.com"
user = db["users"].find_one({"email": user_email})
config = user.get("email_config", {})

server = config.get("imap_server")
port = int(config.get("imap_port", 993))
username = config.get("imap_email")
password = config.get("imap_password")

lead_email = "madhusudhanan.yenmin@gmail.com"
outreach_subject = "Boosting Pascat Graphics & Marketing's Digital Presence"

print(f"Connecting to IMAP as {username}...")
mail = imaplib.IMAP4_SSL(server, port, timeout=10)
mail.login(username, password)
mail.select("INBOX")

# Let's run the sync_user_replies logic and save the result to DB
from services.imap_listener import sync_user_replies
from crm.lead_database import load_db, save_db

leads = load_db(user_email)
new_replies, updated_leads = sync_user_replies(user_email, config, leads)

if new_replies > 0:
    save_db(updated_leads, user_email)
    print(f"Successfully synced {new_replies} new replies and saved to DB!")
else:
    print("Sync completed. No new replies found.")

