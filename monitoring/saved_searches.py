import os
import json
import datetime
from search import get_adapter, IntentQueryGenerator
from qualification import classify_lead_intent, calculate_lead_score
from enrichment import ContactEnrichmentManager

SAVED_SEARCHES_PATH = os.path.join("output", "saved_searches.json")

def load_saved_searches(user_email: str) -> list:
    try:
        from crm.lead_database import get_mongo_db
        db = get_mongo_db()
        col = db["saved_searches"]
        
        # Migrate local saved searches JSON if it exists
        if os.path.exists(SAVED_SEARCHES_PATH):
            print(f"Automatic Migration: Found local saved searches JSON at {SAVED_SEARCHES_PATH}. Migrating to MongoDB...")
            try:
                with open(SAVED_SEARCHES_PATH, "r", encoding="utf-8") as f:
                    local_searches = json.load(f)
                for s in local_searches:
                    s["user_email"] = "admin"
                    col.replace_one({"id": s.get("id"), "user_email": "admin"}, s, upsert=True)
                bak_path = SAVED_SEARCHES_PATH + ".bak"
                os.rename(SAVED_SEARCHES_PATH, bak_path)
                print(f"Automatic Migration: Saved searches migrated successfully. Local file backed up to {bak_path}")
            except Exception as e:
                print(f"Error during saved searches migration to MongoDB: {e}")

        searches = []
        for doc in col.find({"user_email": user_email}):
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            searches.append(doc)
        return searches
    except Exception as e:
        print(f"Error loading saved searches: {e}")
        return []

def save_saved_searches(searches: list, user_email: str):
    try:
        from crm.lead_database import get_mongo_db
        db = get_mongo_db()
        col = db["saved_searches"]
        for s in searches:
            s_copy = dict(s)
            if "_id" in s_copy:
                del s_copy["_id"]
            s_copy["user_email"] = user_email
            col.replace_one(
                {"id": s_copy["id"], "user_email": user_email},
                s_copy,
                upsert=True
            )
    except Exception as e:
        print(f"Error saving saved searches: {e}")

def add_saved_search(user_email: str, keyword: str, platform: str, timeframe: str, match_type: str = "partial", location: str = None, industry: str = None, limit: int = 10) -> dict:
    searches = load_saved_searches(user_email)
    
    # Check if already exists
    for s in searches:
        if s.get("keyword") == keyword and s.get("platform") == platform and s.get("timeframe") == timeframe and s.get("matchType", "partial") == match_type and s.get("location") == location and s.get("industry") == industry and s.get("limit", 10) == limit:
            return s
            
    new_search = {
        "id": f"saved_{int(datetime.datetime.now().timestamp())}",
        "keyword": keyword,
        "platform": platform,
        "timeframe": timeframe,
        "matchType": match_type,
        "location": location,
        "industry": industry,
        "limit": limit,
        "createdAt": datetime.datetime.now().isoformat(),
        "lastRun": None,
        "leadsFoundCount": 0,
        "user_email": user_email
    }
    searches.append(new_search)
    save_saved_searches(searches, user_email)
    return new_search

def run_monitoring_for_user(user_email: str, db: dict, save_db_callback) -> dict:
    """
    Runs all saved searches for a specific user, qualifies leads, updates the db,
    and returns a summary of the monitoring run.
    """
    saved = load_saved_searches(user_email)
    if not saved:
        return {"status": "no_searches", "message": "No saved searches to monitor."}
        
    from crm.lead_database import (
        check_and_save_lead, extract_fallback_author, enrich_profile_details, 
        determine_lead_platform, is_empty_value, validate_author_name, validate_company_name,
        get_places_api_key, is_location_match
    )
    
    summary = {
        "timestamp": datetime.datetime.now().isoformat(),
        "searchesRun": len(saved),
        "newLeadsFound": 0,
        "results": []
    }
    
    for s in saved:
        keyword = s.get("keyword")
        platform = s.get("platform", "linkedin")
        timeframe = s.get("timeframe", "qdr:m3")
        match_type = s.get("matchType", "partial")
        location = s.get("location")
        industry = s.get("industry")
        
        # Generate Intent Queries
        if platform == "google_maps":
            intent_queries = [keyword]
        else:
            intent_queries = IntentQueryGenerator.generate(keyword)
        if platform == "all":
            platforms = ["linkedin", "facebook", "twitter"]
        else:
            platforms = [platform]
            
        raw_results = []
        for plat in platforms:
            adapter = get_adapter(plat)
            for query in intent_queries:
                try:
                    if plat == "google_maps":
                        places_key = get_places_api_key(user_email)
                        if not places_key:
                            places_key = os.getenv("PLACES_API_KEY")
                        res = adapter.search(
                            query,
                            timeframe=timeframe,
                            match_type=match_type,
                            location=location,
                            industry=industry,
                            api_key=places_key,
                            limit=s.get("limit", 10)
                        )
                    else:
                        res = adapter.search(
                            query,
                            timeframe=timeframe,
                            match_type=match_type,
                            location=location,
                            industry=industry,
                            limit=s.get("limit", 10)
                        )
                    if res:
                        raw_results.extend(res)
                except Exception as ex:
                    print(f"[Monitoring] Error searching query '{query}' on platform '{plat}': {ex}")
                
        # Remove duplicate raw items based on link/URL
        seen_urls = set()
        unique_raw_results = []
        for r in raw_results:
            url = r.get("link")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_raw_results.append(r)
                
        qualified_leads_in_this_run = 0
        new_leads_in_this_run = 0
        
        # Process and qualify
        for item in unique_raw_results:
            url = item.get("link")
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            
            # Check if this URL is already in database
            is_new = url not in db
            
            try:
                # Qualify lead
                search_type = s.get("search_type", "sales")
                lead_data = classify_lead_intent(title, snippet, search_type)
                lead_data["sourceUrl"] = url
                lead_data["search_type"] = search_type
                lead_data["platform"] = determine_lead_platform(url)
                
                # Run lead scoring
                lead_data = calculate_lead_score(lead_data)
                
                # Check status and set New Discovery if it qualifies and is new
                # Only insert if it is qualified (or has buying intent / is medium or high intent)
                is_qualified = lead_data.get("leadCategory") in ["High Intent", "Medium Intent"]
                
                if is_qualified:
                    # Fill missing author details
                    author = lead_data.get("authorName")
                    if is_empty_value(author):
                        author = extract_fallback_author(title, url)
                    
                    # Apply author validation
                    author = validate_author_name(author)
                    lead_data["authorName"] = author
 
                    # Apply company validation
                    company = validate_company_name(lead_data.get("companyName"))
                    lead_data["companyName"] = company
                        
                    # Enrichment search if company details or location are missing, or if a location filter is requested
                    if lead_data.get("platform") != "google_maps" and not is_empty_value(author):
                        if is_empty_value(lead_data.get("companyName")) or is_empty_value(lead_data.get("location")) or (location and location.strip()):
                            enriched = enrich_profile_details(author, url)
                            if enriched:
                                ec = enriched.get("companyName")
                                if ec and not is_empty_value(ec) and is_empty_value(lead_data.get("companyName")):
                                    lead_data["companyName"] = validate_company_name(ec)
                                    company = lead_data["companyName"]
                                lead_data["industry"] = enriched.get("industry") or lead_data.get("industry") or "Unknown"
                                lead_data["location"] = enriched.get("location") or "Unknown"
                            
                    # Print debug information (Requirement 5)
                    print("\n" + "="*50)
                    print(f"Original Title: {title}")
                    print(f"Original Snippet: {snippet}")
                    print(f"Extracted Author: {lead_data.get('authorName')}")
                    print(f"Extracted Company: {lead_data.get('companyName')}")
                    print(f"Confidence Score: {lead_data.get('confidenceScore') or lead_data.get('leadScore') or 0}%")
                    print("="*50 + "\n")
                    
                    # Enforce location filtering if specified
                    if location and location.strip():
                        lead_loc = lead_data.get("location")
                        text_ctx = f"{title} {snippet}"
                        if not is_location_match(location, lead_loc, text_context=text_ctx):
                            print(f"[Monitoring Filter] Discarding lead {author} because profile location '{lead_loc}' does not match requested location '{location}'")
                            continue
                            
                    qualified_leads_in_this_run += 1
                            
                    # Enrich contact info using default guessing
                    enrich_mgr = ContactEnrichmentManager()
                    enrichment_info = enrich_mgr.enrich(lead_data.get("authorName"), lead_data.get("companyName"))
                    lead_data["contactInfo"] = enrichment_info.get("email")
                    lead_data["contactSource"] = enrichment_info.get("contactSource")
                    lead_data["contactConfidence"] = enrichment_info.get("contactConfidence")
                    
                    # Extract companyName from enrichment APIs if not already present
                    if is_empty_value(lead_data.get("companyName")) and enrichment_info.get("companyName"):
                        lead_data["companyName"] = validate_company_name(enrichment_info.get("companyName"))
                    
                    # If this is a new URL, set to New Discovery
                    if is_new:
                        lead_data["crmStatus"] = "New Discovery"
                        lead_data["discoveryTimestamp"] = datetime.datetime.now().isoformat()
                        new_leads_in_this_run += 1
                    else:
                        # Keep existing crmStatus
                        lead_data["crmStatus"] = db[url].get("crmStatus", "New")
                        lead_data["discoveryTimestamp"] = db[url].get("discoveryTimestamp", datetime.datetime.now().isoformat())
                        
                    # Save using fingerprint duplicate check
                    saved_key = check_and_save_lead(lead_data, db)
                    if saved_key != url and is_new:
                        # If fingerprint matched an existing lead, it was updated, not added as a new one
                        new_leads_in_this_run = max(0, new_leads_in_this_run - 1)
                        
            except Exception as e:
                print(f"[Monitoring] Error qualifying lead {url}: {e}")
                
        # Update saved search stats
        s["lastRun"] = datetime.datetime.now().isoformat()
        s["leadsFoundCount"] = qualified_leads_in_this_run
        
        summary["newLeadsFound"] += new_leads_in_this_run
        summary["results"].append({
            "keyword": keyword,
            "platform": platform,
            "resultsChecked": len(unique_raw_results),
            "qualified": qualified_leads_in_this_run,
            "newLeadsAdded": new_leads_in_this_run
        })
        
    save_saved_searches(saved, user_email)
    save_db_callback(db)
    
    return summary
