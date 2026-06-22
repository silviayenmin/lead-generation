import sys
from dotenv import load_dotenv
import os

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from crm.lead_database import load_db

print("Triggering database loading and healing...")
leads = load_db("silvia.yenmin@gmail.com")

print("\n--- FB Leads after Healing ---")
for url, lead in leads.items():
    if lead.get("platform") == "facebook":
        print(f"Email:  {lead.get('contactInfo')}")
        print(f"URL:    {lead.get('sourceUrl')}")
        print(f"Author: {lead.get('authorName')}")
        print("-" * 50)
