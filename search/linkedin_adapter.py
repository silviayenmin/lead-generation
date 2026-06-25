from services.serper import search_leads

class LinkedInAdapter:
    def __init__(self):
        self.platform_name = "linkedin"
        
    def search(self, keyword: str, timeframe: str = "qdr:m3", match_type: str = "partial", location: str = None, industry: str = None) -> list:
        q_parts = []
        if match_type == "exact":
            q_parts.append(f'"{keyword}"')
        else:
            q_parts.append(keyword)
            
        if location and location.strip():
            q_parts.append(f'"{location.strip()}"')
            
        if industry and industry.strip():
            q_parts.append(f'"{industry.strip()}"')
            
        query = f'site:linkedin.com/posts {" ".join(q_parts)}'
            
        print(f"[LinkedInAdapter] Searching query: {query}")
        try:
            return search_leads(query, tbs=timeframe)
        except Exception as e:
            print(f"[LinkedInAdapter] Error: {e}")
            return []
