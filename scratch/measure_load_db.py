import time
import os
from dotenv import load_dotenv
from crm.lead_database import load_db

load_dotenv()

start_time = time.time()
print("Starting load_db...")
leads = load_db("silvia.yenmin@gmail.com")
end_time = time.time()

print(f"load_db took {end_time - start_time:.4f} seconds.")
print(f"Loaded {len(leads)} leads.")
