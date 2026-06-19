import os
import json
import sys

# Reconfigure stdout to use utf-8 to prevent console print encoding errors on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from services.serper import search_leads
from qualification.lead_classifier import classify_lead_intent
from services.csv_exporter import export_to_csv


# -------------------------
# User Input
# -------------------------

keyword = input(
    "Enter Keyword: "
)

# Better LinkedIn discovery query
query = (
    f'site:linkedin.com/posts {keyword}'
)

print("\nSearching...")

# Filter results for the past 3 months (not more than 90 days)
results = search_leads(query, tbs="qdr:m3")

print(f"\nResults Count: {len(results)}")

final_leads = []

# -------------------------
# Process Results
# -------------------------

for result in results[:10]:

    title = result.get(
        "title",
        ""
    )

    snippet = result.get(
        "snippet",
        ""
    )

    source_url = result.get(
        "link",
        ""
    )

    print(f"\nProcessing: {title}")

    try:

        lead = classify_lead_intent(
            title,
            snippet
        )

        print("\n====================")
        print("AI OUTPUT")
        print(json.dumps(lead, indent=2))
        print("====================")

        lead["sourceUrl"] = source_url

        final_leads.append(
            lead
        )

    except Exception as err:

        print(
            f"\nError: {err}"
        )


# -------------------------
# Export CSV
# -------------------------

print(
    f"\nQualified Leads Found: {len(final_leads)}"
)

if final_leads:

    export_to_csv(
        final_leads
    )

    print(
        "\nCSV Generated Successfully"
    )

else:

    print(
        "\nNo valid leads found."
    )