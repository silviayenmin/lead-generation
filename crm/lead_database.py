import os
import json
import csv
import hashlib
import datetime
import threading
import pymongo
from services.serper import search_leads
from services.ai_agent import client

_db_lock = threading.Lock()

EMPTY_VALUES = {"", "none", "unknown", "not specified", "no company details", "linkedin", "facebook", "twitter", "reddit", "unknown poster", "anywhere", "remote"}
def is_empty_value(v): return not v or str(v).strip().lower() in EMPTY_VALUES

def determine_lead_platform(url: str) -> str:
    """
    Determines the source platform (linkedin, facebook, twitter, reddit) based on the URL domain.
    """
    if not url:
        return "other"
    url_lower = url.lower()
    if "linkedin.com" in url_lower:
        return "linkedin"
    elif "facebook.com" in url_lower:
        return "facebook"
    elif "twitter.com" in url_lower or "x.com" in url_lower:
        return "twitter"
    elif "reddit.com" in url_lower:
        return "reddit"
    return "other"

def generate_fingerprint(author_name: str, company_name: str, need_description: str) -> str:
    """
    Generates a unique SHA-256 hash based on normalized authorName, companyName, and needDescription.
    """
    def clean(s):
        if not s:
            return ""
        return "".join(c for c in str(s).lower() if c.isalnum())
        
    auth = clean(author_name)
    comp = clean(company_name)
    need = clean(need_description[:100])  # Use first 100 characters of the need description
    combined = f"{auth}|{comp}|{need}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()

def check_and_save_lead(lead: dict, db: dict) -> str:
    """
    Checks if a lead with a similar fingerprint already exists in the database.
    If duplicate found: updates existing record and returns the existing key.
    If no duplicate found: inserts the lead and returns the new key.
    """
    # Ensure platform is set
    if "platform" not in lead or not lead.get("platform"):
        lead["platform"] = determine_lead_platform(lead.get("sourceUrl", ""))

    author = lead.get("authorName")
    company = lead.get("companyName")
    
    is_author_unknown = is_empty_value(author)
    is_company_unknown = is_empty_value(company)
    
    # If both author and company are unknown/empty, skip duplicate checking to avoid merging different anonymous posts
    if is_author_unknown and is_company_unknown:
        db[lead["sourceUrl"]] = lead
        return lead["sourceUrl"]

    new_fp = generate_fingerprint(
        lead.get("authorName"),
        lead.get("companyName"),
        lead.get("needDescription")
    )
    lead["fingerprint"] = new_fp

    
    # Check for existing duplicate fingerprint in DB
    for url, existing_lead in db.items():
        existing_fp = existing_lead.get("fingerprint")
        if not existing_fp:
            existing_fp = generate_fingerprint(
                existing_lead.get("authorName"),
                existing_lead.get("companyName"),
                existing_lead.get("needDescription")
            )
            existing_lead["fingerprint"] = existing_fp
            
        if existing_fp == new_fp:
            # Duplicate found! Update existing record with new details
            for field in [
                "authorName", "companyName", "buyingIntent", "intentType",
                "serviceRequired", "industry", "location", "needDescription",
                "contactInfo", "confidenceScore", "leadStatus", "leadScore",
                "leadCategory", "contactSource", "contactConfidence", "platform"
            ]:
                if field in lead:
                    existing_lead[field] = lead[field]
                    
            db[url] = existing_lead
            return url
            
    # No duplicate, insert as new
    db[lead["sourceUrl"]] = lead
    return lead["sourceUrl"]

_mongo_client = None
_db_ref = None

def get_mongo_db():
    global _mongo_client, _db_ref
    if _db_ref is None:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        db_name = os.getenv("MONGO_DB_NAME", "silvia_leads")
        _mongo_client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        _db_ref = _mongo_client[db_name]
    return _db_ref

def run_db_migration(db):
    # Migrate Leads JSON if it exists
    leads_json_path = os.path.join("output", "leads_db.json")
    if os.path.exists(leads_json_path):
        print(f"Automatic Migration: Found local leads JSON database at {leads_json_path}. Migrating to MongoDB...")
        try:
            with open(leads_json_path, "r", encoding="utf-8") as f:
                local_leads = json.load(f)
            
            leads_col = db["leads"]
            for url, lead_data in local_leads.items():
                lead_data["sourceUrl"] = url
                leads_col.replace_one({"sourceUrl": url}, lead_data, upsert=True)
                
            bak_path = leads_json_path + ".bak"
            os.rename(leads_json_path, bak_path)
            print(f"Automatic Migration: Leads migrated successfully. Local file backed up to {bak_path}")
        except Exception as e:
            print(f"Error during leads migration to MongoDB: {e}")

    # Migrate Searches JSON if it exists
    searches_json_path = os.path.join("output", "searches_db.json")
    if os.path.exists(searches_json_path):
        print(f"Automatic Migration: Found local searches JSON database at {searches_json_path}. Migrating to MongoDB...")
        try:
            with open(searches_json_path, "r", encoding="utf-8") as f:
                local_searches = json.load(f)
            
            searches_col = db["searches"]
            for s in local_searches:
                searches_col.replace_one(
                    {"keyword": s.get("keyword"), "platform": s.get("platform")},
                    s,
                    upsert=True
                )
                
            bak_path = searches_json_path + ".bak"
            os.rename(searches_json_path, bak_path)
            print(f"Automatic Migration: Searches migrated successfully. Local file backed up to {bak_path}")
        except Exception as e:
            print(f"Error during searches migration to MongoDB: {e}")

def load_db():
    with _db_lock:
        try:
            db = get_mongo_db()
            run_db_migration(db)
            
            leads_col = db["leads"]
            leads = {}
            for doc in leads_col.find():
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                url = doc.get("sourceUrl")
                if url:
                    leads[url] = doc
                    
            if not leads:
                csv_path = os.path.join("output", "leads.csv")
                if os.path.exists(csv_path):
                    try:
                        with open(csv_path, "r", encoding="utf-8") as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                url = row.get("sourceUrl")
                                if url:
                                    row["crmStatus"] = row.get("crmStatus") or "New"
                                    row["draftEmail"] = row.get("draftEmail") or ""
                                    leads[url] = row
                                    leads_col.replace_one({"sourceUrl": url}, row, upsert=True)
                    except Exception as e:
                        print(f"Error migrating CSV to MongoDB: {e}")
                        
            for url, lead in leads.items():
                if "platform" not in lead or not lead.get("platform"):
                    lead["platform"] = determine_lead_platform(url)
                    leads_col.update_one({"sourceUrl": url}, {"$set": {"platform": lead["platform"]}})
                    
            return leads
        except Exception as e:
            print(f"Error loading database from MongoDB: {e}")
            return {}

def save_db(db_data):
    with _db_lock:
        try:
            db = get_mongo_db()
            leads_col = db["leads"]
            
            bulk_ops = []
            for url, lead in db_data.items():
                lead_copy = dict(lead)
                if "_id" in lead_copy:
                    del lead_copy["_id"]
                lead_copy["sourceUrl"] = url
                bulk_ops.append(
                    pymongo.ReplaceOne({"sourceUrl": url}, lead_copy, upsert=True)
                )
                
            if bulk_ops:
                leads_col.bulk_write(bulk_ops)
        except Exception as e:
            print(f"Error saving database to MongoDB: {e}")

def save_searches(searches):
    try:
        db = get_mongo_db()
        searches_col = db["searches"]
        
        for s in searches:
            s_copy = dict(s)
            if "_id" in s_copy:
                del s_copy["_id"]
            searches_col.replace_one(
                {"keyword": s_copy.get("keyword"), "platform": s_copy.get("platform")},
                s_copy,
                upsert=True
            )
    except Exception as e:
        print(f"Error saving searches to MongoDB: {e}")

def load_searches():
    try:
        db = get_mongo_db()
        run_db_migration(db)
        
        searches_col = db["searches"]
        searches = []
        for doc in searches_col.find():
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            searches.append(doc)
        searches.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
        return searches
    except Exception as e:
        print(f"Error loading searches from MongoDB: {e}")
        return []

def clean_json_response(response_text):
    text = response_text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end+1]
    return text

def extract_fallback_author(title: str, url: str) -> str:
    if title:
        if "on LinkedIn" in title:
            author = title.split("on LinkedIn")[0].strip()
            if author: return author
        for suffix in [" | Facebook", " - Facebook", " on Facebook"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if " - " in author:
                    author = author.split(" - ")[0].strip()
                if author: return author
        for suffix in [" on X", " | Twitter", " - Twitter", " / X"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if "(" in author and "@" in author:
                    author = author.split("(")[0].strip()
                if author: return author
        for suffix in [" : reddit", " | reddit", " - reddit", " on reddit"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if author: return author

    username = ""
    if "linkedin.com/posts/" in url:
        try:
            part = url.split("linkedin.com/posts/")[1]
            username = part.split("_")[0]
        except Exception:
            pass
    elif "linkedin.com/in/" in url:
        try:
            part = url.split("linkedin.com/in/")[1]
            username = part.split("/")[0]
        except Exception:
            pass

    if username:
        try:
            profile_query = f'site:linkedin.com/in/ {username}'
            profile_results = search_leads(profile_query, tbs="")
            if profile_results:
                top_title = profile_results[0].get("title", "")
                for delim in [" - ", " | ", " @ ", " on LinkedIn"]:
                    if delim in top_title:
                        top_title = top_title.split(delim)[0]
                cleaned_name = top_title.strip()
                if "(" in cleaned_name:
                    cleaned_name = cleaned_name.split("(")[0].strip()
                if cleaned_name and len(cleaned_name.split()) >= 2:
                    return cleaned_name
        except Exception as e:
            print(f"Error fetching profile name for username {username}: {e}")

        username_clean = username.replace("-", " ").replace(".", " ")
        words = username_clean.split()
        cleaned_words = []
        for w in words:
            if not w.isdigit():
                cleaned_words.append(w.capitalize())
        if cleaned_words:
            return " ".join(cleaned_words)
            
    return "Unknown"

def fetch_title_from_url(url: str) -> str:
    try:
        results = search_leads(url, tbs="")
        if results:
            return results[0].get("title", "")
    except Exception as e:
        print(f"Error fetching title from url {url}: {e}")
    return ""

def enrich_profile_details(author: str) -> dict:
    if is_empty_value(author):
        return {}
    try:
        profile_query = f'site:linkedin.com/in/ "{author}"'
        profile_results = search_leads(profile_query, tbs="")
        if profile_results:
            top_profile = profile_results[0]
            p_title = top_profile.get("title", "")
            p_snippet = top_profile.get("snippet", "")
            
            profile_enrich_prompt = f"""
            You are an expert LinkedIn profile parsing assistant.
            Analyze the following LinkedIn profile search results to extract:
            1. The true current company name of this person.
            2. Their location.
            3. Their industry.
            
            Profile Title: {p_title}
            Profile Snippet: {p_snippet}
            
            Return JSON only:
            {{
              "companyName": "",
              "industry": "",
              "location": ""
            }}
            """
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": profile_enrich_prompt}],
                temperature=0
            )
            enriched_data = json.loads(clean_json_response(response.choices[0].message.content))
            return enriched_data
    except Exception as e:
        print(f"Error in enrich_profile_details for {author}: {e}")
    return {}
