from setuptools import setup, find_packages

setup(
    name="ai_code_review_assistant",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "requests",
        "together"
    ],
    author="Your Name",
    description="A tool to automate code reviews using AI",
    python_requires=">=3.8",
)