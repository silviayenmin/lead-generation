import requests

url = "http://127.0.0.1:8000/api/leads"
headers = {
    "X-API-Key": "silvia_dev_key"
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    data = response.json()
    leads = data.get("leads", [])
    print(f"Total leads returned: {len(leads)}")
    
    # Check what statuses are in the returned JSON
    statuses = {}
    for lead in leads:
        status = lead.get("leadStatus")
        statuses[status] = statuses.get(status, 0) + 1
    print("\nLead Statuses in API Response:")
    for status, count in statuses.items():
        print(f"  - {repr(status)}: {count}")
        
except Exception as e:
    print(f"Error calling API: {e}")
