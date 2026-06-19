class BaseEnricher:
    def enrich(self, author_name: str, company_name: str) -> dict:
        raise NotImplementedError

class HunterEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        # Placeholder for real Hunter integration
        return {}

class ProspeoEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        # Placeholder for real Prospeo integration
        return {}

class ApolloEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        # Placeholder for real Apollo integration
        return {}

class ClearbitEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        # Placeholder for real Clearbit integration
        return {}

class DropcontactEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        # Placeholder for real Dropcontact integration
        return {}

class EmailGuessingEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        """
        Guesses the email using typical business email patterns based on name and company.
        """
        if not author_name or author_name.lower() == "unknown" or not company_name or company_name.lower() in ["unknown", "none", ""]:
            email = f"hello@{company_name.lower().replace(' ', '')}.com" if (company_name and company_name.lower() not in ["unknown", "none", ""]) else "outreach@decisionmaker.com"
        else:
            # Clean company domain name
            domain = company_name.lower().split()[0].replace(",", "").replace(".", "").replace("&", "")
            if not domain or len(domain) < 2:
                domain = "company"
            domain = f"{domain}.com"
            
            # Parse author names
            parts = author_name.split()
            first_name = parts[0].lower() if len(parts) > 0 else "contact"
            last_name = parts[1].lower() if len(parts) > 1 else ""
            
            if last_name:
                email = f"{first_name}.{last_name}@{domain}"
            else:
                email = f"{first_name}@{domain}"
                
        return {
            "email": email,
            "contactSource": "guessed",
            "contactConfidence": "low"
        }

class ContactEnrichmentManager:
    def __init__(self, provider: str = "guessing"):
        self.provider = provider.lower().strip()
        
    def enrich(self, author_name: str, company_name: str) -> dict:
        if self.provider == "hunter":
            res = HunterEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "prospeo":
            res = ProspeoEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "apollo":
            res = ApolloEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "clearbit":
            res = ClearbitEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "dropcontact":
            res = DropcontactEnricher().enrich(author_name, company_name)
            if res: return res
            
        # Fallback to email guessing
        return EmailGuessingEnricher().enrich(author_name, company_name)
