import os
import json
import csv
import sys
import time
import datetime
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List

# Reconfigure stdout to use utf-8 to prevent console print encoding errors on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv()

# Import modular services
from search import get_adapter, IntentQueryGenerator
from qualification import classify_lead_intent, calculate_lead_score
from enrichment import ContactEnrichmentManager
from monitoring import load_saved_searches, save_saved_searches, add_saved_search, run_monitoring_for_all
from crm import (
    load_db,
    save_db,
    load_searches,
    save_searches,
    check_and_save_lead,
    extract_fallback_author,
    fetch_title_from_url,
    enrich_profile_details,
    clean_json_response,
    determine_lead_platform,
    is_empty_value
)
from services.ai_agent import generate_pitch, client
from services.csv_exporter import export_to_csv

app = FastAPI(title="Silvia Serper Intent Discovery Platform")

APP_SECRET_KEY = os.getenv("APP_SECRET_KEY", "silvia_dev_key")

@app.middleware("http")
async def api_key_auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != APP_SECRET_KEY:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API Key"}
            )
    response = await call_next(request)
    return response

# Create output folder if it doesn't exist
os.makedirs("output", exist_ok=True)
os.makedirs("static", exist_ok=True)

class SearchRequest(BaseModel):
    keyword: str
    timeframe: Optional[str] = "qdr:m3"  # Default: past 3 months
    limit: Optional[int] = 10
    platform: Optional[str] = "linkedin"

class UpdateCRMRequest(BaseModel):
    sourceUrl: str
    crmStatus: str
    draftEmail: Optional[str] = ""
    authorName: Optional[str] = None
    companyName: Optional[str] = None
    buyingIntent: Optional[str] = None
    intentType: Optional[str] = None
    serviceRequired: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    needDescription: Optional[str] = None
    contactInfo: Optional[str] = None
    platform: Optional[str] = None

class GeneratePitchRequest(BaseModel):
    sourceUrl: str
    agencyName: Optional[str] = "Silvia Team"
    agencyInfo: Optional[str] = "premier design & development services"
    emailTone: Optional[str] = "Short & Conversational"

class EnrichContactRequest(BaseModel):
    sourceUrl: str

class SavedSearchRequest(BaseModel):
    keyword: str
    platform: str
    timeframe: str

@app.post("/api/search")
async def run_search(payload: SearchRequest):
    if not payload.keyword.strip():
        raise HTTPException(status_code=400, detail="Keyword is required")

    platform = (payload.platform or "linkedin").lower().strip()
    timeframe = payload.timeframe or "qdr:m3"
    
    # 1. Generate intent queries (Requirement 1)
    intent_queries = IntentQueryGenerator.generate(payload.keyword)
    print(f"\n[Search] Generating intent-based search terms: {intent_queries}")
    
    # 2. Collect and search across adapters (Requirement 6)
    raw_results = []
    if platform == "all":
        platforms = ["linkedin", "facebook", "twitter", "reddit"]
    else:
        platforms = [platform]
        
    for plat in platforms:
        adapter = get_adapter(plat)
        for q in intent_queries:
            try:
                res = adapter.search(q, timeframe=timeframe)
                if res:
                    raw_results.extend(res)
            except Exception as e:
                print(f"[Search] Error searching query '{q}' on platform '{plat}': {e}")
                
    # 3. De-duplicate raw results by link (Requirement 4)
    seen_urls = set()
    unique_raw_results = []
    for r in raw_results:
        url = r.get("link")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_raw_results.append(r)
            
    total_results_found = len(unique_raw_results)
    print(f"[Search] Merged results: {total_results_found} unique posts/threads found.")
    
    db = load_db()
    current_search_leads = []
    
    sem = asyncio.Semaphore(3)
    
    async def process_one(result):
        async with sem:
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            source_url = result.get("link", "")
            if not source_url:
                return None
            try:
                # 4. Intent Signal Classification (Requirement 8)
                lead = await asyncio.to_thread(classify_lead_intent, title, snippet)
                lead["sourceUrl"] = source_url
                lead["platform"] = determine_lead_platform(source_url)
                
                # 5. Lead Intent Scoring Engine (Requirement 3)
                lead = calculate_lead_score(lead)
                
                # Ensure author name is populated (use fallback parser if missing)
                author = lead.get("authorName")
                if is_empty_value(author):
                    author = await asyncio.to_thread(extract_fallback_author, title, source_url)
                    lead["authorName"] = author
                    
                # Secondary Enrichment search if company details are missing
                company = lead.get("companyName")
                if not is_empty_value(author) and is_empty_value(company):
                    enriched_data = await asyncio.to_thread(enrich_profile_details, author)
                    ec = enriched_data.get("companyName")
                    ei = enriched_data.get("industry")
                    el = enriched_data.get("location")
                    if not is_empty_value(ec):
                        lead["companyName"] = ec
                    if not is_empty_value(ei) and is_empty_value(lead.get("industry")):
                        lead["industry"] = ei
                    if not is_empty_value(el) and is_empty_value(lead.get("location")):
                        lead["location"] = el

                # 6. Contact Enrichment / Email Guessing (Requirement 7)
                enrich_mgr = ContactEnrichmentManager()
                enrich_details = enrich_mgr.enrich(lead.get("authorName"), lead.get("companyName"))
                c_info = enrich_details.get("email")
                if c_info == "hello@company.com" or is_empty_value(c_info):
                    c_info = None
                lead["contactInfo"] = c_info
                lead["contactSource"] = enrich_details.get("contactSource")
                lead["contactConfidence"] = enrich_details.get("contactConfidence")
                
                return {"status": "success", "lead": lead, "source_url": source_url}
            except Exception as err:
                print(f"Error classifying lead {title}: {err}")
                # Fallback
                fallback_author = await asyncio.to_thread(extract_fallback_author, title, source_url)
                fallback_lead = {
                    "authorName": fallback_author if fallback_author != "Unknown" else "Unknown",
                    "companyName": "Unknown",
                    "buyingIntent": "Unknown",
                    "intentType": "General Discussion",
                    "serviceRequired": "Unknown",
                    "industry": "Unknown",
                    "location": "Unknown",
                    "needDescription": snippet[:100] + "...",
                    "contactInfo": None,
                    "contactSource": "guessed",
                    "contactConfidence": "low",
                    "confidenceScore": 0,
                    "leadScore": 10,
                    "leadCategory": "Low Intent",
                    "leadStatus": "Unqualified",
                    "sourceUrl": source_url,
                    "crmStatus": "New",
                    "draftEmail": "",
                    "platform": determine_lead_platform(source_url)
                }
                return {"status": "fallback", "lead": fallback_lead, "source_url": source_url}

    # Parallelize AI calls
    processed_results = await asyncio.gather(*[process_one(r) for r in unique_raw_results[:payload.limit]])
    
    processed_count = 0
    qualified_count = 0
    for res in processed_results:
        if not res:
            continue
        lead = res["lead"]
        source_url = res["source_url"]
        processed_count += 1
        
        # Preserve CRM stages & draft emails if they exist
        lead["crmStatus"] = db[source_url].get("crmStatus", "New") if source_url in db else "New"
        lead["draftEmail"] = db[source_url].get("draftEmail", "") if source_url in db else ""
        
        # 7. Duplicate Checking and fingerprint update (Requirement 4)
        saved_key = check_and_save_lead(lead, db)
        
        if lead.get("leadCategory") in ["High Intent", "Medium Intent"]:
            qualified_count += 1
            
        current_search_leads.append(db[saved_key])

    # Save to database
    save_db(db)

    # Calculate qualification rate (Requirement 2 / 9)
    rate = int((qualified_count / processed_count) * 100) if processed_count > 0 else 0

    # Save search performance metrics
    searches = load_searches()
    existing_search = next((s for s in searches if s.get("keyword") == payload.keyword and s.get("platform", "linkedin") == platform), None)
    if existing_search:
        searches.remove(existing_search)
        existing_search["timestamp"] = datetime.datetime.now().isoformat()
        existing_search["timeframe"] = timeframe
        existing_search["limit"] = payload.limit
        existing_search["resultsFound"] = total_results_found
        existing_search["qualifiedLeadsCount"] = qualified_count
        existing_search["qualificationRate"] = rate
        existing_search["leadUrls"] = list(set(existing_search.get("leadUrls", []) + [l.get("sourceUrl") for l in current_search_leads if l.get("sourceUrl")]))
        searches.insert(0, existing_search)
    else:
        new_search = {
            "id": f"search_{int(time.time())}",
            "keyword": payload.keyword,
            "platform": platform,
            "timestamp": datetime.datetime.now().isoformat(),
            "timeframe": timeframe,
            "limit": payload.limit,
            "resultsFound": total_results_found,
            "qualifiedLeadsCount": qualified_count,
            "qualificationRate": rate,
            "leadUrls": [l.get("sourceUrl") for l in current_search_leads if l.get("sourceUrl")]
        }
        searches.insert(0, new_search)
    save_searches(searches)

    return {
        "status": "success",
        "leads": current_search_leads,
        "count": len(current_search_leads),
        "metrics": {
            "resultsFound": total_results_found,
            "qualified": qualified_count,
            "rate": rate
        }
    }

    return {
        "status": "success",
        "leads": current_search_leads,
        "count": len(current_search_leads),
        "metrics": {
            "resultsFound": total_results_found,
            "qualified": qualified_count,
            "rate": rate
        }
    }

@app.get("/api/leads")
async def get_current_leads():
    db = load_db()
    leads_list = list(db.values())
    return {"leads": leads_list, "count": len(leads_list)}

@app.get("/api/searches")
async def get_searches():
    searches = load_searches()
    return {"searches": searches}

@app.post("/api/leads/update")
async def update_lead_crm(payload: UpdateCRMRequest):
    db = load_db()
    if payload.sourceUrl not in db:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    db[payload.sourceUrl]["crmStatus"] = payload.crmStatus
    db[payload.sourceUrl]["draftEmail"] = payload.draftEmail
    
    if payload.authorName is not None:
        db[payload.sourceUrl]["authorName"] = payload.authorName
    if payload.companyName is not None:
        db[payload.sourceUrl]["companyName"] = payload.companyName
    if payload.buyingIntent is not None:
        db[payload.sourceUrl]["buyingIntent"] = payload.buyingIntent
    if payload.intentType is not None:
        db[payload.sourceUrl]["intentType"] = payload.intentType
    if payload.serviceRequired is not None:
        db[payload.sourceUrl]["serviceRequired"] = payload.serviceRequired
    if payload.industry is not None:
        db[payload.sourceUrl]["industry"] = payload.industry
    if payload.location is not None:
        db[payload.sourceUrl]["location"] = payload.location
    if payload.needDescription is not None:
        db[payload.sourceUrl]["needDescription"] = payload.needDescription
    if payload.contactInfo is not None:
        db[payload.sourceUrl]["contactInfo"] = payload.contactInfo
    if payload.platform is not None:
        db[payload.sourceUrl]["platform"] = payload.platform
        
    # Recalculate score after user modifications
    db[payload.sourceUrl] = calculate_lead_score(db[payload.sourceUrl])
        
    save_db(db)
    
    return {"status": "success", "lead": db[payload.sourceUrl]}

@app.post("/api/generate-pitch")
async def generate_lead_pitch(payload: GeneratePitchRequest):
    db = load_db()
    if payload.sourceUrl not in db:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    lead = db[payload.sourceUrl]
    try:
        pitch = generate_pitch(
            lead,
            agency_name=payload.agencyName,
            agency_info=payload.agencyInfo,
            tone=payload.emailTone
        )
        db[payload.sourceUrl]["draftEmail"] = pitch
        if db[payload.sourceUrl]["crmStatus"] == "New":
            db[payload.sourceUrl]["crmStatus"] = "Drafted"
            
        save_db(db)
        
        return {"status": "success", "pitch": pitch, "crmStatus": db[payload.sourceUrl]["crmStatus"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate pitch: {str(e)}")

@app.post("/api/enrich-contact")
async def enrich_lead_contact(payload: EnrichContactRequest):
    import asyncio
    db = load_db()
    if payload.sourceUrl not in db:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    lead = db[payload.sourceUrl]
    author = lead.get("authorName")
    if is_empty_value(author):
        title = fetch_title_from_url(payload.sourceUrl)
        author = extract_fallback_author(title, payload.sourceUrl)
        lead["authorName"] = author
        
    company = lead.get("companyName")
    
    if not is_empty_value(author) and is_empty_value(company):
        enriched = enrich_profile_details(author)
        if enriched:
            ec = enriched.get("companyName")
            ei = enriched.get("industry")
            el = enriched.get("location")
            if not is_empty_value(ec):
                lead["companyName"] = ec
                company = ec
            if not is_empty_value(ei):
                lead["industry"] = ei
            if not is_empty_value(el):
                lead["location"] = el

    await asyncio.sleep(1.0)
    
    # Run modular enrichment manager (Requirement 7)
    enrich_mgr = ContactEnrichmentManager()
    enrichment_info = enrich_mgr.enrich(author, company)
    
    c_info = enrichment_info.get("email")
    if c_info == "hello@company.com" or is_empty_value(c_info):
        c_info = None
    lead["contactInfo"] = c_info
    lead["contactSource"] = enrichment_info.get("contactSource")
    lead["contactConfidence"] = enrichment_info.get("contactConfidence")
    
    db[payload.sourceUrl] = lead
    save_db(db)
    
    return {
        "status": "success", 
        "contactInfo": lead["contactInfo"],
        "contactSource": lead["contactSource"],
        "contactConfidence": lead["contactConfidence"],
        "authorName": lead.get("authorName"),
        "companyName": lead.get("companyName"),
        "industry": lead.get("industry"),
        "location": lead.get("location")
    }

# Saved Searches & Monitoring Endpoints (Requirement 5)
@app.get("/api/saved-searches")
async def get_saved_searches_endpoint():
    return {"searches": load_saved_searches()}

@app.post("/api/saved-searches")
async def add_saved_search_endpoint(payload: SavedSearchRequest):
    ns = add_saved_search(payload.keyword, payload.platform, payload.timeframe)
    return {"status": "success", "search": ns}

@app.post("/api/saved-searches/run")
async def run_monitoring_endpoint():
    db = load_db()
    summary = run_monitoring_for_all(db, save_db)
    return {"status": "success", "summary": summary}

# Lead Quality Analytics Endpoints (Requirement 2 & 9)
@app.get("/api/performance")
async def get_performance_stats():
    db = load_db()
    searches = load_searches()
    
    total_results_found = 0
    high_intent = 0
    medium_intent = 0
    low_intent = 0
    rejected = 0
    
    for url, lead in db.items():
        cat = lead.get("leadCategory", "")
        if cat == "High Intent":
            high_intent += 1
        elif cat == "Medium Intent":
            medium_intent += 1
        elif cat == "Low Intent":
            low_intent += 1
            
        status = lead.get("leadStatus", "")
        if status in ["Unqualified", "Not a Lead"] or lead.get("leadCategory") == "Low Intent":
            rejected += 1
            
    # Calculate sum of resultsFound from searches_db
    for s in searches:
        total_results_found += s.get("resultsFound", 0)
        
    qualified_leads = high_intent + medium_intent
    
    return {
        "metrics": {
            "totalResultsChecked": total_results_found,
            "qualifiedCount": qualified_leads,
            "highIntentCount": high_intent,
            "mediumIntentCount": medium_intent,
            "lowIntentCount": low_intent,
            "rejectedCount": rejected
        },
        "history": searches
    }

@app.get("/api/download")
async def download_leads():
    db = load_db()
    if db:
        try:
            export_to_csv(list(db.values()))
        except Exception as e:
            print(f"CSV export error: {e}")
    csv_path = os.path.join("output", "leads.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="No leads file generated yet.")
    return FileResponse(
        csv_path, 
        media_type="text/csv", 
        filename="leads_intent_campaign.csv"
    )

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h3>Frontend UI is being built. Refresh in a few seconds!</h3>"

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
