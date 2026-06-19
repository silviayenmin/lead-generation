import os

from groq import Groq

client = Groq(
    api_key=os.getenv(
        "GROQ_API_KEY"
    )
)


def analyze_lead(title, snippet):
    # Load the prompt template from the file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    prompt_path = os.path.join(base_dir, "prompts", "lead_prompt.txt")
    with open(prompt_path, "r", encoding="utf-8") as f:
        template = f.read()

    prompt = template.format(title=title, snippet=snippet)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    return response.choices[0].message.content


def generate_pitch(lead, agency_name="Silvia Team", agency_info="premier design & development services", tone="Short & Conversational"):
    author = lead.get("authorName") or "there"
    company = lead.get("companyName") or ""
    need = lead.get("needDescription") or ""
    service = lead.get("serviceRequired") or ""
    url = lead.get("sourceUrl") or ""
    
    if "facebook.com" in url:
        platform_name = "Facebook"
    elif "twitter.com" in url or "x.com" in url:
        platform_name = "Twitter/X"
    elif "reddit.com" in url:
        platform_name = "Reddit"
    else:
        platform_name = "LinkedIn"
    
    prompt = f"""
You are an expert B2B Copywriter and Sales Outreach Specialist.

Draft a highly personalized, compelling outreach email to a potential client based on their {platform_name} post details.

Sender Details:
- Agency/Sender Name: {agency_name}
- Services/Specialties Offered: {agency_info}
- Target Email Tone: {tone}

Recipient Details:
- Author: {author}
- Company: {company}
- Need/Problem they posted about: {need}
- Service Required: {service}

Instructions:
1. Keep the email style matching the target tone: '{tone}'.
   - If 'Short & Conversational': Keep it extremely concise (under 120 words), conversational, direct, and easy-going.
   - If 'Professional & Formal': Use corporate formatting, polite vocabulary, and structured paragraphs.
   - If 'Value Pitch (Free Audit)': Focus on the value prop of {agency_info}, offering high value or offering a free audit/consultation.
2. The subject line should be catchy, natural, and contextually relevant (not generic).
3. Reference their {platform_name} post directly to build immediate trust.
4. Pitch how {agency_name} solves their exact need using the services: {agency_info}.
5. Conclude with a low-friction Call to Action (CTA) like proposing a 10-minute chat.
6. Return the subject line at the top, followed by the email body. Do not include bracketed placeholders like "[Your Name]" or "[Agency Name]" in the body—fully fill them using {agency_name}. Use {agency_name} in the signature.

Format:
Subject: [Subject Line]

[Email Body]
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.7
    )

    return response.choices[0].message.content