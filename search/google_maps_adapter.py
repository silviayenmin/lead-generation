import os
import requests
import re
import time
import random
from urllib.parse import urljoin
from bs4 import BeautifulSoup

class GoogleMapsAdapter:
    def __init__(self):
        self.platform_name = "google_maps"

    def search(self, keyword: str, timeframe: str = "qdr:m3", match_type: str = "partial", location: str = None, industry: str = None, api_key: str = None) -> list:
        # Build search query
        query_parts = [keyword]
        if location and location.strip():
            query_parts.append(f"in {location.strip()}")
        query = " ".join(query_parts)

        print(f"[GoogleMapsAdapter] Searching query: {query}")
        
        # Check if Places API Key is present (either passed in or from environment)
        if not api_key or not api_key.strip():
            api_key = os.getenv("PLACES_API_KEY")
            
        if not api_key or not api_key.strip():
            # FALLBACK: Playwright maps scraper
            print("[GoogleMapsAdapter] No API Key provided or found in environment. Falling back to Playwright scraper...")
            
            raw_leads = self.scrape_playwright(keyword, location)
            
            # Convert raw_leads to standard results format
            results = []
            for lead in raw_leads:
                # Crawl website for email
                emails = []
                if lead.get("website"):
                    try:
                        emails = self.crawl_website_for_emails(lead["website"])
                    except Exception as crawl_err:
                        print(f"[GoogleMapsAdapter] Web crawler error for {lead['website']}: {crawl_err}")
                contact_info = emails[0] if emails else None
                
                title = f"{lead['name']} - {lead['category'] or 'Business'} in {location or 'Target Area'}"
                snippet = f"Address: {lead['address']}. Phone: {lead['phone'] or 'None'}. Rating: {lead['rating']} ({lead['reviews']} reviews). Website: {lead['website'] or 'None'}."
                
                result = {
                    "title": title,
                    "snippet": snippet,
                    "link": lead["mapsUrl"] or f"https://www.google.com/maps/search/{keyword}+{location}".replace(" ", "+"),
                    "meta_business_name": lead["name"],
                    "meta_address": lead["address"],
                    "meta_website": lead["website"],
                    "meta_contact_info": contact_info
                }
                results.append(result)
                
            return results

        search_url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id"
        }
        payload = {
            "textQuery": query
        }

        try:
            resp = requests.post(search_url, headers=headers, json=payload, timeout=15.0)
            if resp.status_code != 200:
                print(f"[GoogleMapsAdapter] Text Search Error {resp.status_code}: {resp.text}")
                return []
            
            search_data = resp.json()
            places = search_data.get("places", [])
            place_ids = [p["id"] for p in places if "id" in p]
            print(f"[GoogleMapsAdapter] Discovered {len(place_ids)} place IDs.")
        except Exception as e:
            print(f"[GoogleMapsAdapter] Failed to discover Place IDs: {e}")
            return []

        results = []
        # Restrict loop to process up to 10 or 15 items maximum to manage quotas/timeouts
        for pid in place_ids[:15]:
            # Step 2: Place Details - Enrich Each Business
            details_url = f"https://places.googleapis.com/v1/places/{pid}"
            details_headers = {
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "displayName,formattedAddress,websiteUri"
            }
            try:
                det_resp = requests.get(details_url, headers=details_headers, timeout=10.0)
                if det_resp.status_code != 200:
                    print(f"[GoogleMapsAdapter] Place Details Error {det_resp.status_code} for {pid}: {det_resp.text}")
                    continue
                
                det_data = det_resp.json()
                display_name = det_data.get("displayName", {}).get("text", "Unknown Business")
                formatted_address = det_data.get("formattedAddress", "Not Specified")
                website_uri = det_data.get("websiteUri")

                print(f"[GoogleMapsAdapter] Business: {display_name} | Website: {website_uri}")

                # Step 3: Email Crawler - Scrape the Website
                emails = []
                if website_uri:
                    try:
                        emails = self.crawl_website_for_emails(website_uri)
                    except Exception as crawl_err:
                        print(f"[GoogleMapsAdapter] Web crawler error for {website_uri}: {crawl_err}")
                
                contact_info = emails[0] if emails else None

                # Construct unified result mapping
                title = f"{display_name} - Business in {location or 'Target Area'}"
                snippet = f"Address: {formatted_address}. Website: {website_uri or 'None'}. Keyword Match: {keyword}."
                link = f"https://www.google.com/maps/place/?q=place_id:{pid}"
                
                result = {
                    "title": title,
                    "snippet": snippet,
                    "link": link,
                    "meta_business_name": display_name,
                    "meta_address": formatted_address,
                    "meta_website": website_uri,
                    "meta_contact_info": contact_info
                }
                results.append(result)
            except Exception as e:
                print(f"[GoogleMapsAdapter] Error processing details/crawling for {pid}: {e}")
                continue

        return results

    def scrape_playwright(self, business_type: str, location: str, max_results: int = 15) -> list:
        from playwright.sync_api import sync_playwright
        
        print(f"[GoogleMapsAdapter] Running Playwright scraper fallback for '{business_type}' in '{location}'")
        leads = []
        
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                ctx = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    locale="en-US"
                )
                page = ctx.new_page()
                
                # 1. Navigate to Maps search
                loc_clean = location.strip() if location else ""
                query = f"{business_type} in {loc_clean}".strip().replace(" ", "+")
                page.goto(f"https://www.google.com/maps/search/{query}", wait_until="domcontentloaded", timeout=30000)
                
                # Accept consent banners if present
                try:
                    btn = page.locator('button:has-text("Accept all"), button:has-text("Reject all")').first
                    if btn.is_visible(timeout=3000):
                        btn.click()
                        time.sleep(1.5)
                except Exception:
                    pass
                
                # 2. Wait for result panel
                PANEL = 'div[role="feed"]'
                try:
                    page.wait_for_selector(PANEL, timeout=15000)
                except Exception:
                    print("[GoogleMapsAdapter] Results panel not found. Google may have changed layout.")
                    browser.close()
                    return []
                
                # 3. Scroll to load listings
                print("[GoogleMapsAdapter] Scrolling to load results...")
                page.evaluate("""
                    async ({ sel, scrolls }) => {
                        const panel = document.querySelector(sel);
                        if (!panel) return;
                        for (let i = 0; i < scrolls; i++) {
                            panel.scrollBy(0, 600);
                            await new Promise(r => setTimeout(r, 800));
                        }
                    }
                """, {"sel": PANEL, "scrolls": 8})
                time.sleep(2)
                
                # 4. Collect listing URLs
                links = page.eval_on_selector_all(
                    'a[href*="/maps/place/"]',
                    f"""(els) => {{
                        const seen = new Set();
                        return els
                            .map(e => e.href)
                            .filter(h => h.includes('/maps/place/') && !seen.has(h) && seen.add(h))
                            .slice(0, {max_results});
                    }}"""
                )
                
                print(f"[GoogleMapsAdapter] Found {len(links)} listings. Extracting details...")
                
                # 5. Visit each listing
                for i, url in enumerate(links):
                    print(f"  [{i+1}/{len(links)}] {url[:80]}...")
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=20000)
                        time.sleep(1.8)
                        
                        # Extract lead details
                        lead = page.evaluate("""
                            () => {
                                const text = sel => document.querySelector(sel)?.textContent?.trim() || '';

                                const name     = text('h1.DUwDvf') || text('h1[class*="fontHeadlineLarge"]') || text('h1');
                                const category = text('button[jsaction*="category"]') || text('.DkEaL') || '';

                                const ratingEl  = document.querySelector('div.F7nice span[aria-hidden="true"]');
                                const rating    = ratingEl?.textContent?.trim() || '';
                                const reviewEl  = document.querySelector('div.F7nice span[aria-label*="review"]');
                                const reviews   = reviewEl?.textContent?.replace(/[()]/g,'').trim() || '';

                                const addrBtn   = document.querySelector('button[data-item-id="address"]');
                                const address   = addrBtn?.textContent?.trim() || '';

                                const phoneBtn  = document.querySelector('button[data-tooltip="Copy phone number"]');
                                const phone     = phoneBtn?.textContent?.trim() || '';

                                const webA      = document.querySelector('a[data-item-id="authority"]');
                                const website   = webA?.href || '';

                                const mapsUrl   = window.location.href;

                                return { name, category, address, phone, rating, reviews, website, mapsUrl };
                            }
                        """)
                        
                        if lead.get("name"):
                            # Clean string values from PUA (Private Use Area) icons to prevent cp1252 print errors on Windows
                            for key in ["name", "category", "address", "phone", "rating", "reviews", "website"]:
                                val = lead.get(key)
                                if isinstance(val, str):
                                    val_clean = "".join(c for c in val if not (0xe000 <= ord(c) <= 0xf8ff))
                                    lead[key] = val_clean.strip()
                            
                            leads.append(lead)
                            phone = lead["phone"] or "no phone"
                            safe_name = lead["name"].encode('ascii', errors='ignore').decode('ascii')
                            print(f"      -> {safe_name} | {phone}")
                            
                    except Exception as e:
                        print(f"      [WARN] Skipped ({str(e)[:60]})")
                        
                    time.sleep(1.0 + random.random() * 0.5)
                    
                browser.close()
        except Exception as ex:
            print(f"[GoogleMapsAdapter] Playwright scraping failed: {ex}")
            
        return leads

    def crawl_website_for_emails(self, url: str) -> list:
        print(f"[GoogleMapsAdapter] Crawling website: {url}")
        emails_found = set()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        try:
            resp = requests.get(url, headers=headers, timeout=8.0, allow_redirects=True)
            if resp.status_code != 200:
                return []
            
            html = resp.text
            soup = BeautifulSoup(html, "html.parser")
            
            # Extract from homepage
            self.extract_emails_from_text(html, emails_found)
            
            # Find candidate contact links to crawl (up to 3 links)
            candidate_links = []
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                text = a.get_text().lower()
                # Check if link points to contact, about, or support page
                if any(x in href.lower() or x in text for x in ["contact", "about", "support", "info", "help", "team"]):
                    full_url = urljoin(url, href)
                    # Stay within same domain to avoid external crawling
                    if self.get_domain(url) == self.get_domain(full_url):
                        if full_url not in candidate_links and full_url != url:
                            candidate_links.append(full_url)
            
            # Crawl up to 3 candidate links
            for link in candidate_links[:3]:
                try:
                    c_resp = requests.get(link, headers=headers, timeout=5.0)
                    if c_resp.status_code == 200:
                        self.extract_emails_from_text(c_resp.text, emails_found)
                except Exception:
                    pass
        except Exception as e:
            print(f"[GoogleMapsAdapter] Crawl failed for {url}: {e}")

        # Filter out common false positives or image files
        filtered_emails = []
        for email in emails_found:
            email_lower = email.lower()
            if not any(email_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]):
                filtered_emails.append(email)
                
        return filtered_emails

    def extract_emails_from_text(self, text: str, email_set: set):
        pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}"
        found = re.findall(pattern, text)
        for email in found:
            email_set.add(email)

    def get_domain(self, url: str) -> str:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc
