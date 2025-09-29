import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  source: string;
  category: 'crypto' | 'stocks' | 'general';
  publishedAt: string;
}

export default function NewsDashboard() {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Fetch news data
  const { data: news, isLoading, error } = useQuery({
    queryKey: [`/api/news?${activeFilter === 'all' ? '' : `category=${activeFilter}&`}limit=50`],
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  // Fetch featured news
  const { data: featuredNews } = useQuery({
    queryKey: [`/api/news/featured${activeFilter === 'all' ? '' : `?category=${activeFilter}`}`],
    refetchInterval: 10 * 60 * 1000,
  });

  const newsData: NewsArticle[] = Array.isArray(news) ? news : [];
  const featured: NewsArticle | null = featuredNews && typeof featuredNews === 'object' && 'title' in featuredNews ? featuredNews as NewsArticle : null;

  const filters = [
    { id: 'all', label: 'All News', icon: '' },
    { id: 'crypto', label: 'Crypto', icon: 'fas fa-bitcoin' },
    { id: 'stocks', label: 'Stocks', icon: 'fas fa-chart-line' },
  ];

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const publishedDate = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'crypto':
        return 'bg-primary/20 text-primary';
      case 'stocks':
        return 'bg-accent/20 text-accent';
      default:
        return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getPlaceholderImage = (category: string) => {
    const images = {
      crypto: 'https://images.unsplash.com/photo-1640161704729-cbe966a08476?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200',
      stocks: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200',
      default: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200'
    };
    return images[category as keyof typeof images] || images.default;
  };

  return (
    <div className="space-y-6">
      {/* News Controls */}
      <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={activeFilter === filter.id ? 'default' : 'outline'}
              onClick={() => setActiveFilter(filter.id)}
              data-testid={`news-filter-${filter.id}`}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 ${activeFilter === filter.id ? 'bg-primary/20 text-primary border-primary/30' : ''}`}
            >
              {filter.icon && <i className={`${filter.icon} mr-1 sm:mr-2 text-xs sm:text-sm`}></i>}
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
          <span>Live feeds from 11 sources</span>
        </div>
      </div>

      {/* Featured News */}
      {featured && (
        <div className="glass-panel rounded-xl p-3 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-foreground">Featured Story</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="relative">
              <img
                src={featured.imageUrl || getPlaceholderImage(featured.category)}
                alt={featured.title}
                className="w-full h-48 sm:h-56 lg:h-64 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getPlaceholderImage(featured.category);
                }}
              />
              <div className={`absolute top-4 left-4 px-2 py-1 rounded text-xs font-medium ${getCategoryColor(featured.category)}`}>
                {featured.category.charAt(0).toUpperCase() + featured.category.slice(1)}
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">{featured.title}</h3>
              {featured.description && (
                <p className="text-sm sm:text-base text-muted-foreground line-clamp-3">{featured.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{featured.source}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{getTimeAgo(featured.publishedAt)}</span>
                </div>
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-accent transition-all"
                  data-testid="featured-news-link"
                >
                  <i className="fas fa-external-link-alt"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="glass-panel animate-pulse">
              <div className="h-32 bg-muted rounded-t-lg mb-4"></div>
              <CardContent className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-panel rounded-xl p-6 border border-destructive/30">
          <div className="flex items-center space-x-2 text-destructive">
            <i className="fas fa-exclamation-triangle"></i>
            <span className="font-medium">Failed to load news</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Unable to fetch news from RSS feeds. Please try again later.
          </p>
        </div>
      )}

      {/* News Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {newsData.map((article, index) => (
            <Card 
              key={`${article.url}-${index}`} 
              className="news-card glass-panel rounded-xl hover:shadow-lg cursor-pointer transition-all"
              data-testid={`news-card-${index}`}
            >
              <div className="relative">
                <img
                  src={article.imageUrl || getPlaceholderImage(article.category)}
                  alt={article.title}
                  className="w-full h-32 object-cover rounded-t-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getPlaceholderImage(article.category);
                  }}
                />
                <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${getCategoryColor(article.category)}`}>
                  {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                </div>
              </div>
              
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{getTimeAgo(article.publishedAt)}</span>
                </div>
                
                <h3 className="font-semibold text-foreground leading-tight line-clamp-2">
                  {article.title}
                </h3>
                
                {article.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{article.source}</span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:text-accent transition-colors"
                    data-testid={`news-link-${index}`}
                  >
                    <i className="fas fa-external-link-alt text-xs"></i>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && newsData.length === 0 && (
        <div className="glass-panel rounded-xl p-12 text-center">
          <i className="fas fa-newspaper text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-medium text-foreground mb-2">No news available</h3>
          <p className="text-muted-foreground">
            No news articles found for the selected category. Try switching to a different filter.
          </p>
        </div>
      )}

      {/* News Sources Status */}
      <div className="glass-panel rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          {[
            'CoinTelegraph',
            'Yahoo Finance',
            'NewsBTC',
            'MarketWatch',
            'Reuters',
            'Seeking Alpha'
          ].map((source) => (
            <div key={source} className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-muted-foreground">{source}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Last update: 2 minutes ago • Auto-refresh every 10 minutes
        </div>
      </div>
    </div>
  );
}
