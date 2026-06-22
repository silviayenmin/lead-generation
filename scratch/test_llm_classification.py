import os
from dotenv import load_dotenv
import sys

sys.path.insert(0, "d:\\Project\\Silvia\\leadgeneration_github\\lead-generation")
load_dotenv("d:\\Project\\Silvia\\leadgeneration_github\\lead-generation\\.env")

from qualification.lead_classifier import classify_lead_intent
from qualification.lead_scoring import calculate_lead_score

# Let's test classifying a high-intent title and snippet
title = "Looking for a WordPress web developer to build our business site"
snippet = "Our company is looking for a reliable WordPress developer or agency to design and build our new corporate website. Must have a strong portfolio."

print("Running LLM intent classification...")
res = classify_lead_intent(title, snippet)
print("\nLLM Response JSON:")
import json
print(json.dumps(res, indent=2))

print("\nRunning lead scoring on the response:")
scored = calculate_lead_score(res)
print(json.dumps(scored, indent=2))
