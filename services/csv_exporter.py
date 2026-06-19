import csv

def export_to_csv(leads):
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
        "output/leads.csv",
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