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
    Determines the source platform (linkedin, facebook, twitter, reddit, google_maps) based on the URL domain.
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
    elif "google.com/maps" in url_lower or "places.googleapis.com" in url_lower:
        return "google_maps"
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
                lead_data["user_email"] = "admin"
                leads_col.replace_one({"sourceUrl": url, "user_email": "admin"}, lead_data, upsert=True)
                
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
                s["user_email"] = "admin"
                searches_col.replace_one(
                    {"keyword": s.get("keyword"), "platform": s.get("platform"), "user_email": "admin"},
                    s,
                    upsert=True
                )
                
            bak_path = searches_json_path + ".bak"
            os.rename(searches_json_path, bak_path)
            print(f"Automatic Migration: Searches migrated successfully. Local file backed up to {bak_path}")
        except Exception as e:
            print(f"Error during searches migration to MongoDB: {e}")

def is_facebook_fallback_name(author_name: str, url: str) -> bool:
    if not url or "facebook.com" not in url.lower() or not author_name:
        return False
    fb_username = ""
    url_lower = url.lower()
    try:
        if "/groups/" in url_lower:
            idx = url_lower.find("facebook.com/groups/")
            if idx != -1:
                part_after = url[idx + len("facebook.com/groups/"):]
                fb_username = part_after.split("/")[0].split("?")[0].strip()
        else:
            idx = url_lower.find("facebook.com/")
            if idx != -1:
                part_after = url[idx + len("facebook.com/"):]
                segment = part_after.split("/")[0].split("?")[0].strip()
                if segment and segment not in ["posts", "photos", "videos", "watch", "share", "groups", "pages", "events"]:
                    fb_username = segment
    except Exception:
        pass

    if not fb_username:
        return False

    import re
    split_camel = re.sub(r'(?<!^)(?=[A-Z])', ' ', fb_username)
    username_clean = split_camel.replace("-", " ").replace(".", " ").replace("_", " ")
    words = username_clean.split()
    cleaned_words = []
    for w in words:
        clean_w = "".join(c for c in w if c.isalpha())
        if clean_w:
            cleaned_words.append(clean_w.capitalize())
    
    cleaned_fallback = " ".join(cleaned_words)
    return author_name.lower().strip() == cleaned_fallback.lower().strip()

def extract_author_from_email_or_url(email_val: str, url_val: str) -> str:
    # 1. Try to extract from email address username first (more accurate/person-specific)
    if email_val and "@" in email_val:
        try:
            username = email_val.split("@")[0].strip()
            # Avoid generic emails
            generic_usernames = {"info", "contact", "admin", "hello", "support", "sales", "jobs", "team", "office", "marketing", "hr", "careers", "staff", "inbox"}
            if username.lower() not in generic_usernames:
                cleaned = username.replace(".", " ").replace("-", " ").replace("_", " ")
                words = cleaned.split()
                cleaned_words = []
                for w in words:
                    clean_w = "".join(c for c in w if c.isalpha())
                    if clean_w:
                        cleaned_words.append(clean_w.capitalize())
                if cleaned_words:
                    return " ".join(cleaned_words)
        except Exception:
            pass

    # 2. Try to extract from URL if it's a Facebook profile/page/group post
    if url_val and "facebook.com" in url_val.lower():
        url_lower = url_val.lower()
        try:
            segment = None
            if "/groups/" in url_lower:
                parts = url_val.split("facebook.com/groups/")
                if len(parts) > 1:
                    segment = parts[1].split("/")[0].split("?")[0].strip()
            elif "permalink.php" not in url_lower and "profile.php" not in url_lower:
                parts = url_val.split("facebook.com/")
                if len(parts) > 1:
                    segment = parts[1].split("/")[0].split("?")[0].strip()

            if segment and segment not in ["posts", "photos", "videos", "watch", "share", "groups", "pages", "events"]:
                import re
                split_camel = re.sub(r'(?<!^)(?=[A-Z])', ' ', segment)
                cleaned = split_camel.replace(".", " ").replace("-", " ").replace("_", " ")
                words = cleaned.split()
                cleaned_words = []
                for w in words:
                    clean_w = "".join(c for c in w if c.isalpha())
                    if clean_w:
                        cleaned_words.append(clean_w.capitalize())
                if cleaned_words:
                    return " ".join(cleaned_words)
        except Exception:
            pass

    return "Unknown"

def load_db(user_email: str):
    with _db_lock:
        try:
            db = get_mongo_db()
            run_db_migration(db)
            
            leads_col = db["leads"]
            leads = {}
            for doc in leads_col.find({"user_email": user_email}):
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                url = doc.get("sourceUrl")
                if url:
                    leads[url] = doc
                    
            if not leads and user_email == "admin":
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
                                    row["user_email"] = user_email
                                    leads[url] = row
                                    leads_col.replace_one({"sourceUrl": url, "user_email": user_email}, row, upsert=True)
                    except Exception as e:
                        print(f"Error migrating CSV to MongoDB: {e}")
                        
            for url, lead in leads.items():
                if "platform" not in lead or not lead.get("platform"):
                    lead["platform"] = determine_lead_platform(url)
                    leads_col.update_one({"sourceUrl": url, "user_email": user_email}, {"$set": {"platform": lead["platform"]}})
                    
                author = lead.get("authorName", "Unknown")
                
                # Check if we should update with name from email if email is present
                should_update = False
                if author == "Unknown" or not author:
                    should_update = True
                elif lead.get("platform") == "facebook" and is_facebook_fallback_name(author, url):
                    should_update = True
                
                if should_update:
                    fallback_name = extract_author_from_email_or_url(lead.get("contactInfo"), lead.get("sourceUrl"))
                    if fallback_name and fallback_name != "Unknown":
                        # Validate the extracted author name before updating
                        validated_name = validate_author_name(fallback_name, lead.get("platform"))
                        if validated_name and validated_name != "Unknown":
                            lead["authorName"] = validated_name
                            leads_col.update_one({"sourceUrl": url, "user_email": user_email}, {"$set": {"authorName": validated_name}})
                    
            return leads
        except Exception as e:
            print(f"Error loading database from MongoDB: {e}")
            return {}

def save_db(db_data, user_email: str):
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
                lead_copy["user_email"] = user_email
                bulk_ops.append(
                    pymongo.ReplaceOne({"sourceUrl": url, "user_email": user_email}, lead_copy, upsert=True)
                )
                
            if bulk_ops:
                leads_col.bulk_write(bulk_ops)
        except Exception as e:
            print(f"Error saving database to MongoDB: {e}")

def save_searches(searches, user_email: str):
    try:
        db = get_mongo_db()
        searches_col = db["searches"]
        
        for s in searches:
            s_copy = dict(s)
            if "_id" in s_copy:
                del s_copy["_id"]
            s_copy["user_email"] = user_email
            searches_col.replace_one(
                {"keyword": s_copy.get("keyword"), "platform": s_copy.get("platform"), "user_email": user_email},
                s_copy,
                upsert=True
            )
    except Exception as e:
        print(f"Error saving searches to MongoDB: {e}")

def load_searches(user_email: str):
    try:
        db = get_mongo_db()
        run_db_migration(db)
        
        searches_col = db["searches"]
        searches = []
        for doc in searches_col.find({"user_email": user_email}):
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            searches.append(doc)
        searches.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
        return searches
    except Exception as e:
        print(f"Error loading searches from MongoDB: {e}")
        return []

def clean_json_response(response_text):
    cleaned = response_text.strip()
    
    # Remove markdown formatting wraps
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
        
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
        
    cleaned = cleaned.strip()
    
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1:
        return cleaned[start:end+1]
    return cleaned

def extract_fallback_author(title: str, url: str) -> str:
    def normalize_link(l: str) -> str:
        if not l: return ""
        l_lower = l.lower().strip()
        for prefix in ["https://", "http://"]:
            if l_lower.startswith(prefix):
                l_lower = l_lower[len(prefix):]
        if "facebook.com" in l_lower:
            idx = l_lower.find("facebook.com")
            l_lower = l_lower[idx:]
        elif "linkedin.com" in l_lower:
            idx = l_lower.find("linkedin.com")
            l_lower = l_lower[idx:]
        return l_lower.strip("/")

    platform = determine_lead_platform(url)
    if title:
        if "on LinkedIn" in title:
            author = title.split("on LinkedIn")[0].strip()
            if author:
                validated = validate_author_name(author, platform)
                if validated and validated != "Unknown":
                    return validated
        for suffix in [" | Facebook", " - Facebook", " on Facebook"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if " - " in author:
                    author = author.split(" - ")[0].strip()
                if author:
                    validated = validate_author_name(author, platform)
                    if validated and validated != "Unknown":
                        return validated
        for suffix in [" on X", " | Twitter", " - Twitter", " / X"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if "(" in author and "@" in author:
                    author = author.split("(")[0].strip()
                if author:
                    validated = validate_author_name(author, platform)
                    if validated and validated != "Unknown":
                        return validated
        for suffix in [" : reddit", " | reddit", " - reddit", " on reddit"]:
            if suffix in title:
                author = title.split(suffix)[0].strip()
                if author:
                    validated = validate_author_name(author, platform)
                    if validated and validated != "Unknown":
                        return validated

    username = ""
    if "linkedin.com/posts/" in url:
        try:
            part = url.split("linkedin.com/posts/")[1]
            # Strip query params like ?utm_source=... and trailing slash
            part = part.split("?")[0].strip("/")
            
            # Since LinkedIn profile usernames cannot contain underscores,
            # any underscore in a posts/ path separates the username from the post slug.
            if "_" in part:
                username = part.split("_")[0]
            elif "-activity-" in part:
                username = part.split("-activity-")[0]
            elif "_activity-" in part:
                username = part.split("_activity-")[0]
            else:
                username = part
        except Exception:
            pass
    elif "linkedin.com/in/" in url:
        try:
            part = url.split("linkedin.com/in/")[1]
            username = part.split("/")[0].split("?")[0]
        except Exception:
            pass

    if username:
        try:
            profile_query = f'linkedin.com/in/{username}'
            profile_results = search_leads(profile_query, tbs="")
            if profile_results:
                expected_normalized = f'linkedin.com/in/{username.lower()}'
                # Try exact link match first
                for r in profile_results[:10]:
                    if normalize_link(r.get("link", "")) == expected_normalized:
                        top_title = r.get("title", "")
                        for delim in [" - ", " | ", " @ ", " on LinkedIn"]:
                            if delim in top_title:
                                top_title = top_title.split(delim)[0]
                        cleaned_name = top_title.strip()
                        if "(" in cleaned_name:
                            cleaned_name = cleaned_name.split("(")[0].strip()
                        if cleaned_name and len(cleaned_name.split()) >= 2:
                            validated = validate_author_name(cleaned_name, "linkedin")
                            if validated and validated != "Unknown":
                                return validated
                # Fallback to checking top 5
                for r in profile_results[:5]:
                    top_title = r.get("title", "")
                    for delim in [" - ", " | ", " @ ", " on LinkedIn"]:
                        if delim in top_title:
                            top_title = top_title.split(delim)[0]
                    cleaned_name = top_title.strip()
                    if "(" in cleaned_name:
                        cleaned_name = cleaned_name.split("(")[0].strip()
                    if cleaned_name and len(cleaned_name.split()) >= 2:
                        validated = validate_author_name(cleaned_name, "linkedin")
                        if validated and validated != "Unknown":
                            return validated
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

    # 2. Handle Facebook profile lookup using Serper search and fallbacks
    fb_username = ""
    if url and "facebook.com" in url.lower():
        url_lower = url.lower()
        try:
            if "/groups/" in url_lower:
                idx = url_lower.find("facebook.com/groups/")
                if idx != -1:
                    part_after = url[idx + len("facebook.com/groups/"):]
                    fb_username = part_after.split("/")[0].split("?")[0].strip()
            elif "profile.php" in url_lower:
                import urllib.parse as urlparse
                parsed = urlparse.urlparse(url)
                qs = urlparse.parse_qs(parsed.query)
                if "id" in qs and qs["id"]:
                    fb_username = qs["id"][0].strip()
            elif "permalink.php" not in url_lower:
                idx = url_lower.find("facebook.com/")
                if idx != -1:
                    part_after = url[idx + len("facebook.com/"):]
                    segment = part_after.split("/")[0].split("?")[0].strip()
                    if segment and segment not in ["posts", "photos", "videos", "watch", "share", "groups", "pages", "events"]:
                        fb_username = segment
        except Exception:
            pass

    if fb_username:
        try:
            if "/groups/" in url.lower():
                profile_query = f'facebook.com/groups/{fb_username}'
                expected_normalized = f'facebook.com/groups/{fb_username.lower()}'
            else:
                profile_query = f'facebook.com/{fb_username}'
                expected_normalized = f'facebook.com/{fb_username.lower()}'
                
            profile_results = search_leads(profile_query, tbs="")
            if profile_results:
                # Try exact link match first
                for r in profile_results[:10]:
                    if normalize_link(r.get("link", "")) == expected_normalized:
                        top_title = r.get("title", "")
                        for suffix in [" | Facebook", " - Facebook", " on Facebook", " | Page", " - Page"]:
                            if suffix.lower() in top_title.lower():
                                idx = top_title.lower().find(suffix.lower())
                                top_title = top_title[:idx]
                        for delim in [" - ", " | ", " @ "]:
                            if delim in top_title:
                                top_title = top_title.split(delim)[0]
                        cleaned_name = top_title.strip()
                        if "(" in cleaned_name:
                            cleaned_name = cleaned_name.split("(")[0].strip()
                        
                        noise_words = {"log into facebook", "facebook", "log in", "sign up", "security check", "welcome to facebook"}
                        is_noise = False
                        for noise in noise_words:
                            if noise in cleaned_name.lower():
                                is_noise = True
                                break
                        
                        if not is_noise and cleaned_name and len(cleaned_name.split()) >= 2:
                            validated = validate_author_name(cleaned_name, "facebook")
                            if validated and validated != "Unknown":
                                return validated
                                
                # Fallback to checking top 5 (only if not a numeric ID)
                if not fb_username.isdigit():
                    for r in profile_results[:5]:
                        top_title = r.get("title", "")
                        for suffix in [" | Facebook", " - Facebook", " on Facebook", " | Page", " - Page"]:
                            if suffix.lower() in top_title.lower():
                                idx = top_title.lower().find(suffix.lower())
                                top_title = top_title[:idx]
                        for delim in [" - ", " | ", " @ "]:
                            if delim in top_title:
                                top_title = top_title.split(delim)[0]
                        cleaned_name = top_title.strip()
                        if "(" in cleaned_name:
                            cleaned_name = cleaned_name.split("(")[0].strip()
                        
                        noise_words = {"log into facebook", "facebook", "log in", "sign up", "security check", "welcome to facebook"}
                        is_noise = False
                        for noise in noise_words:
                            if noise in cleaned_name.lower():
                                is_noise = True
                                break
                        
                        if not is_noise and cleaned_name and len(cleaned_name.split()) >= 2:
                            validated = validate_author_name(cleaned_name, "facebook")
                            if validated and validated != "Unknown":
                                return validated
        except Exception as e:
            print(f"Error fetching profile name for Facebook username {fb_username}: {e}")

        # Fallback if search returns noise or empty, clean the username segment
        if not fb_username.isdigit():
            import re
            split_camel = re.sub(r'(?<!^)(?=[A-Z])', ' ', fb_username)
            username_clean = split_camel.replace("-", " ").replace(".", " ").replace("_", " ")
            words = username_clean.split()
            cleaned_words = []
            for w in words:
                clean_w = "".join(c for c in w if c.isalpha())
                if clean_w:
                    cleaned_words.append(clean_w.capitalize())
            if cleaned_words:
                return " ".join(cleaned_words)
            
    return "Unknown"

def validate_author_name(author: str, platform: str = None) -> str:
    if not author or is_empty_value(author):
        return "Unknown"
    
    author_clean = str(author).strip()
    
    # 1. Reject names with question marks
    if "?" in author_clean:
        return "Unknown"
        
    # 2. Reject names with more than 3 words (relaxed to 6 words for facebook and 15 for google_maps to support business names)
    max_words = 6 if platform == "facebook" else (15 if platform == "google_maps" else 3)
    if len(author_clean.split()) > max_words:
        return "Unknown"
        
    # 3. Reject names containing specific phrases (case-insensitive)
    lower_author = author_clean.lower()
    reject_phrases = [
        "looking for", "need", "wanted", "hiring", 
        "seeking", "requirement", "opportunity"
    ]
    for phrase in reject_phrases:
        if phrase in lower_author:
            return "Unknown"
            
    return author_clean

def validate_company_name(company: str) -> str:
    if not company or is_empty_value(company):
        return "Not Specified"
    
    company_clean = str(company).strip()
    
    # 1. Reject names with more than 4 words
    if len(company_clean.split()) > 4:
        return "Not Specified"
        
    # 2. Reject names containing specific phrases (case-insensitive)
    lower_company = company_clean.lower()
    reject_phrases = [
        "looking for", "need", "wanted", "hiring", 
        "seeking", "requirement", "opportunity"
    ]
    for phrase in reject_phrases:
        if phrase in lower_company:
            return "Not Specified"
            
    return company_clean

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

def delete_lead_from_db(source_url: str, user_email: str) -> bool:
    with _db_lock:
        try:
            db = get_mongo_db()
            leads_col = db["leads"]
            result = leads_col.delete_one({"sourceUrl": source_url, "user_email": user_email})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting lead from MongoDB: {e}")
            return False

def delete_search_from_db(search_id: str, user_email: str) -> bool:
    try:
        db = get_mongo_db()
        searches_col = db["searches"]
        result = searches_col.delete_one({"id": search_id, "user_email": user_email})
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting search from MongoDB: {e}")
        return False

# Multi-User Authentication Helpers
def hash_password(password: str, salt: bytes = None):
    if salt is None:
        salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return pw_hash.hex(), salt.hex()

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    try:
        salt_bytes = bytes.fromhex(salt)
        new_hash, _ = hash_password(password, salt_bytes)
        return new_hash == password_hash
    except Exception:
        return False

def create_user(email: str, password: str) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        
        email_clean = email.strip().lower()
        if users_col.find_one({"email": email_clean}):
            return False
            
        pw_hash, salt = hash_password(password)
        users_col.insert_one({
            "email": email_clean,
            "password_hash": pw_hash,
            "salt": salt,
            "created_at": datetime.datetime.utcnow().isoformat()
        })
        return True
    except Exception as e:
        print(f"Error creating user in MongoDB: {e}")
        return False

def authenticate_user(email: str, password: str):
    try:
        db = get_mongo_db()
        users_col = db["users"]
        
        email_clean = email.strip().lower()
        user = users_col.find_one({"email": email_clean})
        if not user:
            return None
            
        if verify_password(password, user["password_hash"], user["salt"]):
            return {"email": user["email"]}
        return None
    except Exception as e:
        print(f"Error authenticating user in MongoDB: {e}")
        return None

def create_session(email: str) -> str:
    import secrets
    try:
        db = get_mongo_db()
        sessions_col = db["sessions"]
        
        session_token = secrets.token_hex(24)
        expires_at = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
        
        sessions_col.insert_one({
            "session_token": session_token,
            "user_email": email.strip().lower(),
            "expires_at": expires_at
        })
        return session_token
    except Exception as e:
        print(f"Error creating session in MongoDB: {e}")
        return ""

def verify_session(token: str):
    try:
        db = get_mongo_db()
        sessions_col = db["sessions"]
        
        session = sessions_col.find_one({"session_token": token})
        if not session:
            return None
            
        expires_at_str = session.get("expires_at")
        if expires_at_str:
            try:
                expires_at = datetime.datetime.fromisoformat(expires_at_str)
                if datetime.datetime.utcnow() > expires_at:
                    sessions_col.delete_one({"session_token": token})
                    return None
            except Exception:
                pass
                
        return session.get("user_email")
    except Exception as e:
        print(f"Error verifying session in MongoDB: {e}")
        return None

def delete_session(token: str):
    try:
        db = get_mongo_db()
        sessions_col = db["sessions"]
        sessions_col.delete_one({"session_token": token})
    except Exception as e:
        print(f"Error deleting session in MongoDB: {e}")

def save_email_config(user_email: str, config: dict) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        result = users_col.update_one(
            {"email": user_email.strip().lower()},
            {"$set": {"email_config": config}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    except Exception as e:
        print(f"Error saving email config in MongoDB: {e}")
        return False

def get_email_config(user_email: str) -> dict:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        user = users_col.find_one({"email": user_email.strip().lower()})
        if user:
            return user.get("email_config") or {}
        return {}
    except Exception as e:
        print(f"Error loading email config from MongoDB: {e}")
        return {}


def save_webhook_config(user_email: str, webhook_url: str) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        result = users_col.update_one(
            {"email": user_email.strip().lower()},
            {"$set": {"webhook_url": webhook_url.strip()}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    except Exception as e:
        print(f"Error saving webhook url in MongoDB: {e}")
        return False


def get_webhook_config(user_email: str) -> str:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        user = users_col.find_one({"email": user_email.strip().lower()})
        if user:
            return user.get("webhook_url") or ""
        return ""
    except Exception as e:
        print(f"Error loading webhook url from MongoDB: {e}")
        return ""


def update_user_password(email: str, new_password: str) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        sessions_col = db["sessions"]
        
        email_clean = email.strip().lower()
        user = users_col.find_one({"email": email_clean})
        if not user:
            return False
            
        pw_hash, salt = hash_password(new_password)
        users_col.update_one(
            {"email": email_clean},
            {"$set": {"password_hash": pw_hash, "salt": salt}}
        )
        # Delete active sessions for the user to force relogin
        sessions_col.delete_many({"user_email": email_clean})
        return True
    except Exception as e:
        print(f"Error updating user password in MongoDB: {e}")
        return False


def generate_and_save_otp(email: str, purpose: str, pending_data: dict = None) -> str:
    import secrets
    try:
        db = get_mongo_db()
        otps_col = db["otps"]
        
        email_clean = email.strip().lower()
        # Delete existing OTPs for same email and purpose
        otps_col.delete_many({"email": email_clean, "purpose": purpose})
        
        # Generate 6-digit OTP code
        otp_code = "".join(str(secrets.randbelow(10)) for _ in range(6))
        
        otps_col.insert_one({
            "email": email_clean,
            "otp": otp_code,
            "purpose": purpose,
            "pending_data": pending_data,
            "created_at": datetime.datetime.utcnow()
        })
        return otp_code
    except Exception as e:
        print(f"Error generating OTP in MongoDB: {e}")
        return ""


def verify_and_delete_otp(email: str, purpose: str, otp_code: str) -> dict:
    try:
        db = get_mongo_db()
        otps_col = db["otps"]
        
        email_clean = email.strip().lower()
        otp_doc = otps_col.find_one({"email": email_clean, "purpose": purpose, "otp": otp_code.strip()})
        if not otp_doc:
            return None
            
        # Check expiration (10 minutes)
        created_at = otp_doc.get("created_at")
        if created_at:
            age = datetime.datetime.utcnow() - created_at
            if age.total_seconds() > 600:
                otps_col.delete_one({"_id": otp_doc["_id"]})
                return None
                
        # OTP is valid, delete it
        otps_col.delete_one({"_id": otp_doc["_id"]})
        return otp_doc.get("pending_data") or {}
    except Exception as e:
        print(f"Error verifying OTP in MongoDB: {e}")
        return None


def send_otp_email(email: str, otp: str, purpose: str):
    email_clean = email.strip().lower()
    subject = ""
    body = ""
    if purpose == "signup":
        subject = "Verify your LeadFlow Workspace Registration"
        body = f"Hello,\n\nThank you for registering at LeadFlow. Your email verification code is:\n\n{otp}\n\nThis OTP is valid for 10 minutes."
    elif purpose == "forgot_password":
        subject = "Reset your LeadFlow Password"
        body = f"Hello,\n\nYou requested a password reset for your LeadFlow account. Your OTP code is:\n\n{otp}\n\nThis OTP is valid for 10 minutes."
    
    # Try sending via smtplib using ENV configurations
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    
    if smtp_host and smtp_port and smtp_user and smtp_pass:
        import smtplib
        from email.mime.text import MIMEText
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = email_clean
            
            # Connect and send
            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10.0)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10.0)
                if port == 587:
                    server.starttls()
            
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [email_clean], msg.as_string())
            server.quit()
            print(f"[Email] Successfully sent OTP email to {email_clean}")
            return
        except Exception as e:
            print(f"[Email] Failed to send OTP email to {email_clean} via SMTP: {e}")
            
    # Fallback developer log
    print("\n" + "="*80)
    print(f"  [DEVELOPER ALERT] OTP CODE GENERATED FOR {email_clean.upper()}")
    print(f"  PURPOSE: {purpose.upper()}")
    print(f"  OTP CODE: {otp}")
    print("="*80 + "\n")


def save_places_api_key(user_email: str, api_key: str) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        result = users_col.update_one(
            {"email": user_email.strip().lower()},
            {"$set": {"places_api_key": api_key.strip()}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    except Exception as e:
        print(f"Error saving places api key in MongoDB: {e}")
        return False


def get_places_api_key(user_email: str) -> str:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        user = users_col.find_one({"email": user_email.strip().lower()})
        if user:
            return user.get("places_api_key") or ""
        return ""
    except Exception as e:
        print(f"Error loading places api key from MongoDB: {e}")
        return ""


def save_twitter_api_key(user_email: str, api_key: str) -> bool:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        result = users_col.update_one(
            {"email": user_email.strip().lower()},
            {"$set": {"twitter_api_key": api_key.strip()}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    except Exception as e:
        print(f"Error saving twitter api key in MongoDB: {e}")
        return False


def get_twitter_api_key(user_email: str) -> str:
    try:
        db = get_mongo_db()
        users_col = db["users"]
        user = users_col.find_one({"email": user_email.strip().lower()})
        if user:
            return user.get("twitter_api_key") or ""
        return ""
    except Exception as e:
        print(f"Error loading twitter api key from MongoDB: {e}")
        return ""



