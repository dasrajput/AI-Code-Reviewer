# AI Code Review Assistant

## Project Overview
This project automates code review for pull requests using n8n and GitHub API, targeting TCS/Zoho placement preparation.

## Setup
1. Install Docker: Follow [Docker Desktop](https://www.docker.com/products/docker-desktop/) instructions.
2. Build n8n image: Use a custom Dockerfile or pull `n8n:latest`.
3. Run n8n:
   ```bash
   docker run -it --rm --user 0:0 --name n8n -p 5678:5678 -v C:/Users/{USER}/Desktop/ai-code-review-assistant/src:/home/node/.n8n --memory=2g my-n8n:latest
   ```

4. Access n8n at http://localhost:5678 .

## Status

Sprint 1, Task 1: Completed project setup.
Sprint 1, Task 2: Completed HTTP Request and logging setup using Code node.

## Logs
Logs are stored in src/logs/pr_logs.json.