from services.serper import search_leads

class FacebookAdapter:
    def __init__(self):
        self.platform_name = "facebook"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3") -> list:
        query = f'site:facebook.com "{keyword}"'
        print(f"[FacebookAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[FacebookAdapter] Error: {e}")
            return []
