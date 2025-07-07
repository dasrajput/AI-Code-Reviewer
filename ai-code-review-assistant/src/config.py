from dotenv import dotenv_values
import os

# Load environment variables from .env file in the project root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
env_vars = dotenv_values(dotenv_path=env_path)

config = {
    "github_token": env_vars.get("GITHUB_TOKEN"),
    "api_key": env_vars.get("TOGETHER_AI_API_KEY")
}