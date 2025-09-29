"use client";

interface LaunchSuccessModalProps {
  open: boolean;
  onClose: () => void;
  indexName: string;
  ticker: string;
}

export default function LaunchSuccessModal({
  open,
  onClose,
  indexName,
  ticker,
}: LaunchSuccessModalProps) {
  if (!open) return null;

  const handleShare = () => {
    const shareText = `Created ${indexName} (${ticker}) index successfully!`;
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const handleViewIndexes = () => {
    // Clear any drafts and navigate to indexes page
    localStorage.removeItem('launch-draft');
    window.location.href = '/indexes';
  };

  const handleCreateAnother = () => {
    // Clear drafts and stay on launch page
    localStorage.removeItem('launch-draft');
    // Reset any form states if needed
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md glass-card rounded-[16px] p-6 m-4">
        <div className="text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center mb-4">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Index Launched Successfully!</h2>
            <p className="text-[color:var(--color-muted-foreground)]">
              Your {indexName} ({ticker}) index is now live and trading.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="w-full rounded-[12px] border border-[color:var(--color-border)] px-4 py-3 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-white transition-colors"
            >
              Share Index
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={handleViewIndexes}
                className="flex-1 rounded-[12px] bg-[color:var(--color-primary)] px-4 py-3 text-[color:var(--color-primary-foreground)] font-medium hover:opacity-90 transition-opacity"
              >
                View My Indexes
              </button>
              <button
                onClick={handleCreateAnother}
                className="flex-1 rounded-[12px] border border-[color:var(--color-border)] px-4 py-3 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-white transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}