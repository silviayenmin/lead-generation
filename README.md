# Silvia Lead Generation Platform

Silvia is a B2B SaaS platform that scans and discovers buying signals on LinkedIn, Facebook, Twitter, and Reddit, qualifies them using Llama 3.3 models via Groq, and generates highly personalized outreach pitches.

## Setup Steps

### 1. Configure Environment Variables
Create a `.env` file in the root directory and add the following variables:
```
GROQ_API_KEY=your_groq_key_here
SERPER_API_KEY=your_serper_key_here
APP_SECRET_KEY=your_app_secret_key_here
```

### 2. Install Dependencies
Install all required libraries using pip:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Launch the FastAPI development server:
```bash
uvicorn server:app --reload
```
Once started, you can access the portal at [http://127.0.0.1:8000](http://127.0.0.1:8000).
