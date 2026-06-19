from services.serper import search_leads

class RedditAdapter:
    def __init__(self):
        self.platform_name = "reddit"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3", match_type: str = "partial") -> list:
        if match_type == "exact":
            query = f'site:reddit.com "{keyword}"'
        else:
            query = f'site:reddit.com {keyword}'
            
        print(f"[RedditAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[RedditAdapter] Error: {e}")
            return []
