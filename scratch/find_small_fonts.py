import re
import sys

# Reconfigure stdout for utf-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

html_path = "d:/Project/Silvia/leadgeneration_github/lead-generation/static/index.html"
css_path = "d:/Project/Silvia/leadgeneration_github/lead-generation/static/style.css"

out_path = "d:/Project/Silvia/leadgeneration_github/lead-generation/scratch/small_fonts_report.txt"

with open(out_path, "w", encoding="utf-8") as out:
    out.write("--- INLINE FONT SIZES IN HTML ---\n")
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Find all font-size style rules in HTML
    html_matches = re.finditer(r'font-size:\s*([0-9.]+)(px|rem|em)', html_content, re.I)
    for m in html_matches:
        val = float(m.group(1))
        unit = m.group(2).lower()
        
        if (unit == "px" and val < 11.0) or (unit in ["rem", "em"] and val < 0.82):
            line_num = html_content.count('\n', 0, m.start()) + 1
            snippet = html_content[max(0, m.start()-50):min(len(html_content), m.end()+50)].replace("\n", " ").strip()
            out.write(f"Line {line_num}: Found {m.group(0)} | snippet: ... {snippet} ...\n")

    out.write("\n--- FONT SIZES IN STYLE.CSS ---\n")
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()

    css_matches = re.finditer(r'font-size:\s*([0-9.]+)(px|rem|em)', css_content, re.I)
    for m in css_matches:
        val = float(m.group(1))
        unit = m.group(2).lower()
        
        if (unit == "px" and val < 11.0) or (unit in ["rem", "em"] and val < 0.82):
            line_num = css_content.count('\n', 0, m.start()) + 1
            snippet = css_content[max(0, m.start()-50):min(len(css_content), m.end()+50)].replace("\n", " ").strip()
            out.write(f"Line {line_num}: Found {m.group(0)} | snippet: ... {snippet} ...\n")

print("Scanned. Output written to scratch/small_fonts_report.txt")
