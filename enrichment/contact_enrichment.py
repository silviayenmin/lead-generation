import os
import requests
from crm.lead_database import is_empty_value

class BaseEnricher:
    def enrich(self, author_name: str, company_name: str) -> dict:
        raise NotImplementedError

class HunterEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        api_key = os.getenv("HUNTER_API_KEY")
        if not api_key:
            return {}
        try:
            parts = author_name.strip().split()
            first = parts[0] if parts else ""
            last = parts[1] if len(parts) > 1 else ""
            domain = company_name.lower().split()[0].replace(",","").replace(".","") + ".com"

            resp = requests.get(
                "https://api.hunter.io/v2/email-finder",
                params={
                    "domain": domain,
                    "first_name": first,
                    "last_name": last,
                    "api_key": api_key
                },
                timeout=8
            )
            data = resp.json()
            email = data.get("data", {}).get("email")
            score = data.get("data", {}).get("score", 0)
            if email:
                return {
                    "email": email,
                    "contactSource": "hunter",
                    "contactConfidence": "high" if score > 70 else "medium"
                }
        except Exception:
            pass
        return {}

class ApolloEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        api_key = os.getenv("APOLLO_API_KEY")
        if not api_key:
            return {}
        try:
            parts = author_name.strip().split()
            first = parts[0] if parts else ""
            last = parts[1] if len(parts) > 1 else ""

            json_payload = {
                "q_keywords": f"{first} {last}",
                "page": 1,
                "per_page": 1
            }
            if company_name and not is_empty_value(company_name) and company_name.lower() not in ["not specified", "unknown", "none"]:
                json_payload["q_organization_name"] = company_name

            resp = requests.post(
                "https://api.apollo.io/v1/contacts/search",
                json=json_payload,
                headers={
                    "x-api-key": api_key,
                    "Content-Type": "application/json"
                },
                timeout=8
            )
            data = resp.json()
            contacts = data.get("contacts", [])
            if contacts:
                email = contacts[0].get("email")
                if email and "@" in email:
                    org_name = contacts[0].get("organization_name") or contacts[0].get("organization", {}).get("name")
                    return {
                        "email": email,
                        "companyName": org_name,
                        "contactSource": "apollo",
                        "contactConfidence": "high"
                    }
        except Exception:
            pass
        return {}

class ProspeoEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        api_key = os.getenv("PROSPEO_API_KEY")
        if not api_key:
            return {}
        try:
            domain = ""
            if company_name and not is_empty_value(company_name) and company_name.lower() not in ["not specified", "unknown", "none"]:
                domain = company_name.lower().split()[0].replace(",","").replace(".","").replace("&","") + ".com"
                
            resp = requests.post(
                "https://api.prospeo.io/enrich-person",
                json={
                    "data": {
                        "full_name": author_name,
                        "company_website": domain
                    }
                },
                headers={
                    "X-KEY": api_key,
                    "Content-Type": "application/json"
                },
                timeout=8
            )
            data = resp.json()
            email = data.get("person", {}).get("email", {}).get("email")
            if email:
                org_name = data.get("person", {}).get("company", {}).get("name")
                return {
                    "email": email,
                    "companyName": org_name,
                    "contactSource": "prospeo",
                    "contactConfidence": "high"
                }
        except Exception:
            pass
        return {}

# Keep ClearbitEnricher and DropcontactEnricher as placeholders for now

class EmailGuessingEnricher(BaseEnricher):
    def enrich(self, author_name: str, company_name: str) -> dict:
        """
        Guesses the email using typical business email patterns based on name and company.
        """
        if is_empty_value(author_name) or is_empty_value(company_name):
            email = f"hello@{company_name.lower().replace(' ', '')}.com" if not is_empty_value(company_name) else "outreach@decisionmaker.com"
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
    def __init__(self, provider: str = "fallback_chain"):
        self.provider = provider.lower().strip()

    def enrich(self, author_name: str, company_name: str) -> dict:
        # New: fallback chain tries Hunter → Apollo → Prospeo → Guess
        if self.provider == "fallback_chain":
            for EnricherClass in [HunterEnricher, ApolloEnricher, ProspeoEnricher]:
                result = EnricherClass().enrich(author_name, company_name)
                if result:
                    return result
            return EmailGuessingEnricher().enrich(author_name, company_name)

        # Keep existing single-provider logic below unchanged
        elif self.provider == "hunter":
            res = HunterEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "prospeo":
            res = ProspeoEnricher().enrich(author_name, company_name)
            if res: return res
        elif self.provider == "apollo":
            res = ApolloEnricher().enrich(author_name, company_name)
            if res: return res

        return EmailGuessingEnricher().enrich(author_name, company_name)