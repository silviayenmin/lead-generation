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
            "active_provider": "groq",
            "workspace_dir": "output",
            "providers": {
                "groq": {
                    "provider_type": "groq",
                    "model": "llama-3.3-70b-versatile",
                    "temperature": 0.7
                },
                "openai": {
                    "provider_type": "openai",
                    "model": "gpt-4o",
                    "temperature": 0
                },
                "ollama_llama": {
                    "provider_type": "ollama",
                    "model": "llama3.1:8b",
                    "base_url": "http://localhost:11434",
                    "temperature": 0
                },
                "ollama_qwen": {
                    "provider_type": "ollama",
                    "model": "qwen2.5-coder:14b",
                    "base_url": "http://localhost:11434",
                    "temperature": 0
                },
                "ollama_cloud": {
                    "provider_type": "ollama",
                    "model": "qwen3-coder:480b-cloud",
                    "base_url": "http://localhost:11434",
                    "temperature": 0
                },
                "anthropic": {
                    "provider_type": "anthropic",
                    "model": "claude-3-5-sonnet-20240620",
                    "temperature": 0
                }
            },
            "memory": {
                "type": "buffer",
                "max_token_limit": 2000
            }
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
        active_provider_name = config.get("active_provider", "groq")
        providers = config.get("providers", {})
        
        provider_config = providers.get(active_provider_name, {})
        provider_type = provider_config.get("provider_type", "groq").lower().strip()
        model = provider_config.get("model", "")
        base_url = provider_config.get("base_url")
        temp = provider_config.get("temperature", temperature)
        
        if provider_type == "openai":
            import openai
            openai_key = os.getenv("OPENAI_API_KEY")
            if not model:
                model = "gpt-4o-mini"
            api_client = openai.OpenAI(api_key=openai_key)
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temp
            }
            if response_format:
                kwargs["response_format"] = response_format
            return api_client.chat.completions.create(**kwargs)
            
        elif provider_type == "ollama":
            import openai
            if not model:
                model = "llama3"
            host = base_url or os.getenv("OLLAMA_HOST", "http://localhost:11434")
            api_client = openai.OpenAI(
                base_url=f"{host.rstrip('/')}/v1",
                api_key="ollama"
            )
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temp
            }
            if response_format:
                kwargs["response_format"] = response_format
            return api_client.chat.completions.create(**kwargs)

        elif provider_type == "anthropic":
            import anthropic
            anthropic_key = os.getenv("ANTHROPIC_API_KEY")
            if not model:
                model = "claude-3-5-sonnet-20240620"
            api_client = anthropic.Anthropic(api_key=anthropic_key)
            
            # Format messages for Anthropic
            system_prompt = ""
            filtered_messages = []
            for msg in messages:
                if msg.get("role") == "system":
                    system_prompt += msg.get("content", "") + "\n"
                else:
                    filtered_messages.append(msg)
            
            kwargs = {
                "model": model,
                "messages": filtered_messages,
                "temperature": temp,
                "max_tokens": 1024
            }
            if system_prompt:
                kwargs["system"] = system_prompt.strip()

            message = api_client.messages.create(**kwargs)

            # Mock OpenAI response wrapper
            class MockMessage:
                def __init__(self, text):
                    self.content = text
            class MockChoice:
                def __init__(self, text):
                    self.message = MockMessage(text)
            class MockResponse:
                def __init__(self, text):
                    self.choices = [MockChoice(text)]
            
            return MockResponse(message.content[0].text)
            
        else: # Default: groq
            import time
            from groq import Groq
            groq_key = os.getenv("GROQ_API_KEY")
            if not model:
                model = "llama-3.3-70b-versatile"
            api_client = Groq(api_key=groq_key)
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temp
            }
            if response_format:
                kwargs["response_format"] = response_format
                
            for attempt in range(4):
                try:
                    return api_client.chat.completions.create(**kwargs)
                except Exception as e:
                    if attempt < 3:
                        wait_time = (attempt + 1) * 2
                        print(f"[LLM Client] Groq API call failed: {e}. Retrying in {wait_time}s (Attempt {attempt + 1}/3)...")
                        time.sleep(wait_time)
                    else:
                        raise e

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
        
    search_type = lead.get("search_type", "sales")
    if str(search_type).lower().strip() == "recruiter":
        prompt = f"""
You are an expert HR Recruiter and Talent Acquisition Specialist.

Draft a highly personalized, warm, and compelling cold recruiting outreach email to a candidate based on their {platform_name} profile and post details.

Sender Details:
- Recruiter/Company Name: {agency_name}
- Job Description / Pitch Info: {agency_info}
- Target Email Tone: {tone}

Recipient Details:
- Candidate Name: {author}
- Current/Previous Company or School: {company}
- Candidate Skills: {lead.get("skills", "")}
- Candidate Experience Level: {lead.get("experienceLevel", "")}
- Candidate Work Preference: {lead.get("workPreference", "")}
- Candidate location: {lead.get("location", "")}
- Post snippet describing their job hunt: {need}

Instructions:
1. Keep the email style matching the target tone: '{tone}'.
   - If 'Short & Conversational': Keep it extremely warm, brief (under 120 words), conversational, direct, and welcoming.
   - If 'Professional & Formal': Use corporate formatting, polite vocabulary, and structured paragraphs.
   - If 'Value Pitch (Free Audit)': Focus on the career growth, culture, and projects offered by {agency_name}, proposing a quick alignment call.
2. The subject line should be catchy, natural, and candidate-centric (e.g., "Exciting Role at [Company] / Saw your post", "Software Engineer opportunity at [Company]").
3. Reference their {platform_name} post or job hunt context directly to show genuine interest.
4. Pitch why {agency_name} is a great fit for them, matching their skills to the job info ({agency_info}).
5. Conclude with a low-friction Call to Action (CTA) like proposing a 10-minute introductory call.
6. Return the subject line at the top, followed by the email body. Do not include bracketed placeholders in the body—fully fill them using {agency_name}. Use {agency_name} in the signature.

Format:
Subject: [Subject Line]

[Email Body]
"""
    else:
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