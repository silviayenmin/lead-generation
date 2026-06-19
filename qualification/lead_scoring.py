from crm.lead_database import is_empty_value

def calculate_lead_score(lead: dict) -> dict:
    """
    Scoring factors:
    Intent Score = 40 points
    Service Required Mentioned = 20 points
    Need Description Present = 15 points
    Company Mentioned = 10 points
    Location Mentioned = 5 points
    Author Identified = 10 points

    Final Score:
    0–39 = Low Intent
    40–69 = Medium Intent
    70–100 = High Intent
    """
    intent_score = 0
    intent_type = lead.get("intentType", "General Discussion")
    buying_intent = lead.get("buyingIntent", "Low")
    
    # Intent type / Buying Intent - 40 points
    if intent_type in ["Looking For Service", "Recommendation Request"]:
        intent_score = 40
    elif intent_type in ["Hiring Signal", "Expansion Signal", "Funding Signal"]:
        intent_score = 30
    else:
        # Fallback to checking text values
        bi = str(buying_intent).lower()
        if bi in ["high", "hiring", "qualified"]:
            intent_score = 40
        elif bi in ["medium", "warm", "moderate"]:
            intent_score = 25
        else:
            intent_score = 10

    # Service Required Mentioned - 20 points
    service = str(lead.get("serviceRequired", "")).strip()
    service_score = 20 if service and not is_empty_value(service) and service.lower() != "no" else 0

    # Need Description Present - 15 points
    need = str(lead.get("needDescription", "")).strip()
    need_score = 15 if need and len(need) > 10 and not is_empty_value(need) else 0

    # Company Mentioned - 10 points
    company = str(lead.get("companyName", "")).strip()
    company_score = 10 if company and not is_empty_value(company) else 0

    # Location Mentioned - 5 points
    loc = str(lead.get("location", "")).strip()
    location_score = 5 if loc and not is_empty_value(loc) else 0

    # Author Identified - 10 points
    author = str(lead.get("authorName", "")).strip()
    author_score = 10 if author and not is_empty_value(author) else 0

    total_score = intent_score + service_score + need_score + company_score + location_score + author_score

    if total_score >= 70:
        category = "High Intent"
    elif total_score >= 40:
        category = "Medium Intent"
    else:
        category = "Low Intent"

    lead["leadScore"] = total_score
    lead["leadCategory"] = category
    return lead

