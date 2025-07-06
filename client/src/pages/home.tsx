import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Github, 
  Code, 
  Download, 
  ExternalLink, 
  Microscope, 
  Brain, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Info,
  Key,
  Bot,
  Loader2
} from "lucide-react";
import type { PullRequest, ReviewTriggerRequest, ReviewResponse } from "@shared/schema";

export default function Home() {
  const [repoName, setRepoName] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState<number | null>(null);
  const [currentReview, setCurrentReview] = useState<{
    content: string;
    prNumber: number;
    generatedAt: Date;
  } | null>(null);
  
  const { toast } = useToast();

  // Fetch pull requests
  const { data: pullRequests, isLoading: isLoadingPRs, error: prsError, refetch: refetchPRs } = useQuery<PullRequest[]>({
    queryKey: ['/api/prs', repoName],
    queryFn: async () => {
      if (!repoName.trim()) {
        throw new Error("Repository name is required");
      }
      const response = await fetch(`/api/prs?repo=${encodeURIComponent(repoName.trim())}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pull requests');
      }
      return response.json();
    },
    enabled: false,
  });

  // Trigger review mutation
  const triggerReviewMutation = useMutation({
    mutationFn: async (data: ReviewTriggerRequest) => {
      const response = await apiRequest('POST', '/api/trigger', data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      setIsGeneratingReview(variables.prNumber);
      toast({
        title: "Review Triggered",
        description: `AI review generation started for PR #${variables.prNumber}`,
      });
      startReviewPolling(variables.prNumber);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Generate Review",
        description: error.message,
        variant: "destructive",
      });
      setIsGeneratingReview(null);
    },
  });

  // Poll for review results
  const startReviewPolling = (prNumber: number) => {
    let pollCount = 0;
    const maxPolls = 24; // 2 minutes at 5-second intervals

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/review');
        
        if (response.ok) {
          const data: ReviewResponse = await response.json();
          if (data.review && data.review.trim()) {
            clearInterval(pollInterval);
            setCurrentReview({
              content: data.review,
              prNumber,
              generatedAt: new Date(),
            });
            setIsGeneratingReview(null);
            toast({
              title: "Review Generated",
              description: `AI review completed for PR #${prNumber}`,
            });
            return;
          }
        }

        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsGeneratingReview(null);
          toast({
            title: "Review Timeout",
            description: "Review generation took too long. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsGeneratingReview(null);
          toast({
            title: "Review Error",
            description: "Failed to retrieve review. Please try again.",
            variant: "destructive",
          });
        }
      }
    }, 5000);
  };

  const handleFetchPRs = async () => {
    if (!repoName.trim()) {
      toast({
        title: "Repository Required",
        description: "Please enter a repository name in the format owner/repository",
        variant: "destructive",
      });
      return;
    }

    if (!/^[\w\-\.]+\/[\w\-\.]+$/.test(repoName.trim())) {
      toast({
        title: "Invalid Repository Format",
        description: "Repository should be in format: owner/repository-name",
        variant: "destructive",
      });
      return;
    }

    // Try fetching PRs
    try {
      const result = await refetchPRs();
      
      // If n8n workflow is still processing, wait and retry
      if (result.data && typeof result.data === 'object' && 'status' in result.data && result.data.status === 'processing') {
        toast({
          title: "Workflow Starting",
          description: "n8n workflow is processing. Retrying in 3 seconds...",
        });
        
        // Retry after 3 seconds
        setTimeout(() => {
          refetchPRs();
        }, 3000);
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
    }
  };

  const handleGenerateReview = (prNumber: number) => {
    if (!repoName.trim()) {
      toast({
        title: "Invalid Request",
        description: "Repository name is required",
        variant: "destructive",
      });
      return;
    }

    triggerReviewMutation.mutate({
      repo: repoName.trim(),
      prNumber,
    });
  };

  const copyReviewToClipboard = async () => {
    if (currentReview) {
      try {
        await navigator.clipboard.writeText(currentReview.content);
        toast({
          title: "Copied to Clipboard",
          description: "Review content copied successfully",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy review to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const downloadReview = () => {
    if (currentReview) {
      const blob = new Blob([currentReview.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `review-pr-${currentReview.prNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      case 'merged':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-slate-50 font-sans min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Code className="text-white" size={16} />
              </div>
              <h1 className="text-xl font-semibold text-slate-800">AI Code Review Assistant</h1>
            </div>
            <div className="text-sm text-slate-500 flex items-center">
              <Bot size={16} className="mr-1" />
              Powered by n8n
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* n8n Status Info */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="font-medium">n8n Integration Active</div>
            <div className="text-sm mt-1">
              This app connects to your n8n workflow. Make sure your List_PRs workflow is active in n8n to fetch real GitHub PR data.
            </div>
          </AlertDescription>
        </Alert>

        {/* Repository Input */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Github className="mr-2" size={20} />
              Repository Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="repoInput" className="block text-sm font-medium text-slate-700 mb-2">
                  GitHub Repository
                </label>
                <Input
                  id="repoInput"
                  placeholder="e.g., LadybirdBrowser/ladybird"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoadingPRs && handleFetchPRs()}
                />
                <p className="text-xs text-slate-500 mt-1">Enter the repository in format: owner/repository-name</p>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={handleFetchPRs}
                  disabled={isLoadingPRs}
                  className="px-6 py-3"
                >
                  {isLoadingPRs ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2" size={16} />
                      Fetch PRs
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* GitHub Token Section */}
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Key className="mr-2 text-slate-500" size={16} />
                  <span className="text-sm font-medium text-slate-700">GitHub Token (Optional)</span>
                  <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                    Rate Limit Protection
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {showTokenInput ? 'Hide' : 'Show'}
                  {showTokenInput ? <ChevronUp className="ml-1" size={16} /> : <ChevronDown className="ml-1" size={16} />}
                </Button>
              </div>
              {showTokenInput && (
                <div className="mt-3">
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Personal access token to avoid rate limits</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {prsError && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="font-medium">Failed to fetch pull requests</div>
              <div className="text-sm mt-1">
                {prsError.message.includes('n8n webhook not found') ? 'n8n workflow is not active. Please start the List_PRs workflow in your n8n instance.' :
                 prsError.message.includes('404') ? 'Repository not found. Please check the repository name.' :
                 prsError.message.includes('403') ? 'Rate limit exceeded. Try adding a GitHub token.' :
                 `Network error: ${prsError.message}`}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Pull Requests Table */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CardTitle className="flex items-center">
                  <Github className="mr-2" size={20} />
                  Pull Requests
                </CardTitle>
                {pullRequests && pullRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-3">
                    {pullRequests.length}
                  </Badge>
                )}
              </div>
              {pullRequests && (
                <div className="text-sm text-slate-500">
                  Last updated: {formatTimeAgo(new Date())}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPRs ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
            ) : pullRequests && pullRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">PR #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">State</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Link</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {pullRequests.map((pr) => (
                      <tr key={pr.number} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-900">#{pr.number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900 font-medium" title={pr.title}>
                            {pr.title}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStateColor(pr.state)}>
                            {pr.state}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a 
                            href={pr.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                          >
                            <Github className="mr-1" size={16} />
                            View PR
                            <ExternalLink className="ml-1" size={12} />
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            onClick={() => handleGenerateReview(pr.number)}
                            disabled={isGeneratingReview === pr.number || triggerReviewMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                            size="sm"
                          >
                            {isGeneratingReview === pr.number ? (
                              <>
                                <Loader2 className="mr-1 animate-spin" size={16} />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Brain className="mr-1" size={16} />
                                Generate Review
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Github className="text-slate-400" size={24} />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Pull Requests</h3>
                <p className="text-slate-500">Enter a repository name above and click "Fetch PRs" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CardTitle className="flex items-center">
                  <Microscope className="mr-2" size={20} />
                  AI Code Review
                </CardTitle>
                {isGeneratingReview && (
                  <Badge variant="outline" className="ml-3 bg-yellow-100 text-yellow-800 border-yellow-300">
                    <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                    Generating...
                  </Badge>
                )}
              </div>
              {currentReview && (
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={copyReviewToClipboard}>
                    <Copy className="mr-1" size={16} />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadReview}>
                    <Download className="mr-1" size={16} />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isGeneratingReview ? (
              <div className="py-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Generating AI review...</p>
                <p className="text-slate-500 text-sm mt-1">This may take up to 30 seconds</p>
              </div>
            ) : currentReview ? (
              <div>
                <Alert className="mb-4 bg-slate-50 border-slate-200">
                  <Info className="h-4 w-4 text-slate-600" />
                  <AlertDescription className="text-slate-600">
                    Review for PR #{currentReview.prNumber} • Generated {formatTimeAgo(currentReview.generatedAt)}
                  </AlertDescription>
                </Alert>
                
                <div className="prose prose-slate max-w-none">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-200 overflow-x-auto">
                    {currentReview.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Microscope className="text-slate-400" size={24} />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Review Generated</h3>
                <p className="text-slate-500">Select a pull request above and click "Generate Review" to get AI analysis.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              AI Code Review Assistant • Built with Node.js & n8n
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-500">Status:</span>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                <span className="text-sm text-green-600 font-medium">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
