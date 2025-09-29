"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

// Work around a Next 15 dev manifest bug by client-only loading
const IndexDetailsModal = dynamic(() => import("@/components/IndexDetailsModal"), { 
  ssr: false,
  loading: () => null
});
const ShareModal = dynamic(() => import("@/components/ShareModal"), { ssr: false });
const RedeemModal = dynamic(() => import("@/components/RedeemModal"), { ssr: false });
const Dropdown = dynamic(() => import("@/components/Dropdown"), { ssr: false });
export type IndexDetails = Parameters<typeof IndexDetailsModal>[0] extends { index: infer T }
  ? T
  : { name: string; symbol: string };

export default function IndexHubPage() {
  const [filterActive, setFilterActive] = useState(true);
  const [filterRedeemed, setFilterRedeemed] = useState(true);
  const [sortBy, setSortBy] = useState("Date");
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<IndexDetails | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Load mock indexes from localStorage
  const [indexes, setIndexes] = useState<IndexDetails[]>([]);
  const [loading, setLoading] = useState(false);

  // Load mock indexes on component mount
  useEffect(() => {
    const loadMockIndexes = () => {
      try {
        const stored = localStorage.getItem('mock-indexes');
        if (stored) {
          const mockIndexes = JSON.parse(stored);
          setIndexes(mockIndexes);
        }
      } catch (error) {
        console.error('Failed to load mock indexes:', error);
      }
    };

    loadMockIndexes();

    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mock-indexes') {
        loadMockIndexes();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Filter and sort indexes
  const filteredIndexes = useMemo(() => {
    let filtered = indexes.filter(index => {
      const isActive = index.status === "Active";
      const isRedeemed = index.status === "Redeemed";
      
      // Apply active/redeemed filters
      if (!filterActive && isActive) return false;
      if (!filterRedeemed && isRedeemed) return false;
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = index.name.toLowerCase().includes(query);
        const matchSymbol = index.symbol.toLowerCase().includes(query);
        if (!matchName && !matchSymbol) return false;
      }
      
      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "Date":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "24h Change":
          const aChange = parseFloat(a.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          const bChange = parseFloat(b.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          return bChange - aChange;
        case "1W Change":
          // Use same as 24h for now, could be different metric
          const aWeekChange = parseFloat(a.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          const bWeekChange = parseFloat(b.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          return bWeekChange - aWeekChange;
        case "A→Z":
          return a.name.localeCompare(b.name);
        case "Lowest MDD":
          // Mock MDD calculation - for now use negative of return
          const aMDD = -parseFloat(a.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          const bMDD = -parseFloat(b.sinceInceptionReturnPct?.replace(/[^-\d.]/g, '') || '0');
          return aMDD - bMDD;
        default:
          return 0;
      }
    });

    return filtered;
  }, [indexes, filterActive, filterRedeemed, searchQuery, sortBy]);

  return (
    <div className="w-full min-h-[70vh]">
      <div className="ui-scale">
        <section className="px-2 pb-6 border-b border-[color:var(--color-border)]">
          <h3 className="text-white font-bold text-2xl mb-2">Index</h3>
          <p className="text-[color:var(--color-muted-foreground)]">View and manage your launched indexes</p>
        </section>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-8 pb-6 border-b border-[color:var(--color-border)]">
          <div className="relative flex-1 max-w-md">
            <div className="glass-input rounded-[12px]">
              <input 
                placeholder="Search indexes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400" 
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter checkboxes (both checked by default) */}
            <div className="glass-input flex items-center gap-4 rounded-[12px] px-3 py-2">
              <label className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  className="size-4 accent-[color:var(--color-primary)]"
                  checked={filterActive}
                  onChange={(e) => setFilterActive(e.target.checked)}
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  className="size-4 accent-[color:var(--color-primary)]"
                  checked={filterRedeemed}
                  onChange={(e) => setFilterRedeemed(e.target.checked)}
                />
                <span className="text-sm">Redeemed</span>
              </label>
            </div>

            {/* Sort dropdown (custom) */}
            <Dropdown
              options={["Date", "24h Change", "1W Change", "A→Z", "Lowest MDD"]}
              value={sortBy}
              onChange={setSortBy}
            />
          </div>
        </div>

        {/* Index Cards */}
        <div className="py-8">
          {filteredIndexes.length === 0 ? (
            // Empty state
            <div className="glass-card rounded-[12px] p-8 text-center">
              <div className="text-[color:var(--color-muted-foreground)] mb-4">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">
                  {indexes.length === 0 ? "No Active Indexes" : "No Results"}
                </h3>
                <p className="text-sm">
                  {indexes.length === 0 
                    ? "Create your first index to get started" 
                    : "Try adjusting your filters or search query"
                  }
                </p>
              </div>
              {indexes.length === 0 && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-6 py-2 hover:opacity-90 transition-opacity"
                >
                  Launch New Index
                </button>
              )}
            </div>
          ) : (
            // Index cards grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIndexes.map((index) => (
                <div key={index.id} className="glass-card rounded-[12px] p-6 hover:bg-[color:var(--color-card)]/90 transition-colors cursor-pointer"
                     onClick={() => {
                       setSelectedIndex(index);
                       setShowDetails(true);
                     }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{index.name}</h3>
                      <p className="text-[color:var(--color-muted-foreground)] text-sm">{index.symbol}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      index.status === "Active" 
                        ? "bg-green-400/20 text-green-400" 
                        : "bg-red-400/20 text-red-400"
                    }`}>
                      {index.status}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[color:var(--color-muted-foreground)] text-sm">Current Value</span>
                      <span className="text-white font-medium">{index.currentValue}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[color:var(--color-muted-foreground)] text-sm">Assets</span>
                      <span className="text-white font-medium">{index.composition?.length || 0}</span>
                    </div>
                    
                    {index.sinceInceptionReturnPct && (
                      <div className="flex justify-between items-center">
                        <span className="text-[color:var(--color-muted-foreground)] text-sm">Return</span>
                        <span className={`font-medium ${
                          index.sinceInceptionReturnPct.startsWith('+') 
                            ? "text-green-400" 
                            : index.sinceInceptionReturnPct.startsWith('-')
                            ? "text-red-400"
                            : "text-white"
                        }`}>
                          {index.sinceInceptionReturnPct}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex(index);
                        setShowShare(true);
                      }}
                      className="flex-1 text-xs py-2 rounded-[8px] border border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-white transition-colors"
                    >
                      Share
                    </button>
                    {index.status === "Active" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIndex(index);
                          setShowRedeem(true);
                        }}
                        className="flex-1 text-xs py-2 rounded-[8px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Redeem
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <IndexDetailsModal open={showDetails} onClose={() => setShowDetails(false)} index={selectedIndex} />
      {/* Redeem Modal */}
      <RedeemModal open={showRedeem} onClose={() => setShowRedeem(false)} index={selectedIndex} />
      {/* Share Modal */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        name={selectedIndex?.name ?? ""}
        symbol={selectedIndex?.symbol ?? ""}
      />
    </div>
  );
}
