from services.serper import search_leads

class TwitterAdapter:
    def __init__(self):
        self.platform_name = "twitter"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3") -> list:
        query = f'(site:x.com OR site:twitter.com) "{keyword}"'
        print(f"[TwitterAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[TwitterAdapter] Error: {e}")
            return []
