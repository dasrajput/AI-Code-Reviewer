import os
import json
import logging
import requests
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from together import Together
from config import config

# Set up logging for debug statements
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

class File(BaseModel):
    file: str
    raw_url: str

class ReviewRequest(BaseModel):
    files: list[File]

class CodeReviewAgent:
    def __init__(self):
        logger.info(f"Loaded config: {config}") # Add this line to see the full config

        github_token = config.get('github_token')
        if not github_token: # Check for None or empty string
            logger.error("github_token not set or is empty in config.py")
            raise ValueError("github_token not set or is empty in config.py")
        logger.info(f"GitHub Token (first 5 chars): {str(github_token)[:5]}...")

        api_key = config.get('api_key')
        if not api_key: # Check for None or empty string
            logger.error("api_key not set or is empty in config.py")
            raise ValueError("Together AI API Key not set or is empty in config.py")
        self.client = Together(api_key=api_key)
        logger.info(f"Together AI API Key (first 5 chars): {str(api_key)[:5]}...")

    def fetch_file_content(self, raw_url):
        try:
            logger.info(f"Fetching content from {raw_url}")
            headers = {
                'Authorization': f'token {config["github_token"]}',
                'Accept': 'application/vnd.github.v3+json'
            }
            response = requests.get(raw_url, headers=headers, timeout=10)
            response.raise_for_status()
            logger.info(f"Successfully fetched content from {raw_url}")
            return response.text
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching {raw_url}: {e}")
            return None

    def detect_language(self, filename, content):
        extensions = {'.cpp': 'cpp', '.h': 'cpp', '.py': 'python', '.java': 'java', '.js': 'javascript'}
        ext = os.path.splitext(filename)[1].lower()
        
        if ext in extensions:
            return extensions[ext]
        
        if 'def' in content or 'import' in content:
            return 'python'
        elif 'public class' in content:
            return 'java'
        elif 'function' in content or 'let' in content:
            return 'javascript'
        return 'cpp'

    def _get_cached_review(self, filename, raw_url):
        cache_dir = os.path.join('src', 'cache')
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"{os.path.basename(filename)}.json")
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                return json.load(f).get("review")
        return None

    def _cache_review(self, filename, review):
        cache_dir = os.path.join('src', 'cache')
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"{os.path.basename(filename)}.json")
        with open(cache_file, 'w') as f:
            json.dump({"review": review}, f)

    
    def generate_prompt(self, filename, content):
        safe_content = f"""```cpp
{content.replace('{', '{{').replace('}', '}}')}
```""" if self.detect_language(filename, content) == 'cpp' else content.replace('{', '{{').replace('}', '}}')
        language = self.detect_language(filename, content)

        prompt_templates = {
            'cpp': """You are a world-class C++ code reviewer with extensive experience in modern C++ standards (C++11 through C++23). Your task is to review the code from '{{filename}}':
{{content}}
Deliver a PERFECT, concise response consisting EXCLUSIVELY of 4-6 bullet points, each an actionable suggestion with at least one specific, complete, executable code snippet where applicable. For large codebases, focus on critical sections; note if partial review is needed. Cover ONLY these unique categories: code quality (readability, structure), potential bugs, modern C++ best practices (e.g., const correctness, C++20/23 features), performance optimizations, and general improvements. DO NOT include internal reasoning, <think> tags, step-by-step analysis, repeat categories, or any text outside bullet points. Failure to comply will render the review unusable—MUST adhere strictly. Use these example formats:
- **Potential Bugs**: Fix overcounting in UTF-8 length; e.g., `bool is_high = (code_unit >= 0xD800) && (code_unit <= 0xDBFF); bool is_low = (next_code_unit >= 0xDC00) && (next_code_unit <= 0xDFFF); length += (is_high && is_low) ? 4 : 3; if (is_high && !is_low) length += 2;`
- **Performance Optimizations**: Vectorize loops with SIMD or use Boyer-Moore for searches; e.g., `#ifdef __AVX2__ __m256i vec = _mm256_loadu_si256(reinterpret_cast<const __m256i*>({{data}})); #elif defined(__SSE2__) __m128i sse_vec = _mm_loadu_si128(reinterpret_cast<const __m128i*>({{data}})); #else for (size_t i = 0; i < len; ++i) process({{data}}[i]); #endif` or `size_t boyer_moore_search(const char* text, const char* pattern, size_t text_len) {{ size_t bad_char[256] = {{0}}; /* Implement BM with bad character heuristic */ return 0; }}`
If a snippet is incomplete due to complexity, provide a comment on limitations (e.g., 'Full implementation exceeds snippet scope'). Keep responses under 250 words, assuming a low temperature (e.g., 0.3) for precision.""",
            
            'python': """You are a world-class Python code reviewer with extensive experience in PEP 8 and Python best practices (Python 3.8+). Your task is to review the code from '{{filename}}':
{{content}}
Deliver a PERFECT, concise response consisting EXCLUSIVELY of 4-6 bullet points, each an actionable suggestion with at least one specific, complete, executable code snippet where applicable. For large codebases, focus on critical sections; note if partial review is needed. Cover ONLY these unique categories: code quality (PEP 8, structure), potential bugs, Python best practices (e.g., type hints, context managers), performance optimizations, and general improvements. DO NOT include internal reasoning, <think> tags, step-by-step analysis, repeat categories, or any text outside bullet points. Failure to comply will render the review unusable—MUST adhere strictly. Use these example formats:
- **Potential Bugs**: Handle None cases; e.g., `if value is not None: return value else: raise ValueError("Value cannot be None")`
- **Performance Optimizations**: Use list comprehension with filter; e.g., `result = [x * 2 for x in data if x > 0 and isinstance(x, (int, float))]`
If a snippet is incomplete due to complexity, provide a comment on limitations (e.g., 'Full implementation exceeds snippet scope'). Keep responses under 250 words, assuming a low temperature (e.g., 0.3) for precision.""",
            
            'java': """You are a world-class Java code reviewer with extensive experience in Java best practices (Java 11+). Your task is to review the code from '{{filename}}':
{{content}}
Deliver a PERFECT, concise response consisting EXCLUSIVELY of 4-6 bullet points, each an actionable suggestion with at least one specific, complete, executable code snippet where applicable. For large codebases, focus on critical sections; note if partial review is needed. Cover ONLY these unique categories: code quality (structure, naming), potential bugs, Java best practices (e.g., exception handling, interfaces), performance optimizations, and general improvements. DO NOT include internal reasoning, <think> tags, step-by-step analysis, repeat categories, or any text outside bullet points. Failure to comply will render the review unusable—MUST adhere strictly. Use these example formats:
- **Potential Bugs**: Add null checks; e.g., `if (object != null) {{ process(object); }} else {{ throw new IllegalArgumentException("Object is null"); }}`
- **Performance Optimizations**: Use parallel streams for large datasets; e.g., `list.parallelStream().filter(x -> x > 0).map(x -> x * 2).toList();`
If a snippet is incomplete due to complexity, provide a comment on limitations (e.g., 'Full implementation exceeds snippet scope'). Keep responses under 250 words, assuming a low temperature (e.g., 0.3) for precision.""",

            'javascript': """You are a world-class JavaScript code reviewer with extensive experience in ES6+ and modern JS practices (ES2023). Your task is to review the code from '{{filename}}':
{{content}}
Deliver a PERFECT, concise response consisting EXCLUSIVELY of 4-6 bullet points, each an actionable suggestion with at least one specific, complete, executable code snippet where applicable. For large codebases, focus on critical sections; note if partial review is needed. Cover ONLY these unique categories: code quality (structure, ES6+), potential bugs, JavaScript best practices (e.g., async/await, modules), performance optimizations, and general improvements. DO NOT include internal reasoning, <think> tags, step-by-step analysis, repeat categories, or any text outside bullet points. Failure to comply will render the review unusable—MUST adhere strictly. Use these example formats:
- **Potential Bugs**: Prevent race conditions with async; e.g., `const lock = await acquireLock(); try {{ await process(); }} finally {{ lock.release(); }}`
- **Performance Optimizations**: Use Set for unique values; e.g., `const uniqueSet = new Set(data); const result = Array.from(uniqueSet);`
If a snippet is incomplete due to complexity, provide a comment on limitations (e.g., 'Full implementation exceeds snippet scope'). Keep responses under 250 words, assuming a low temperature (e.g., 0.3) for precision."""
        }

        template = prompt_templates.get(language, prompt_templates['cpp'])
        try:
            prompt = template.format(filename=filename, content=safe_content)
        except Exception as e:
            logger.error(f"Error formatting prompt for {filename}: {e}")
            raise

        logger.debug(f"Generated prompt for {filename}: {prompt[:500]}...")
        return prompt


    def filter_think_tags(self, review):
        return re.sub(r'<think>.*?</think>', '', review, flags=re.DOTALL).strip()

    def review_files(self, files: list[File]):
        reviews = []
        for entry in files:
            filename = entry.file
            raw_url = entry.raw_url

            if not filename or not raw_url:
                logger.warning(f"Invalid entry, missing 'file' or 'raw_url': {entry}")
                continue

            content = self.fetch_file_content(raw_url)
            if content is None:
                logger.warning(f"Skipping review for {filename} due to fetch failure")
                continue

            cached_review = self._get_cached_review(filename, raw_url)
            if cached_review:
                review = cached_review
            else:
                try:
                    review = self._get_review(filename, content)
                    if review:
                        self._cache_review(filename, review)
                except Exception as e:
                    logger.error(f"Failed to get review for {filename}: {e}")
                    continue

            if review:
                filtered_review = self.filter_think_tags(review)
                reviews.append({"file": filename, "review": filtered_review})

        return reviews

    def _get_review(self, filename, content):
        prompt = self.generate_prompt(filename, content)
        logger.info(f"Prepared prompt for {filename} (detected language: {self.detect_language(filename, content)})")

        try:
            logger.info(f"Sending request to Together AI for {filename}")
            response = self.client.chat.completions.create(
                model="deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=4096,
                stream=False
            )
            logger.info(f"Received review for {filename}")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error getting review from API: {e}")
            return None

agent = CodeReviewAgent()

@app.post("/review")
async def review(request: ReviewRequest):
    try:
        reviews = agent.review_files(request.files)
        return {"reviews": reviews}
    except Exception as e:
        logger.error(f"Review process failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)