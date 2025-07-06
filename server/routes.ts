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
    console.log('=== DEBUG: /api/prs endpoint called ===');
    console.log('DEBUG: Request query:', req.query);
    
    const { repo } = req.query;
    
    if (!repo || typeof repo !== 'string') {
      console.log('DEBUG: Invalid repo parameter:', repo);
      return res.status(400).json({ error: 'Repository parameter is required' });
    }

    console.log(`DEBUG: Valid repo parameter received: ${repo}`);
    console.log(`DEBUG: N8N_BASE_URL: ${N8N_BASE_URL}`);
    
    const requestUrl = `${N8N_BASE_URL}/webhook/list-prs?repo=${encodeURIComponent(repo)}`;
    console.log(`DEBUG: Full request URL: ${requestUrl}`);

    try {
      console.log(`DEBUG: Starting axios request to n8n...`);
      
      const response = await axios.get(requestUrl, { 
        headers: { 
          'User-Agent': 'n8n-workflow', 
          'ngrok-skip-browser-warning': 'true' 
        },
        timeout: 10000
      });
      
      console.log('DEBUG: Axios request successful');
      console.log('DEBUG: Response status:', response.status);
      console.log('DEBUG: Response headers:', response.headers);
      console.log('DEBUG: Response data type:', typeof response.data);
      console.log('DEBUG: Response data:', JSON.stringify(response.data, null, 2));
      
      // Handle n8n workflow response
      let prData = response.data;
      console.log('DEBUG: Processing response data...');
      
      // If response indicates workflow started but no data yet, return processing status
      if (prData && prData.message === "Workflow was started") {
        console.log('DEBUG: Workflow started message received');
        return res.status(202).json({ 
          message: 'n8n workflow is activating. Click the button again in a few seconds to fetch PRs.',
          status: 'processing'
        });
      }
      
      // Handle direct array response from n8n (this is what your workflow returns)
      if (Array.isArray(prData)) {
        console.log(`DEBUG: Received array response with ${prData.length} items`);
        
        if (prData.length > 0) {
          console.log('DEBUG: First item in array:', JSON.stringify(prData[0], null, 2));
          
          // Validate PR objects have required fields
          const validPRs = prData.filter(pr => {
            const isValid = pr && pr.number && pr.title && pr.state && pr.html_url;
            console.log(`DEBUG: Validating PR ${pr?.number}: ${isValid ? 'VALID' : 'INVALID'}`, pr);
            return isValid;
          });
          
          console.log(`DEBUG: Found ${validPRs.length} valid PRs out of ${prData.length} total`);
          
          if (validPRs.length > 0) {
            console.log('DEBUG: Returning valid PRs to client');
            return res.json(validPRs);
          }
        } else {
          console.log('DEBUG: Empty array received');
        }
      } else {
        console.log('DEBUG: Response is not an array, checking for wrapped format...');
        
        // If response is wrapped in n8n format, extract it
        if (Array.isArray(prData) && prData.length > 0 && prData[0].json) {
          console.log('DEBUG: Found wrapped n8n format, extracting...');
          const extractedPRs = prData.map(item => item.json).filter(pr => {
            const isValid = pr && pr.number && pr.title && pr.state && pr.html_url;
            console.log(`DEBUG: Validating extracted PR ${pr?.number}: ${isValid ? 'VALID' : 'INVALID'}`);
            return isValid;
          });
          
          if (extractedPRs.length > 0) {
            console.log(`DEBUG: Found ${extractedPRs.length} valid PRs from wrapped response`);
            return res.json(extractedPRs);
          }
        }
      }
      
      // If no valid PRs found, return empty array
      console.log('DEBUG: No valid PRs found, returning empty array');
      return res.json([]);
      
    } catch (error: any) {
      console.log('=== DEBUG: Error occurred ===');
      console.log('DEBUG: Error type:', error.constructor.name);
      console.log('DEBUG: Error message:', error.message);
      console.log('DEBUG: Error code:', error.code);
      console.log('DEBUG: Error response status:', error.response?.status);
      console.log('DEBUG: Error response data:', error.response?.data);
      console.log('DEBUG: Full error object:', error);
      
      if (error.response?.status === 404) {
        console.log('DEBUG: Returning 404 error response');
        console.log('DEBUG: n8n error response:', error.response?.data);
        
        // Check if it's the specific n8n test mode message
        if (error.response?.data?.message?.includes('not registered')) {
          return res.status(400).json({ 
            error: 'n8n webhook not active. Please activate your List_PRs workflow in n8n by clicking "Execute workflow" button.' 
          });
        }
        
        return res.status(400).json({ 
          error: 'n8n webhook not found. Please ensure the List_PRs workflow is active in n8n.' 
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('DEBUG: Returning connection error response');
        return res.status(503).json({ 
          error: 'Cannot connect to n8n service. Please check if n8n is running and accessible.' 
        });
      }
      
      console.log('DEBUG: Returning generic error response');
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
        `${N8N_BASE_URL}/webhook/github-webhook`,
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
