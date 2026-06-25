import os
import json

class ChatCompletions:
    def __init__(self, client_instance):
        self.client_instance = client_instance

    def create(self, model=None, messages=None, response_format=None, temperature=0.7):
        return self.client_instance.create_completion(
            messages=messages,
            response_format=response_format,
            temperature=temperature
        )

class Chat:
    def __init__(self, client_instance):
        self.completions = ChatCompletions(client_instance)

class DynamicLLMClient:
    def __init__(self):
        self.chat = Chat(self)

    def get_config(self):
        config_path = "config.json"
        config = {
            "provider": "groq",
            "model": "llama-3.3-70b-versatile",
            "openai_api_key": "",
            "groq_api_key": "",
            "ollama_host": "http://localhost:11434"
        }
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    user_config = json.load(f)
                    config.update(user_config)
            except Exception as e:
                print(f"[LLM Client] Error loading config.json: {e}")
        return config

    def create_completion(self, messages, response_format=None, temperature=0.7):
        config = self.get_config()
        provider = config.get("provider", "groq").lower().strip()
        model = config.get("model", "")
        
        # Load API keys
        groq_key = config.get("groq_api_key") or os.getenv("GROQ_API_KEY")
        openai_key = config.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
        ollama_host = config.get("ollama_host") or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        
        if provider == "openai":
            import openai
            if not model:
                model = "gpt-4o-mini"
            api_client = openai.OpenAI(api_key=openai_key)
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature
            }
            if response_format:
                kwargs["response_format"] = response_format
            return api_client.chat.completions.create(**kwargs)
            
        elif provider == "ollama":
            import openai
            if not model:
                model = "llama3"
            api_client = openai.OpenAI(
                base_url=f"{ollama_host.rstrip('/')}/v1",
                api_key="ollama"
            )
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature
            }
            if response_format:
                kwargs["response_format"] = response_format
            return api_client.chat.completions.create(**kwargs)
            
        else: # Default: groq
            from groq import Groq
            if not model:
                model = "llama-3.3-70b-versatile"
            api_client = Groq(api_key=groq_key)
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature
            }
            if response_format:
                kwargs["response_format"] = response_format
            return api_client.chat.completions.create(**kwargs)

client = DynamicLLMClient()




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