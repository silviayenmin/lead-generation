import csv

def export_to_csv(leads, filepath="output/leads.csv"):
    fieldnames = [
        "authorName",
        "companyName",
        "buyingIntent",
        "serviceRequired",
        "industry",
        "location",
        "needDescription",
        "contactInfo",
        "confidenceScore",
        "leadStatus",
        "sourceUrl",
        "crmStatus",
        "draftEmail"
    ]

    with open(
        filepath,
        "w",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
            extrasaction="ignore"
        )

        writer.writeheader()
        writer.writerows(leads)