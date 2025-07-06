import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  const N8N_BASE_URL = "https://6f36-2409-40c2-11a-446d-688f-c19d-502a-fee4.ngrok-free.app";

  // Get pull requests for a repository
  app.get('/api/prs', async (req, res) => {
    const { repo } = req.query;
    
    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: 'Repository parameter is required' });
    }

    try {
      const response = await axios.get(
        `${N8N_BASE_URL}/webhook-test/list-prs?repo=${encodeURIComponent(repo)}`,
        { 
          headers: { 
            'User-Agent': 'n8n-workflow', 
            'ngrok-skip-browser-warning': 'true' 
          } 
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error('Error fetching PRs:', error.message);
      res.status(500).json({ 
        error: error.response?.status === 404 
          ? 'Repository not found' 
          : 'Failed to fetch pull requests'
      });
    }
  });

  // Trigger code review for a specific PR
  app.post('/api/trigger', async (req, res) => {
    const { repo, prNumber } = req.body;
    
    if (!repo || !prNumber) {
      return res.status(400).json({ error: 'Repository and PR number are required' });
    }

    const prUrl = `https://api.github.com/repos/${repo}/pulls/${prNumber}`;
    
    try {
      await axios.post(
        `${N8N_BASE_URL}/webhook-test/github-webhook`,
        { body: { pull_request: { url: prUrl } } },
        { 
          headers: { 
            'User-Agent': 'n8n-workflow', 
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json'
          } 
        }
      );
      res.json({ message: 'Review triggered successfully' });
    } catch (error: any) {
      console.error('Error triggering review:', error.message);
      res.status(500).json({ error: 'Failed to trigger review' });
    }
  });

  // Get the generated review content
  app.get('/api/review', async (req, res) => {
    try {
      const reviewPath = path.join(process.cwd(), 'review.txt');
      const review = await fs.readFile(reviewPath, 'utf8');
      res.json({ review: review.trim() });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Review not found' });
      } else {
        console.error('Error reading review:', error.message);
        res.status(500).json({ error: 'Failed to read review file' });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
