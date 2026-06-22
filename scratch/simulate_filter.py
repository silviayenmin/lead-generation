import requests

url = "http://127.0.0.1:8000/api/leads"
headers = {
    "X-API-Key": "silvia_dev_key"
}

try:
    response = requests.get(url, headers=headers)
    leads = response.json().get("leads", [])
    print(f"Total leads from API: {len(leads)}")
    
    # Let's simulate:
    # archiveViewFilter = "all"
    # statusVal = "qualified"
    # crmVal = "all"
    # platformVal = "all"
    
    statusVal = "qualified"
    crmVal = "all"
    platformVal = "all"
    archiveViewFilter = "all"
    
    def get_lead_platform(lead):
        platform = lead.get("platform")
        if platform:
            return platform.lower()
        url = lead.get("sourceUrl", "").lower()
        if "facebook.com" in url:
            return "facebook"
        if "twitter.com" in url or "x.com" in url:
            return "twitter"
        if "reddit.com" in url:
            return "reddit"
        return "linkedin"
        
    filtered = []
    for lead in leads:
        # Filter by header tabs first
        if archiveViewFilter == "high":
            if lead.get("leadCategory", "") != "High Intent":
                continue
        elif archiveViewFilter == "facebook":
            if get_lead_platform(lead) != "facebook":
                continue
        elif archiveViewFilter == "linkedin":
            if get_lead_platform(lead) != "linkedin":
                continue
        elif archiveViewFilter == "replied":
            if (lead.get("crmStatus") or "").lower() != "replied":
                continue
                
        # Status match
        leadStatus = str(lead.get("leadStatus") or "").lower().strip()
        statusMatch = False
        if statusVal == "all":
            statusMatch = True
        elif statusVal == "qualified":
            statusMatch = (leadStatus == "qualified")
        elif statusVal == "unqualified":
            statusMatch = (leadStatus in ["unqualified", "not qualified", "disqualified"])
        elif statusVal == "warm lead":
            statusMatch = (leadStatus in ["warm lead", "warm"])
        elif statusVal == "potential lead":
            statusMatch = (leadStatus in ["potential lead", "potential", "cold lead", "cold"])
        elif statusVal == "not a lead":
            statusMatch = (leadStatus in ["not a lead", "not lead"])
        elif statusVal == "informational":
            statusMatch = (leadStatus in ["informational", "information"])
        else:
            statusMatch = (leadStatus == statusVal or statusVal in leadStatus)
            
        # CRM match
        leadCrm = str(lead.get("crmStatus") or "New").lower()
        crmMatch = (crmVal == "all" or leadCrm == crmVal)
        
        # Platform match
        leadPlatform = get_lead_platform(lead)
        platformMatch = (platformVal == "all" or leadPlatform == platformVal)
        
        if statusMatch and crmMatch and platformMatch:
            filtered.append(lead)
            
    print(f"Filtered leads matching 'Qualified': {len(filtered)}")
    print("\nFiltered lead details:")
    for lead in filtered:
        print(f"  - Author: {lead.get('authorName')} | Status: {lead.get('leadStatus')} | Category: {lead.get('leadCategory')} | CRM: {lead.get('crmStatus')}")

except Exception as e:
    print(f"Error: {e}")
