class IntentQueryGenerator:
    @staticmethod
    def generate(keyword: str) -> list:
        import re
        
        # Clean common intent prefixes to avoid double-prefixing
        cleaned_keyword = keyword.strip()
        prefixes = [
            r"looking\s+to\s+hire",
            r"looking\s+to\s+find",
            r"recommendation\s+for",
            r"recommendations\s+for",
            r"searching\s+for",
            r"looking\s+for",
            r"in\s+search\s+of",
            r"in\s+need\s+of",
            r"seek\s+partner",
            r"seeking\s+partner",
            r"seeking",
            r"hire",
            r"hiring",
            r"needed",
            r"needs",
            r"need",
            r"wanted",
            r"want",
            r"recommend",
            r"recommends",
        ]
        
        for prefix in prefixes:
            pattern = re.compile(rf"^{prefix}\b\s*", re.IGNORECASE)
            if pattern.match(cleaned_keyword):
                cleaned_keyword = pattern.sub("", cleaned_keyword).strip()
                break
                
        keyword_lower = cleaned_keyword.lower().strip()
        if not keyword_lower:
            keyword_lower = keyword.lower().strip()
            
        # Check if the keyword represents a service that needs a suffix (like "company")
        # to avoid queries like "looking for software development" when we want "looking for software development company"
        needs_suffix = True
        for suffix in ["company", "agency", "partner", "consultant", "developer", "designer", "firm", "service", "provider", "expert"]:
            if suffix in keyword_lower:
                needs_suffix = False
                break
                
        queries = []
        
        # 1. "looking for" templates
        if needs_suffix:
            queries.append(f"looking for {keyword_lower} company")
            queries.append(f"need {keyword_lower} company")
            queries.append(f"recommend {keyword_lower} company")
        else:
            queries.append(f"looking for {keyword_lower}")
            queries.append(f"need {keyword_lower}")
            queries.append(f"recommend {keyword_lower}")
            
        # 2. "seeking" and "recommendation" templates
        if "partner" not in keyword_lower:
            queries.append(f"seeking {keyword_lower} partner")
        else:
            queries.append(f"seeking {keyword_lower}")
            
        if "recommendation" not in keyword_lower:
            queries.append(f"{keyword_lower} recommendation")
            
        # 3. Special rule for development keywords
        if "development" in keyword_lower:
            base = keyword_lower.replace("software", "").strip()
            # If it was just "software development" or "development"
            if base == "development" or not base:
                base = "web development"
            else:
                if "development" not in base:
                    base = f"{base} development"
            queries.append(f"{base} agency recommendation")
            
        # Ensure unique and cleaned results
        result = [q.strip() for q in queries if q.strip()]
        return list(set(result))

