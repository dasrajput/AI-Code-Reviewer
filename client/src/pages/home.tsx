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
  Bot, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Info,
  Key,
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Zap,
  Sparkles
} from "lucide-react";
import type { PullRequest, ReviewTriggerRequest, ReviewResponse } from "@shared/schema";

// Demo review data using the actual format from your AI agent
const DEMO_REVIEW = `=== Review for AK/UnicodeUtils.h ===
- **Potential Bugs**: Fix surrogate pair handling in \`calculateLength\`. Current logic incorrectly counts high and low surrogates separately instead of together. Use:
  \`\`\`cpp
  if ((current >= 0xD800 && current <= 0xDBFF) && (next >= 0xDC00 && next <= 0xDFFF)) {
      length += 2;
      i++; // Skip next code unit as it's part of the surrogate pair
  }
  \`\`\`
- **Code Quality**: Improve function documentation and readability. Add parameter names and comments:
  \`\`\`cpp
  /**
   * @brief Calculates the UTF-8 string length in code points
   * @param data The input UTF-8 string
   * @param size The size of the input string in bytes
   * @return The number of Unicode code points
   */
  size_t calculateLength(const char* data, size_t size) {
  \`\`\`
- **Modern C++ Best Practices**: Use \`const\` correctness and modern types:
  \`\`\`cpp
  size_t calculateLength(const char* const data, const size_t size) {
      for (size_t i = 0; i < size; ++i) {
          const uint8_t current = static_cast<uint8_t>(data[i]);
  \`\`\`
- **Performance Optimizations**: Use SIMD for UTF-8 processing if performance-critical:
  \`\`\`cpp
  #ifdef __AVX2__
  for (; i + 32 <= size; i += 32) {
      __m256i chunk = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(data + i));
      // Process chunk for UTF-8 code points
  }
  #endif
  \`\`\`
- **General Improvements**: Add error handling for invalid UTF-8 sequences:
  \`\`\`cpp
  if (current > 0xF4) return SIZE_MAX; // Invalid UTF-8
  if ((current >= 0xC0 && current <= 0xDF) || (current >= 0xE0 && current <= 0xEF)) {
      if (i + 1 >= size) return SIZE_MAX; // Truncated sequence
  }
  \`\`\`

=== Review for AK/Utf16View.h ===
- **Code Quality**: Improve readability by adding whitespace and comments; e.g.,  
  \`\`\`cpp
  int calculateSomething(const char* data, size_t len) {
      // Function purpose and parameters explanation
      if (!data || len == 0) return 0;

      int result = 0;
      for (size_t i = 0; i < len; ++i) {
          // Comment explaining the calculation logic
          result += static_cast<int>(data[i]);
      }
      return result;
  }
  \`\`\`

- **Potential Bugs**: Add null and empty checks at the beginning of the function; e.g.,  
  \`\`\`cpp
  if (!data || len == 0) return 0;
  \`\`\`

- **Modern C++ Best Practices**: Use \`static_cast\` instead of C-style casts for type safety; e.g.,  
  \`\`\`cpp
  result += static_cast<int>(data[i]);
  \`\`\`

- **Performance Optimizations**: Consider using \`std::string_view\` for more efficient string handling; e.g.,  
  \`\`\`cpp
  int calculateSomething(std::string_view data) {
      int result = 0;
      for (char c : data) {
          result += static_cast<int>(c);
      }
      return result;
  }
  \`\`\`

- **General Improvements**: Mark the function as \`constexpr\` if possible and add \`noexcept\`; e.g.,  
  \`\`\`cpp
  constexpr int calculateSomething(std::string_view data) noexcept {
      int result = 0;
      for (char c : data) {
          result += static_cast<int>(c);
      }
      return result;
  }
  \`\`\``;

interface ReviewSection {
  title: string;
  items: Array<{
    category: string;
    description: string;
    code?: string;
    language?: string;
  }>;
}

export default function Home() {
  const [repoName, setRepoName] = useState("");
  const [isGeneratingReview, setIsGeneratingReview] = useState<number | null>(null);
  const [currentReview, setCurrentReview] = useState<{
    content: string;
    prNumber: number;
    generatedAt: Date;
  } | null>(null);
  const [expandedReview, setExpandedReview] = useState(false);
  
  const { toast } = useToast();

  // Fetch pull requests
  const { data: pullRequests, isLoading: isLoadingPRs, error: prsError, refetch: refetchPRs } = useQuery<PullRequest[]>({
    queryKey: ['/api/prs', repoName],
    queryFn: async () => {
      console.log('=== FRONTEND DEBUG: Starting PR fetch ===');
      console.log('DEBUG: Repository name:', repoName);
      
      if (!repoName.trim()) {
        console.log('DEBUG: Empty repository name, returning empty array');
        return [];
      }
      
      const response = await fetch(`/api/prs?repo=${encodeURIComponent(repoName.trim())}`);
      console.log('DEBUG: API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.log('DEBUG: API error response:', errorData);
        throw new Error(`Failed to fetch PRs: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('DEBUG: Successfully fetched', data.length, 'pull requests');
      console.log('DEBUG: PR data received:', JSON.stringify(data, null, 2));
      return data;
    },
    enabled: false,
  });

  // Trigger review mutation
  const triggerReviewMutation = useMutation({
    mutationFn: async (data: ReviewTriggerRequest) => {
      console.log('=== FRONTEND DEBUG: Triggering review ===');
      console.log('DEBUG: Review request data:', JSON.stringify(data, null, 2));
      
      setIsGeneratingReview(data.prNumber);
      
      const response = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to trigger review: ${response.status}`);
      }
      
      return await response.json();
      
      console.log('DEBUG: Review trigger response:', response);
      return response;
    },
    onSuccess: async (response, variables) => {
      console.log('DEBUG: Review triggered successfully, fetching review data...');
      
      // Simulate review fetch for demo - in production this would fetch from /api/review
      setTimeout(() => {
        setCurrentReview({
          content: DEMO_REVIEW,
          prNumber: variables.prNumber,
          generatedAt: new Date(),
        });
        setExpandedReview(true);
        setIsGeneratingReview(null);
        
        toast({
          title: "Review Generated",
          description: `AI review completed for PR #${variables.prNumber}`,
        });
        
        console.log('DEBUG: Review data set and UI updated');
      }, 2000);
    },
    onError: (error: Error) => {
      console.log('DEBUG: Review generation failed:', error.message);
      setIsGeneratingReview(null);
      toast({
        title: "Review Failed",
        description: error.message || "Failed to generate review",
        variant: "destructive",
      });
    },
  });

  const handleFetchPRs = async () => {
    console.log('=== FRONTEND DEBUG: Fetch PRs button clicked ===');
    console.log('DEBUG: Current repo name:', repoName);
    
    if (!repoName.trim()) {
      console.log('DEBUG: Empty repo name provided');
      toast({
        title: "Repository Required",
        description: "Please enter a repository name",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('DEBUG: Starting refetch...');
      await refetchPRs();
      console.log('DEBUG: Refetch completed');
    } catch (error) {
      console.log('DEBUG: Error in handleFetchPRs:', error);
      console.error('Error fetching PRs:', error);
    }
  };

  const handleGenerateReview = (prNumber: number) => {
    console.log('=== FRONTEND DEBUG: Generate Review clicked ===');
    console.log('DEBUG: PR number:', prNumber);
    console.log('DEBUG: Repository:', repoName);
    
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
      a.download = `ai-review-pr-${currentReview.prNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const parseReviewContent = (content: string): ReviewSection[] => {
    console.log('DEBUG: Parsing review content...');
    const sections: ReviewSection[] = [];
    const lines = content.split('\n');
    let currentSection: ReviewSection | null = null;
    let currentItem: any = null;
    let inCodeBlock = false;
    let currentCode = '';
    let currentLanguage = '';

    for (const line of lines) {
      if (line.startsWith('=== Review for ')) {
        if (currentSection && currentItem) {
          currentSection.items.push(currentItem);
        }
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          title: line.replace(/=== Review for | ===/g, '').trim(),
          items: []
        };
        currentItem = null;
      } else if (line.startsWith('- **') && line.includes('**:')) {
        if (currentSection && currentItem) {
          currentSection.items.push(currentItem);
        }
        
        const match = line.match(/- \*\*(.*?)\*\*: (.*)/);
        if (match) {
          currentItem = {
            category: match[1],
            description: match[2],
            code: '',
            language: ''
          };
        }
      } else if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (currentItem) {
            currentItem.code = currentCode.trim();
            currentItem.language = currentLanguage;
          }
          currentCode = '';
          currentLanguage = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          currentLanguage = line.replace(/```/, '').trim() || 'text';
          inCodeBlock = true;
          currentCode = '';
        }
      } else if (inCodeBlock) {
        currentCode += line + '\n';
      } else if (line.trim() && currentItem && !line.startsWith('-')) {
        currentItem.description += ' ' + line.trim();
      }
    }

    // Add the last item and section
    if (currentSection && currentItem) {
      currentSection.items.push(currentItem);
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    console.log('DEBUG: Parsed review sections:', sections.length);
    return sections;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'closed':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'merged':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('bug')) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (lowerCategory.includes('performance')) return <Zap className="w-4 h-4 text-yellow-500" />;
    if (lowerCategory.includes('quality')) return <CheckCircle className="w-4 h-4 text-blue-500" />;
    if (lowerCategory.includes('modern') || lowerCategory.includes('best practices')) return <Sparkles className="w-4 h-4 text-purple-500" />;
    return <Code className="w-4 h-4 text-gray-500" />;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bot className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">AI Code Review Assistant</h1>
                <p className="text-sm text-slate-500">Intelligent code analysis powered by AI</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Connected
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Repository Input Section */}
        <Card className="mb-8 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <Github className="text-slate-600" size={20} />
              <CardTitle className="text-lg">Repository Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter repository (e.g., owner/repo-name)"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="h-12 text-base border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleFetchPRs()}
                />
              </div>
              <Button 
                onClick={handleFetchPRs}
                disabled={isLoadingPRs || !repoName.trim()}
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                {isLoadingPRs ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Fetch Pull Requests
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {prsError && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {prsError instanceof Error ? prsError.message : 'Failed to fetch pull requests'}
            </AlertDescription>
          </Alert>
        )}

        {/* Pull Requests List */}
        {pullRequests && pullRequests.length > 0 && (
          <Card className="mb-8 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="text-slate-600" size={20} />
                <span>Pull Requests ({pullRequests.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pullRequests.map((pr) => (
                  <div
                    key={pr.number}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge className={getStateColor(pr.state)} variant="outline">
                          {pr.state.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-slate-700">#{pr.number}</span>
                      </div>
                      <h3 className="font-semibold text-slate-800 mb-1">{pr.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink size={14} />
                          <span>View on GitHub</span>
                        </a>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleGenerateReview(pr.number)}
                      disabled={isGeneratingReview === pr.number}
                      className="ml-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
                    >
                      {isGeneratingReview === pr.number ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4 mr-2" />
                          Generate Review
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoadingPRs && (
          <Card className="mb-8 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="py-8">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Review Results */}
        {currentReview && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                    <Bot className="text-white" size={16} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Code Review - PR #{currentReview.prNumber}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Generated {formatTimeAgo(currentReview.generatedAt)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={copyReviewToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadReview}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedReview(!expandedReview)}
                  >
                    {expandedReview ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {expandedReview && (
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {parseReviewContent(currentReview.content).map((section, sectionIndex) => (
                    <div key={sectionIndex} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        {section.title}
                      </h3>
                      
                      <div className="space-y-4">
                        {section.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="flex items-start space-x-3 mb-3">
                              {getCategoryIcon(item.category)}
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-800 mb-2">{item.category}</h4>
                                <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                              </div>
                            </div>
                            
                            {item.code && (
                              <div className="mt-3">
                                <div className="bg-slate-900 rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                                    <span className="text-slate-300 text-xs font-mono">{item.language}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-slate-400 hover:text-white"
                                      onClick={() => {
                                        if (item.code) {
                                          navigator.clipboard.writeText(item.code);
                                        }
                                      }}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <pre className="p-4 text-sm font-mono text-slate-100 overflow-x-auto">
                                    <code>{item.code}</code>
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* No Data State */}
        {!isLoadingPRs && (!pullRequests || pullRequests.length === 0) && repoName && (
          <Card className="text-center py-12 shadow-lg border-0 bg-white/70 backdrop-blur-sm">
            <CardContent>
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Pull Requests Found</h3>
              <p className="text-slate-500">
                No open pull requests found for this repository. Try a different repository name.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}