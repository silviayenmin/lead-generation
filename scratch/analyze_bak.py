import json

try:
    with open("output/leads_db.json.bak", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    intent_counts = {}
    for lead in data.values():
        bi = lead.get("buyingIntent", "None")
        intent_counts[bi] = intent_counts.get(bi, 0) + 1
        
    print("Buying Intent Distribution in leads_db.json.bak:")
    for intent, count in sorted(intent_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {intent}: {count}")
except Exception as e:
    print(f"Error: {e}")
