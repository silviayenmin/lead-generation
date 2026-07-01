import sys
import os
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.abspath("."))
from services.serper import search_leads
import json

# Run the exact query from the server log
query = 'site:linkedin.com/posts ("looking for" OR hiring OR seeking OR need) ("corporate lawyers" OR "corporate lawyer")'
print(f"Running exact query: {query}")

# Let's test with different timeframes:
for tf in ["qdr:m3", "qdr:w", "qdr:d", None]:
    res = search_leads(query, tbs=tf, num=10)
    print(f"Timeframe: {tf} -> count: {len(res)}")
    if res:
        print(f"  First result: {res[0].get('title')} ({res[0].get('link')})")
