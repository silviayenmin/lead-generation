from services.serper import search_leads

class TwitterAdapter:
    def __init__(self):
        self.platform_name = "twitter"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3", match_type: str = "partial") -> list:
        if match_type == "exact":
            query = f'(site:x.com OR site:twitter.com) "{keyword}"'
        else:
            query = f'(site:x.com OR site:twitter.com) {keyword}'
            
        print(f"[TwitterAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[TwitterAdapter] Error: {e}")
            return []
