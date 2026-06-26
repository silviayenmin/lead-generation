import os
import sys
import time
from dotenv import load_dotenv

# Add project root to python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from search import get_adapter
from qualification.lead_classifier import classify_lead_intent
from qualification.lead_scoring import calculate_lead_score

def run_live_extraction():
    print("=" * 60)
    print("RUNNING LIVE LEAD EXTRACTION ACROSS PLATFORMS")
    print("=" * 60)
    
    platforms = ["linkedin", "facebook", "twitter"]
    keyword = "marketing agency"
    
    extraction_results = {}
    
    for plat in platforms:
        print(f"\n[Extraction] Fetching raw leads from platform: {plat.upper()}...")
        adapter = get_adapter(plat)
        
        start_time = time.time()
        try:
            # Query Serper search
            results = adapter.search(keyword, timeframe="qdr:m3")
            duration = time.time() - start_time
            print(f"  -> Found {len(results)} raw posts/threads in {duration:.2f} seconds.")
            extraction_results[plat] = {
                "count": len(results),
                "status": "Success",
                "sample": results[:2] if results else []
            }
        except Exception as e:
            print(f"  -> Error executing extraction on {plat}: {e}")
            extraction_results[plat] = {
                "count": 0,
                "status": f"Error: {e}",
                "sample": []
            }
            
    return extraction_results

def run_accuracy_benchmark():
    print("\n" + "=" * 60)
    print("RUNNING AI CLASSIFIER ACCURACY BENCHMARK")
    print("=" * 60)
    
    # 10 test validation items representing different intent profiles with ground truth
    # Ground Truth: True = High/Medium intent (Lead), False = Low/None intent (Junk)
    validation_set = [
        {
            "title": "Looking for web development agency to design our e-commerce site",
            "snippet": "We need a professional Shopify agency or freelancer to build our store from scratch. Budget: $5000. Send portfolio.",
            "ground_truth": True
        },
        {
            "title": "Hiring remote React developer immediately",
            "snippet": "Our startup is hiring a frontend React engineer for a 6-month contract. Experience with Tailwind and NextJS is required.",
            "ground_truth": True
        },
        {
            "title": "Recommend a good SEO consultant?",
            "snippet": "Does anyone know a reliable freelance SEO consultant who can audit our B2B SaaS website? Need help ranking for key terms.",
            "ground_truth": True
        },
        {
            "title": "Need a copywriter for email marketing campaign",
            "snippet": "Looking for someone to write 10 emails for our product launch sequence. Send rates and samples.",
            "ground_truth": True
        },
        {
            "title": "Hiring manager role open at Acme Corp",
            "snippet": "We are expanding our product team. Looking for a full-time Product Manager to work from our Austin office. Apply on site.",
            "ground_truth": True
        },
        {
            "title": "Just launched my portfolio website!",
            "snippet": "Check out my new portfolio built using Svelte. Let me know what you think about the dark mode transitions!",
            "ground_truth": False
        },
        {
            "title": "How to optimize WordPress speed?",
            "snippet": "What are your favorite plugins to optimize page load speeds? Currently using WP Rocket but looking for other free options.",
            "ground_truth": False
        },
        {
            "title": "5 tips for landing a freelance web design client",
            "snippet": "Here is my newsletter thread on how I closed 3 clients last month by cold emailing. Subscribe to read the full guide.",
            "ground_truth": False
        },
        {
            "title": "Remote work is the future",
            "snippet": "A short discussion on why hybrid office environments fail and remote-first operations succeed. Join the debate.",
            "ground_truth": False
        },
        {
            "title": "Sharing my Figma templates for landing pages",
            "snippet": "I designed 5 landing page layouts for SaaS businesses. You can download the file here for free.",
            "ground_truth": False
        }
    ]

    tp, fp, tn, fn = 0, 0, 0, 0
    results_log = []

    for idx, item in enumerate(validation_set):
        print(f"Evaluating validation case {idx+1}/{len(validation_set)}: '{item['title'][:40]}...'")
        
        try:
            # Classify
            classified = classify_lead_intent(item["title"], item["snippet"])
            scored = calculate_lead_score(classified)
            
            # Category decision: High/Medium = Lead, Low = Junk
            category = scored.get("leadCategory", "Low Intent")
            predicted_is_lead = category in ["High Intent", "Medium Intent"]
            
            # Compare with ground truth
            actual_is_lead = item["ground_truth"]
            
            if actual_is_lead and predicted_is_lead:
                tp += 1
                result_status = "True Positive (Correct Lead)"
            elif not actual_is_lead and predicted_is_lead:
                fp += 1
                result_status = "False Positive (Junk classified as Lead)"
            elif not actual_is_lead and not predicted_is_lead:
                tn += 1
                result_status = "True Negative (Correct Junk)"
            else:
                fn += 1
                result_status = "False Negative (Lead classified as Junk)"
                
            results_log.append({
                "title": item["title"],
                "ground_truth": "Lead" if actual_is_lead else "Junk",
                "predicted_category": category,
                "score": scored.get("leadScore", 0),
                "status": result_status
            })
            
            # Simple sleep to prevent rapid API hits
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Error evaluating test case {idx+1}: {e}")
            
    # Calculate stats
    total = len(validation_set)
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    
    print("\n" + "=" * 60)
    print("ACCURACY BENCHMARK STATISTICS")
    print("=" * 60)
    print(f"True Positives (TP): {tp}")
    print(f"False Positives (FP): {fp}")
    print(f"True Negatives (TN): {tn}")
    print(f"False Negatives (FN): {fn}")
    print("-" * 60)
    print(f"Overall Accuracy:  {accuracy*100:.1f}%")
    print(f"Precision:         {precision*100:.1f}%")
    print(f"Recall:            {recall*100:.1f}%")
    print("=" * 60)
    
    return {
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "accuracy": accuracy, "precision": precision, "recall": recall,
        "logs": results_log
    }

if __name__ == "__main__":
    ext_results = run_live_extraction()
    acc_results = run_accuracy_benchmark()
    
    # Save results summary file for compilation
    import json
    report_data = {
        "extraction": ext_results,
        "accuracy": {
            "tp": acc_results["tp"],
            "fp": acc_results["fp"],
            "tn": acc_results["tn"],
            "fn": acc_results["fn"],
            "accuracy": acc_results["accuracy"],
            "precision": acc_results["precision"],
            "recall": acc_results["recall"],
            "logs": acc_results["logs"]
        }
    }
    with open(os.path.join(PROJECT_ROOT, "scratch", "last_benchmark_run.json"), "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=4)
    print(f"\nReport raw data compiled and saved to scratch/last_benchmark_run.json")
