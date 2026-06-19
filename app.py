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
from services.ai_agent import analyze_lead
from services.csv_exporter import export_to_csv


def clean_json_response(response_text):
    """
    Extract JSON block from AI response.
    """
    text = response_text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end+1]
    return text


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

        ai_output = analyze_lead(
            title,
            snippet
        )

        print("\n====================")
        print("AI OUTPUT")
        print(ai_output)
        print("====================")

        ai_output = clean_json_response(
            ai_output
        )

        lead = json.loads(
            ai_output
        )

        lead["sourceUrl"] = source_url

        final_leads.append(
            lead
        )

    except Exception as err:

        print(
            f"\nJSON Error: {err}"
        )

        print(
            f"Raw Response:\n{ai_output}"
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