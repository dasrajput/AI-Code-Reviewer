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
      console.log(`Fetching PRs for repository: ${repo}`);
      
      const response = await axios.get(
        `${N8N_BASE_URL}/webhook-test/list-prs?repo=${encodeURIComponent(repo)}`,
        { 
          headers: { 
            'User-Agent': 'n8n-workflow', 
            'ngrok-skip-browser-warning': 'true' 
          },
          timeout: 10000
        }
      );
      
      console.log('n8n response:', JSON.stringify(response.data, null, 2));
      
      // Handle n8n workflow response
      let prData = response.data;
      
      // If response indicates workflow started but no data yet, return processing status
      if (prData && prData.message === "Workflow was started") {
        console.log('n8n workflow started, waiting for data...');
        return res.status(202).json({ 
          message: 'Workflow started, please try again in a moment',
          status: 'processing'
        });
      }
      
      // Handle direct array response from n8n (this is what your workflow returns)
      if (Array.isArray(prData) && prData.length > 0) {
        // Validate PR objects have required fields
        const validPRs = prData.filter(pr => 
          pr && pr.number && pr.title && pr.state && pr.html_url
        );
        
        if (validPRs.length > 0) {
          console.log(`Found ${validPRs.length} valid PRs from n8n workflow`);
          return res.json(validPRs);
        }
      }
      
      // If response is wrapped in n8n format, extract it
      if (Array.isArray(prData) && prData.length > 0 && prData[0].json) {
        const extractedPRs = prData.map(item => item.json).filter(pr => 
          pr && pr.number && pr.title && pr.state && pr.html_url
        );
        
        if (extractedPRs.length > 0) {
          console.log(`Found ${extractedPRs.length} valid PRs from wrapped n8n response`);
          return res.json(extractedPRs);
        }
      }
      
      // If no valid PRs found, return empty array
      console.log('No valid PRs found in response, returning empty array');
      return res.json([]);
      
    } catch (error: any) {
      console.error('Error fetching PRs from n8n:', error.message);
      
      if (error.response?.status === 404) {
        return res.status(400).json({ 
          error: 'n8n webhook not found. Please ensure the List_PRs workflow is active in n8n.' 
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ 
          error: 'Cannot connect to n8n service. Please check if n8n is running and accessible.' 
        });
      }
      
      return res.status(500).json({ 
        error: `Failed to fetch PRs: ${error.message}` 
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
      // Try n8n workflow first
      await axios.post(
        `${N8N_BASE_URL}/webhook-test/github-webhook`,
        { body: { pull_request: { url: prUrl } } },
        { 
          headers: { 
            'User-Agent': 'n8n-workflow', 
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      res.json({ message: 'Review triggered successfully' });
    } catch (error: any) {
      console.error('Error triggering review in n8n:', error.message);
      
      if (error.response?.status === 404) {
        return res.status(400).json({ 
          error: 'n8n webhook not found. Please ensure the review workflow is active in n8n.' 
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ 
          error: 'Cannot connect to n8n service. Please check if n8n is running and accessible.' 
        });
      }
      
      return res.status(500).json({ 
        error: `Failed to trigger review: ${error.message}` 
      });
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
