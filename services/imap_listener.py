import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr
import datetime
import re

def decode_mime_header(header_value):
    if not header_value:
        return ""
    decoded_fragments = decode_header(header_value)
    result_parts = []
    for fragment, encoding in decoded_fragments:
        if isinstance(fragment, bytes):
            try:
                result_parts.append(fragment.decode(encoding or "utf-8", errors="ignore"))
            except Exception:
                result_parts.append(fragment.decode("utf-8", errors="ignore"))
        else:
            result_parts.append(str(fragment))
    return "".join(result_parts)

def strip_reply_history(body: str) -> str:
    if not body:
        return ""
        
    # Check for inline reply quote header "On ... wrote:"
    # This matches "On <date/time/sender> wrote:" or common translations, supporting line wraps/newlines
    match = re.search(r'\bOn\s+[\s\S]{1,250}?(?:\d{4}|\d{2})[\s\S]{1,250}?(?:wrote|schrieb|a\s+écrit|escribió|writes):', body, re.IGNORECASE)
    if match:
        body = body[:match.start()]
        
    # Check common email thread separators
    for separator in ["-----Original Message-----", "--- Original Message ---", "________________________________"]:
        if separator in body:
            body = body.split(separator)[0]
            
    lines = body.splitlines()
    cleaned_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # If line is "From:" and the following lines contain other email headers, it's a quote block
        if stripped.lower().startswith("from:") and i < len(lines) - 2:
            next_lines = [l.strip().lower() for l in lines[i+1:i+4]]
            if any(l.startswith("to:") for l in next_lines) and any(l.startswith("subject:") or l.startswith("sent:") or l.startswith("date:") for l in next_lines):
                break
        # If line starts with standard email quote prefix '>'
        if stripped.startswith(">"):
            break
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines).strip()

def get_email_body_snippet(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                        break
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="ignore")
        except Exception:
            pass
            
    # Strip quoted email history
    body = strip_reply_history(body)
    
    # Clean whitespace and return snippet
    cleaned = " ".join(body.strip().split())
    if len(cleaned) > 250:
        return cleaned[:250] + "..."
    return cleaned or "(No plain text content)"

def normalize_subject(subj: str) -> str:
    if not subj:
        return ""
    s = subj.lower().strip()
    while True:
        found = False
        for prefix in ["re:", "fwd:", "fw:", "reply:", "aw:", "antwort:"]:
            if s.startswith(prefix):
                s = s[len(prefix):].strip()
                found = True
        if not found:
            break
    # strip spaces and symbols to compare alphanumeric chars only
    return "".join(c for c in s if c.isalnum())

def sync_user_replies(user_email: str, config: dict, leads: dict) -> tuple:
    """
    Connects to the user's IMAP mailbox, searches for messages sent by each lead's
    configured contact email, updates status to 'Replied', and stores email snippets.
    
    Returns (new_replies_count, updated_leads_dict)
    """
    server = config.get("imap_server", "imap.gmail.com")
    port_str = config.get("imap_port", "993")
    try:
        port = int(port_str)
    except ValueError:
        port = 993
        
    username = config.get("imap_email")
    password = config.get("imap_password")
    
    if not username or not password:
        return 0, leads
        
    new_replies_count = 0
    updated_leads = dict(leads)
    
    try:
        # Connect with SSL timeout of 10s
        mail = imaplib.IMAP4_SSL(server, port, timeout=10)
        mail.login(username, password)
        mail.select("INBOX")
        
        # Iterate over leads to perform targeted searches
        for url, lead in updated_leads.items():
            lead_email = (lead.get("contactInfo") or "").strip().lower()
            if not lead_email:
                continue
                
            # Get outreach subject from draftEmail
            draft_text = lead.get("draftEmail", "")
            outreach_subject = ""
            for line in draft_text.split("\n"):
                if line.lower().startswith("subject:"):
                    outreach_subject = line[8:].strip()
                    break
            
            norm_outreach = normalize_subject(outreach_subject)
            
            # Clean and filter existing replies
            if "replies" in lead:
                filtered_existing = []
                for r in lead["replies"]:
                    if "snippet" in r:
                        r["snippet"] = strip_reply_history(r["snippet"])
                    
                    if norm_outreach:
                        if normalize_subject(r.get("subject", "")) == norm_outreach:
                            filtered_existing.append(r)
                    else:
                        filtered_existing.append(r)
                lead["replies"] = filtered_existing
                # If all replies are removed and status was Replied, revert to Emailed
                if not filtered_existing and lead.get("crmStatus") == "Replied":
                    lead["crmStatus"] = "Emailed"

            # Search specifically for emails sent by this lead's email address
            try:
                # If lead_email is plain ASCII, use standard search as it is most compatible.
                lead_email.encode('ascii')
                status, data = mail.search(None, f'FROM "{lead_email}"')
            except UnicodeEncodeError:
                # Otherwise, use UTF-8 search with literal to handle non-ASCII characters.
                try:
                    mail.literal = lead_email.encode('utf-8')
                    status, data = mail.search('UTF-8', 'FROM')
                except Exception as search_err:
                    print(f"Failed UTF-8 IMAP search for {lead_email}: {search_err}")
                    continue
            except Exception as search_err:
                print(f"Failed IMAP search for {lead_email}: {search_err}")
                continue
                
            if status != "OK" or not data or not data[0]:
                continue
                
            mail_ids = data[0].split()
            if not mail_ids:
                continue
                
            # Inspect the latest 5 messages from this specific lead to check for new replies
            for mid in reversed(mail_ids[-5:]):
                res_status, msg_data = mail.fetch(mid, "(RFC822)")
                if res_status != "OK" or not msg_data:
                    continue
                    
                raw_email = msg_data[0][1]
                if not raw_email:
                    continue
                    
                msg = email.message_from_bytes(raw_email)
                
                # Parse headers
                from_header = decode_mime_header(msg.get("From"))
                subject_header = decode_mime_header(msg.get("Subject"))
                date_header = decode_mime_header(msg.get("Date"))
                
                _, from_addr = parseaddr(from_header)
                from_addr = from_addr.strip().lower()
                
                # Ensure the address matches exactly (IMAP search is a substring search)
                if from_addr != lead_email:
                    continue
                    
                # If we have an outreach subject, ensure the email subject matches it
                if norm_outreach:
                    norm_msg_subject = normalize_subject(subject_header)
                    if norm_msg_subject != norm_outreach:
                        continue
                
                # Check for existing reply to prevent duplicates
                replies = lead.get("replies", [])
                snippet = get_email_body_snippet(msg)
                
                is_duplicate = False
                for r in replies:
                    if r.get("date") == date_header or r.get("snippet") == snippet:
                        is_duplicate = True
                        break
                        
                if not is_duplicate:
                    reply_entry = {
                        "from": from_header,
                        "from_email": from_addr,
                        "subject": subject_header,
                        "date": date_header,
                        "snippet": snippet
                    }
                    
                    if "replies" not in lead:
                        lead["replies"] = []
                    lead["replies"].append(reply_entry)
                    
                    # Update pipeline stage to Replied
                    lead["crmStatus"] = "Replied"
                    new_replies_count += 1
                    
        mail.logout()
        
    except Exception as e:
        print(f"Error checking email replies via IMAP: {e}")
        
    return new_replies_count, updated_leads
        
    return new_replies_count, updated_leads
