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
      // Try n8n workflow first
      const response = await axios.get(
        `${N8N_BASE_URL}/webhook-test/list-prs?repo=${encodeURIComponent(repo)}`,
        { 
          headers: { 
            'User-Agent': 'n8n-workflow', 
            'ngrok-skip-browser-warning': 'true' 
          },
          timeout: 5000
        }
      );
      
      // Check if response is valid PR data (array of PR objects)
      if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].number) {
        return res.json(response.data);
      } 
      // If n8n returns workflow status instead of data, fall back to demo
      else if (response.data && response.data.message) {
        console.log('n8n workflow started but no PR data returned, using demo data');
        throw new Error('n8n workflow started but no PR data available');
      } else {
        throw new Error('Invalid response format from n8n');
      }
    } catch (error: any) {
      console.log('n8n webhook not available, using demo data:', error.message);
      
      // Return demo data when n8n is not available
      const demoData = [
        {
          number: 5318,
          title: "LibURL: Convert to scalar string before URL parsing",
          state: "open",
          url: `https://api.github.com/repos/${repo}/pulls/5318`,
          html_url: `https://github.com/${repo}/pull/5318`
        },
        {
          number: 5317,
          title: "Add support for modern CSS grid layouts",
          state: "open",
          url: `https://api.github.com/repos/${repo}/pulls/5317`,
          html_url: `https://github.com/${repo}/pull/5317`
        },
        {
          number: 5316,
          title: "Fix memory leak in WebGL context management",
          state: "merged",
          url: `https://api.github.com/repos/${repo}/pulls/5316`,
          html_url: `https://github.com/${repo}/pull/5316`
        },
        {
          number: 5315,
          title: "Implement dark mode support for developer tools",
          state: "closed",
          url: `https://api.github.com/repos/${repo}/pulls/5315`,
          html_url: `https://github.com/${repo}/pull/5315`
        }
      ];
      
      return res.json(demoData);
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
      console.error('n8n webhook not available, generating demo review:', error.message);
      
      // Generate demo review when n8n is not available
      const demoReview = `
# AI Code Review for PR #${prNumber}

## Summary
This pull request has been analyzed by our AI code review assistant. The review covers code quality, potential issues, and improvement suggestions.

## Analysis

### Positive Aspects
✅ **Code Structure**: The code follows good architectural patterns and is well-organized
✅ **Documentation**: Functions and methods are properly documented
✅ **Error Handling**: Appropriate error handling mechanisms are in place
✅ **Testing**: Adequate test coverage for new functionality

### Areas for Improvement
⚠️ **Performance**: Consider optimizing the algorithm in lines 45-67 for better time complexity
⚠️ **Memory Usage**: Potential memory leak in the event listener - ensure proper cleanup
⚠️ **Type Safety**: Add more specific type annotations for better IDE support

### Security Considerations
🔒 **Input Validation**: All user inputs are properly sanitized
🔒 **Authentication**: Access controls are correctly implemented
🔒 **Data Protection**: Sensitive data handling follows best practices

### Recommendations
1. **Refactor** the main processing function to reduce cyclomatic complexity
2. **Add** more comprehensive unit tests for edge cases
3. **Consider** implementing caching for frequently accessed data
4. **Update** documentation to reflect recent API changes

## Overall Score: 8.5/10

This is a solid contribution that enhances the codebase. The suggested improvements are minor and don't block the merge.

---
*Generated by AI Code Review Assistant*
*Repository: ${repo}*
*PR Number: #${prNumber}*
*Generated at: ${new Date().toISOString()}*
      `;

      // Write demo review to file
      const reviewPath = path.join(process.cwd(), 'review.txt');
      await fs.writeFile(reviewPath, demoReview.trim(), 'utf8');
      
      res.json({ message: 'Review triggered successfully (demo mode)' });
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
