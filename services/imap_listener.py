import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr
import datetime

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
            
    # Clean whitespace and return snippet
    cleaned = " ".join(body.strip().split())
    if len(cleaned) > 250:
        return cleaned[:250] + "..."
    return cleaned or "(No plain text content)"

def sync_user_replies(user_email: str, config: dict, leads: dict) -> tuple:
    """
    Connects to the user's IMAP mailbox, retrieves the latest 50 emails,
    matches sender addresses against lead contact info, updates statuses to 'Replied',
    and stores email snippets in lead details.
    
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
        
        # Search for all messages in the inbox
        status, data = mail.search(None, "ALL")
        if status != "OK":
            return 0, leads
            
        mail_ids = data[0].split()
        if not mail_ids:
            return 0, leads
            
        # Inspect the latest 50 messages to keep performance high
        latest_ids = mail_ids[-50:]
        
        for mid in reversed(latest_ids):
            # Fetch message headers and body parts
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
            
            if not from_addr:
                continue
                
            # Find a matching lead
            matched_url = None
            for url, lead in updated_leads.items():
                lead_email = (lead.get("contactInfo") or "").strip().lower()
                if lead_email and lead_email == from_addr:
                    matched_url = url
                    break
                    
            if matched_url:
                lead = updated_leads[matched_url]
                
                # Check for existing reply to prevent duplicates
                replies = lead.get("replies", [])
                
                # Simple duplicate check: match snippet and timestamp
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
        # Return what we have so far
        
    return new_replies_count, updated_leads
