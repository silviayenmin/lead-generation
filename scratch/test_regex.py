import sys
from dotenv import load_dotenv
import os

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from services.imap_listener import strip_reply_history

s = "yes, we can On Sat, Jun 20, 2026 at 12:04 PM Silvia Infantaa Grace D < silvia.yenmin@gmail.com> wrote: > Hey, I saw your Facebook post about ensuring IP ownership when working > with a dev agency. That's a crucial aspect to consider. At Silvia Team, ..."

result = strip_reply_history(s)
print(f"Original: {repr(s)}")
print(f"Cleaned:  {repr(result)}")
