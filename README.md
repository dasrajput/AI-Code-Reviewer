# AI Code Review Assistant

A comprehensive full-stack web application that provides AI-powered code review assistance for GitHub repositories. The application integrates with GitHub APIs via n8n workflows to fetch pull requests and generate intelligent code reviews using AI agents.

## 🚀 Features

- **GitHub Integration**: Fetch pull requests from any public GitHub repository
- **AI-Powered Reviews**: Generate comprehensive code reviews with AI analysis
- **Modern UI**: Beautiful, responsive interface with proper code formatting
- **Real-time Processing**: Live status updates and error handling
- **Local Development**: Designed for easy local setup and AI agent integration
- **Comprehensive Debugging**: Extensive logging for development and troubleshooting

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **State Management**: TanStack Query (React Query)
- **Database**: PostgreSQL with Drizzle ORM
- **External Integration**: n8n workflows + AI agents

### Project Structure
```
ai-code-review-assistant/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components (shadcn/ui)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions and query client
│   │   ├── pages/          # Application pages
│   │   └── App.tsx         # Main application component
│   └── index.html          # HTML template
├── server/                 # Backend Express application
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Data storage interface
│   └── vite.ts            # Vite development integration
├── shared/                # Shared TypeScript types and schemas
│   └── schema.ts          # Database schemas and API types
├── attached_assets/       # Demo data and workflow files
├── package.json           # Node.js dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── vite.config.ts         # Vite build configuration
└── README.md              # This file
```

## 📦 Installation & Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** database (optional - uses in-memory storage by default)
- **n8n** workflow automation platform
- **AI Agent** (for local review generation)

### 1. Clone and Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd ai-code-review-assistant

# Install dependencies
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Database (optional - uses in-memory storage if not provided)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# n8n Configuration
N8N_BASE_URL=https://your-ngrok-url.ngrok-free.app

# Development
NODE_ENV=development
PORT=5000
```

### 3. Database Setup (Optional)
If using PostgreSQL:
```bash
# Create database
createdb ai_code_review

# Run migrations (if needed)
npm run db:migrate
```

### 4. Start the Application
```bash
# Start development server (both frontend and backend)
npm run dev
```

The application will be available at: `http://localhost:5000`

## 🔧 Configuration

### n8n Workflow Setup
1. **Install n8n**: Follow [n8n documentation](https://docs.n8n.io/)
2. **Import Workflows**: Import the provided workflow files from `attached_assets/`
3. **Configure Webhooks**: Set up the following webhooks:
   - **List PRs**: `/webhook/list-prs` - Fetches GitHub pull requests
   - **Review Trigger**: `/webhook/github-webhook` - Triggers AI review generation

### AI Agent Integration
For local development with your AI agent:
1. **Start AI Agent**: Ensure your AI agent is running on `localhost:5678`
2. **Configure Webhooks**: The application expects the review webhook at:
   ```
   http://localhost:5678/webhook/github-webhook
   ```
3. **Test Connection**: Use the debug logs to verify connectivity

## 🛠️ Development

### Available Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check

# Run linting
npm run lint

# Database operations
npm run db:generate    # Generate migrations
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
```

### Debug Mode
The application includes comprehensive debugging:

#### Frontend Debugging
- Open browser dev tools console
- Look for messages prefixed with `=== FRONTEND DEBUG:`
- Shows API calls, response handling, and UI state changes

#### Backend Debugging
- Check server console output
- Look for emojis and structured debug messages:
  - 🔍 Request analysis
  - 🌐 Network operations  
  - ✅ Success indicators
  - ❌ Error information
  - 📊 Data processing

### Development Workflow
1. **Repository Testing**: Start with `wsvn53/scrcpy-mobile` (has test PRs)
2. **PR Fetching**: Test GitHub integration via n8n
3. **Review Generation**: Test AI review workflow
4. **UI Testing**: Verify responsive design and error handling

## 🔌 API Endpoints

### GET `/api/prs`
Fetch pull requests for a repository
- **Query**: `repo` (string) - Repository name (e.g., "owner/repo")
- **Response**: Array of pull request objects
- **Debug**: Extensive logging for n8n integration

### POST `/api/trigger`
Trigger AI review for a specific pull request
- **Body**: `{ repo: string, prNumber: number }`
- **Response**: Review trigger confirmation
- **Debug**: Complete webhook payload logging

### GET `/api/review`
Fetch generated review content
- **Response**: Review text content
- **Debug**: File system access logging

## 🎨 UI Components

### Core Features
- **Repository Input**: Smart validation and error handling
- **PR List Display**: Clean table with status badges
- **Review Generation**: Real-time progress indicators
- **Review Display**: Syntax-highlighted code blocks with copy functionality

### Design System
- **Colors**: Blue/indigo gradient theme with semantic color coding
- **Typography**: Clean, modern font stack with proper hierarchy
- **Spacing**: Consistent 8px grid system
- **Components**: Fully accessible shadcn/ui components

### Review Formatting
The application properly formats AI reviews with:
- **File Sections**: Organized by file name
- **Category Icons**: Visual indicators for bug types, quality issues, etc.
- **Code Blocks**: Syntax-highlighted with copy buttons
- **Point Structure**: Clear bullet-point organization

## 🔍 Troubleshooting

### Common Issues

#### "Cannot connect to n8n service"
1. Check if n8n is running
2. Verify ngrok URL in environment variables
3. Ensure webhooks are active in n8n
4. Check firewall/network connectivity

#### "No pull requests found"
1. Verify repository name format (owner/repo)
2. Check if repository exists and is public
3. Review n8n workflow logs
4. Test with known working repository

#### "Review generation failed"
1. Ensure AI agent is running locally
2. Check localhost:5678 accessibility
3. Verify webhook payload format
4. Review AI agent logs

#### Frontend Not Loading
1. Check if port 5000 is available
2. Verify all dependencies are installed
3. Clear browser cache
4. Check console for JavaScript errors

### Debug Information
Enable maximum debugging by:
1. Setting `NODE_ENV=development`
2. Opening browser dev tools
3. Monitoring server console output
4. Checking network tab for API calls

## 🔄 Workflow Integration

### n8n Workflows
1. **List_PRs.json**: GitHub PR fetching workflow
   - Connects to GitHub API
   - Formats response for application
   - Handles rate limiting and errors

2. **github-webhook**: AI review trigger workflow
   - Receives webhook payload
   - Processes PR data
   - Triggers AI agent review generation

### AI Agent Integration
The application is designed to work with local AI agents:
- **Input**: GitHub webhook payload format
- **Processing**: AI-powered code analysis
- **Output**: Structured review format with code suggestions

## 📝 Contributing

### Code Style
- **TypeScript**: Strict mode enabled
- **Linting**: ESLint + Prettier configuration
- **Components**: Functional components with hooks
- **API**: RESTful design with proper error handling

### Adding Features
1. Update shared schemas in `shared/schema.ts`
2. Implement backend routes in `server/routes.ts`
3. Create frontend components in `client/src/`
4. Add comprehensive debugging statements
5. Update this README with new features

## 🚢 Deployment

### Local Deployment
Perfect for development with your AI agent:
```bash
npm run build
npm start
```

### Production Deployment
1. **Build**: `npm run build`
2. **Environment**: Configure production environment variables
3. **Database**: Set up production PostgreSQL
4. **n8n**: Deploy n8n workflows to production instance
5. **AI Agent**: Configure production AI service endpoints

## 📄 License

This project is for educational and development purposes. See LICENSE file for details.

## 🙋‍♂️ Support

For issues and questions:
1. Check the troubleshooting section above
2. Review debug logs for specific error messages
3. Verify all services (n8n, AI agent) are running
4. Test with the provided sample repository

---

**Last Updated**: July 2025  
**Version**: 1.0.0  
**Compatibility**: Node.js 18+, React 18, TypeScript 5+