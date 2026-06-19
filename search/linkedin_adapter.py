from services.serper import search_leads

class LinkedInAdapter:
    def __init__(self):
        self.platform_name = "linkedin"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3") -> list:
        query = f'site:linkedin.com/posts "{keyword}"'
        print(f"[LinkedInAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[LinkedInAdapter] Error: {e}")
            return []
