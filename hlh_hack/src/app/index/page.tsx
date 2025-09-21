"use client";

import { useState } from "react";
import IndexDetailsModal, { type IndexDetails } from "@/components/IndexDetailsModal";
import ShareModal from "@/components/ShareModal";
import RedeemModal from "@/components/RedeemModal";
import Dropdown from "@/components/Dropdown";

export default function IndexHubPage() {
  const [filterActive, setFilterActive] = useState(true);
  const [filterRedeemed, setFilterRedeemed] = useState(true);
  const [sortBy, setSortBy] = useState("Date");
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<IndexDetails | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // TODO: Replace with actual API call
  const [indexes, setIndexes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

        {/* Index Cards - Now empty, ready for real data */}
        <div className="py-8">
          <div className="glass-card rounded-[12px] p-8 text-center">
            <div className="text-[color:var(--color-muted-foreground)] mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">No Active Indexes</h3>
              <p className="text-sm">Create your first index to get started</p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-6 py-2 hover:opacity-90 transition-opacity"
            >
              Launch New Index
            </button>
          </div>
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
