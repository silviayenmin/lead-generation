import re

html_path = "d:/Project/Silvia/leadgeneration_github/lead-generation/static/index.html"
css_path = "d:/Project/Silvia/leadgeneration_github/lead-generation/static/style.css"

def process_file(filepath):
    print(f"\nProcessing {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    modified_count = 0
    
    def replacer(match):
        nonlocal modified_count
        original = match.group(0)
        val = float(match.group(1))
        unit = match.group(2).lower()
        
        if unit in ["rem", "em"] and val < 0.82:
            new_val = 0.82
            new_str = f"font-size: {new_val}{unit}"
            print(f"  Changed '{original}' -> '{new_str}'")
            modified_count += 1
            return new_str
        elif unit == "px" and val < 11.0:
            new_val = 11.0
            new_str = f"font-size: 11px"
            print(f"  Changed '{original}' -> '{new_str}'")
            modified_count += 1
            return new_str
            
        return original

    # We match font-size declarations case-insensitively
    pattern = r'font-size:\s*([0-9.]+)(rem|px|em)'
    new_content = re.sub(pattern, replacer, content, flags=re.I)
    
    if modified_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Saved {filepath}. Made {modified_count} replacements.")
    else:
        print(f"No changes needed for {filepath}.")

process_file(html_path)
process_file(css_path)
