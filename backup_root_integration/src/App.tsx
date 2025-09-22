import { useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Slider } from "./components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Badge } from "./components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Checkbox } from "./components/ui/checkbox";
import { Switch } from "./components/ui/switch";
import { Search, Upload, TrendingUp, TrendingDown, Share, Eye, Minus, Plus, Filter, BarChart3, Users, Activity } from "lucide-react";

// Import enhanced components from hlh_hack (relative paths for Next.js)
import EnhancedLaunchPage from "../hlh_hack/src/app/page";
import EnhancedIndexDetailsModal from "../hlh_hack/src/components/IndexDetailsModal";

// Mock data
const mockAssets = [
  { symbol: "BTC", name: "Bitcoin", price: 65432 },
  { symbol: "ETH", name: "Ethereum", price: 2845 },
  { symbol: "SOL", name: "Solana", price: 142 },
  { symbol: "AVAX", name: "Avalanche", price: 28 },
  { symbol: "LINK", name: "Chainlink", price: 14 },
  { symbol: "UNI", name: "Uniswap", price: 8 }
];

const mockIndexes = [
  {
    id: 1,
    name: "DeFi Titans",
    symbol: "DEFI",
    currentPrice: 2847.50,
    dayVolume: 1200000,
    openInterest: 45600000,
    maxLeverage: 10,
    change24h: 12.3,
    change1w: 18.2,
    returnSinceLatest: 45.6,
    status: "Active"
  },
  {
    id: 2,
    name: "AI Future Fund", 
    symbol: "AIFF",
    currentPrice: 1234.67,
    dayVolume: 856000,
    openInterest: 23400000,
    maxLeverage: 5,
    change24h: 8.9,
    change1w: 24.1,
    returnSinceLatest: 67.8,
    status: "Active"
  },
  {
    id: 3,
    name: "Layer 1 Kings",
    symbol: "L1K",
    currentPrice: 5678.90,
    dayVolume: 2100000,
    openInterest: 78900000,
    maxLeverage: 15,
    change24h: 15.7,
    change1w: 22.5,
    returnSinceLatest: 89.2,
    status: "Redeemed"
  }
];

const mockAdminData = [
  { id: 1, timestamp: "2024-01-21 14:30", action: "Index Created", user: "0x1234...5678", details: "DeFi Titans (DEFI)" },
  { id: 2, timestamp: "2024-01-21 14:25", action: "Asset Added", user: "0x8765...4321", details: "BTC to AI Fund" },
  { id: 3, timestamp: "2024-01-21 14:20", action: "Redemption", user: "0x5555...9999", details: "L1K - 50% partial" },
  { id: 4, timestamp: "2024-01-21 14:15", action: "Leverage Updated", user: "0x1111...2222", details: "DEFI leverage: 5x → 8x" },
  { id: 5, timestamp: "2024-01-21 14:10", action: "Index Created", user: "0x3333...4444", details: "Gaming Index (GAME)" }
];

function CoreIndexLaunch() {
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const addAsset = (asset) => {
    if (!selectedAssets.find(a => a.symbol === asset.symbol)) {
      setSelectedAssets([...selectedAssets, {
        ...asset,
        isLong: true,
        purchaseAmountHYPE: 1000,
        purchaseAmountUSDC: 1000,
        allocationRatio: 25,
        leverage: 1
      }]);
    }
  };

  const removeAsset = (symbol) => {
    setSelectedAssets(selectedAssets.filter(a => a.symbol !== symbol));
  };

  const updateAsset = (symbol, updates) => {
    setSelectedAssets(selectedAssets.map(a => 
      a.symbol === symbol ? { ...a, ...updates } : a
    ));
  };

  const filteredAssets = mockAssets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-[#072723] min-h-[900px]">
      {/* Minimal Hero */}
      <div className="px-8 py-4 border-b border-[#A0B5B2]/20">
        <h1 className="text-white font-bold mb-2">Launch</h1>
        <p className="text-[#A0B5B2]">Create, preview, and launch instantly</p>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-8 p-8">
        {/* Left - Basics */}
        <div className="w-1/3 space-y-6">
          <h3 className="text-white font-medium">Basics</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-[#A0B5B2] block mb-2">Index Name</Label>
              <Input 
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                placeholder="Enter index name"
              />
            </div>
            <div>
              <Label className="text-[#A0B5B2] block mb-2">Symbol</Label>
              <Input 
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                placeholder="e.g., MYIDX"
              />
            </div>
            <div>
              <Label className="text-[#A0B5B2] block mb-2">Image Upload</Label>
              <div className="flex gap-2">
                <Input 
                  className="flex-1 bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                  placeholder="Upload image"
                />
                <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]">
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-[#A0B5B2] block mb-2">Description</Label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                placeholder="Describe your index"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-[#A0B5B2] block mb-2">Social Link</Label>
              <Input 
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                placeholder="https://"
              />
            </div>
          </div>
        </div>

        {/* Center - Components */}
        <div className="w-1/3 space-y-6">
          <h3 className="text-white font-medium">Components</h3>
          
          {/* Asset Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10 rounded-[12px]"
              placeholder="Search HyperCore assets..."
            />
          </div>

          {/* Asset Search Results */}
          {searchTerm && (
            <div className="bg-[#0f3a36] rounded-[12px] border border-[#A0B5B2]/20 p-3 space-y-2">
              {filteredAssets.map((asset) => (
                <div 
                  key={asset.symbol}
                  onClick={() => addAsset(asset)}
                  className="flex items-center justify-between p-2 hover:bg-[#072723] rounded-[12px] cursor-pointer"
                >
                  <div>
                    <div className="text-white font-medium">{asset.symbol}</div>
                    <div className="text-[#A0B5B2]">{asset.name}</div>
                  </div>
                  <div className="text-white">${asset.price.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Asset Cards */}
          <div className="space-y-4">
            <Label className="text-[#A0B5B2]">Selected Assets</Label>
            {selectedAssets.length === 0 ? (
              <div className="text-[#A0B5B2]">No assets selected yet</div>
            ) : (
              selectedAssets.map((asset) => (
                <div key={asset.symbol} className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20 space-y-4">
                  {/* Asset Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{asset.symbol}</div>
                      <div className="text-[#A0B5B2]">{asset.name}</div>
                      <div className="text-white">${asset.price.toLocaleString()}</div>
                    </div>
                    <Button 
                      onClick={() => removeAsset(asset.symbol)}
                      variant="outline" 
                      size="sm"
                      className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white rounded-[12px]"
                    >
                      Remove
                    </Button>
                  </div>

                  {/* Long/Short Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-[#A0B5B2]">Position</Label>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!asset.isLong ? 'text-white' : 'text-[#A0B5B2]'}`}>Short</span>
                      <Switch 
                        checked={asset.isLong}
                        onCheckedChange={(checked) => updateAsset(asset.symbol, { isLong: checked })}
                      />
                      <span className={`text-sm ${asset.isLong ? 'text-white' : 'text-[#A0B5B2]'}`}>Long</span>
                    </div>
                  </div>

                  {/* Purchase Amount */}
                  <div className="space-y-2">
                    <Label className="text-[#A0B5B2]">Purchase Amount</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input 
                          type="number"
                          value={asset.purchaseAmountHYPE}
                          onChange={(e) => {
                            const hype = Number(e.target.value);
                            updateAsset(asset.symbol, { 
                              purchaseAmountHYPE: hype, 
                              purchaseAmountUSDC: hype // 1:1 conversion for demo
                            });
                          }}
                          className="bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                          placeholder="HYPE"
                        />
                        <div className="text-xs text-[#A0B5B2] mt-1">HYPE</div>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={asset.purchaseAmountUSDC}
                          readOnly
                          className="bg-[#072723] border-[#A0B5B2]/20 text-[#A0B5B2] rounded-[12px]"
                        />
                        <div className="text-xs text-[#A0B5B2] mt-1">USDC (auto)</div>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Ratio */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#A0B5B2]">Allocation Ratio</Label>
                      <Input 
                        type="number"
                        value={asset.allocationRatio}
                        onChange={(e) => updateAsset(asset.symbol, { allocationRatio: Number(e.target.value) })}
                        className="w-20 bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                        min={0}
                        max={100}
                      />
                    </div>
                    <Slider
                      value={[asset.allocationRatio]}
                      onValueChange={(value) => updateAsset(asset.symbol, { allocationRatio: value[0] })}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Leverage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#A0B5B2]">Leverage</Label>
                      <Input 
                        type="number"
                        value={asset.leverage}
                        onChange={(e) => updateAsset(asset.symbol, { leverage: Number(e.target.value) })}
                        className="w-20 bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                        min={1}
                        max={20}
                        step={0.1}
                      />
                    </div>
                    <Slider
                      value={[asset.leverage]}
                      onValueChange={(value) => updateAsset(asset.symbol, { leverage: value[0] })}
                      min={1}
                      max={20}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {/* Confirm Button */}
                  <Button 
                    className="w-full bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 rounded-[12px]"
                    onClick={() => {
                      // Update preview logic here
                    }}
                  >
                    Confirm & Update Preview
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right - Preview */}
        <div className="w-1/3 space-y-6">
          <h3 className="text-white font-medium">Preview</h3>
          
          {/* Chart */}
          <div className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20">
            <div className="flex gap-2 mb-4">
              <Button className="bg-[#98FCE4] text-[#072723] rounded-[12px]">1D</Button>
              <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] rounded-[12px]">7D</Button>
            </div>
            <div className="h-32 bg-[#072723] rounded-[12px] border border-[#A0B5B2]/20 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-[#A0B5B2]" />
            </div>
          </div>

          {/* Performance */}
          <div className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20">
            <h4 className="text-white font-medium mb-3">Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[#A0B5B2]">Return %</div>
                <div className="text-[#98FCE4] flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +18.2%
                </div>
              </div>
              <div>
                <div className="text-[#A0B5B2]">Max Drawdown</div>
                <div className="text-red-400">-5.8%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f3a36] border-t border-[#A0B5B2]/20 p-4 z-50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-[#A0B5B2]">Required USDC</div>
              <div className="text-white font-medium">$1,250.00</div>
            </div>
            <div>
              <div className="text-[#A0B5B2]">Fee</div>
              <div className="text-white font-medium">$12.50</div>
            </div>
            <div>
              <div className="text-[#A0B5B2]">HYPE Balance</div>
              <div className="text-white font-medium">$5,000.00</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]">
              Inline Swap
            </Button>
            <Button 
              onClick={() => setShowConfirmModal(true)}
              disabled={!indexName || !ticker || selectedAssets.length === 0}
              className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 px-8 rounded-[12px]"
            >
              Launch
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#072723] border border-[#A0B5B2]/20 rounded-[12px] p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-medium mb-4">Confirm Launch</h3>
            <div className="bg-[#0f3a36] rounded-[12px] p-4 mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Index Name:</span>
                <span className="text-white">{indexName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Symbol:</span>
                <span className="text-white">{ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Assets:</span>
                <span className="text-white">{selectedAssets.length} selected</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox 
                checked={understood}
                onCheckedChange={setUnderstood}
              />
              <Label className="text-[#A0B5B2]">
                I understand the risks and fees associated with this index
              </Label>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmModal(false)}
                className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1 rounded-[12px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowSuccessModal(true);
                }}
                disabled={!understood}
                className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 flex-1 rounded-[12px]"
              >
                Confirm Launch
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#072723] border border-[#A0B5B2]/20 rounded-[12px] p-6 max-w-md w-full mx-4 text-center">
            <h3 className="text-white font-medium mb-4">Index Successfully Launched!</h3>
            <div className="bg-[#0f3a36] rounded-[12px] p-4 mb-4">
              <div className="text-white font-medium">{ticker}</div>
              <div className="text-[#A0B5B2]">0x1234...5678</div>
            </div>
            
            <Button 
              className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 w-full rounded-[12px]"
              onClick={() => setShowSuccessModal(false)}
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CoreIndexHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("Date");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [redeemAmount, setRedeemAmount] = useState(100);
  const [redeemType, setRedeemType] = useState("partial");
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

  const filteredIndexes = mockIndexes.filter(index => {
    const matchesSearch = index.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         index.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || index.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (amount) => `$${amount.toLocaleString()}`;
  const formatPercent = (percent) => `${percent >= 0 ? '+' : ''}${percent}%`;

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-[#072723] min-h-[900px]">
      {/* Toolbar */}
      <div className="p-8 border-b border-[#A0B5B2]/20">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10 rounded-[12px]"
              placeholder="Search indexes..."
            />
          </div>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-32 rounded-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#072723] border-[#A0B5B2]/20 rounded-[12px]">
                <SelectItem value="Date">Date</SelectItem>
                <SelectItem value="Return">Return</SelectItem>
                <SelectItem value="A→Z">A→Z</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-36 rounded-[12px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#072723] border-[#A0B5B2]/20 rounded-[12px]">
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Redeemed">Redeemed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Index Cards or Empty State */}
      <div className="p-8">
        {filteredIndexes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIndexes.map((index) => (
              <div key={index.id} className="bg-[#0f3a36] rounded-[12px] p-6 border border-[#A0B5B2]/20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-medium">{index.name}</h3>
                    <div className="text-[#A0B5B2]">{index.symbol}</div>
                  </div>
                  <Badge className={`rounded-[12px] ${
                    index.status === "Active" ? "bg-[#98FCE4] text-[#072723]" : "bg-[#A0B5B2] text-[#072723]"
                  }`}>
                    {index.status}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[#A0B5B2]">Current Price</div>
                      <div className="text-white font-medium">{formatCurrency(index.currentPrice)}</div>
                    </div>
                    <div>
                      <div className="text-[#A0B5B2]">24h Volume</div>
                      <div className="text-white">{formatCurrency(index.dayVolume)}</div>
                    </div>
                    <div>
                      <div className="text-[#A0B5B2]">Open Interest</div>
                      <div className="text-white">{formatCurrency(index.openInterest)}</div>
                    </div>
                    <div>
                      <div className="text-[#A0B5B2]">Max Leverage</div>
                      <div className="text-white">{index.maxLeverage}x</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-[#A0B5B2]">24h Change</div>
                      <div className={`flex items-center gap-1 ${index.change24h >= 0 ? 'text-[#98FCE4]' : 'text-red-400'}`}>
                        {index.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatPercent(index.change24h)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#A0B5B2]">1W Change</div>
                      <div className={`flex items-center gap-1 ${index.change1w >= 0 ? 'text-[#98FCE4]' : 'text-red-400'}`}>
                        {index.change1w >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatPercent(index.change1w)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#A0B5B2]">Return</div>
                      <div className="text-[#98FCE4]">{formatPercent(index.returnSinceLatest)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setSelectedIndex(index);
                      setShowDetailsModal(true);
                    }}
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1 rounded-[12px]"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                  {index.status === "Active" && (
                    <Button 
                      onClick={() => {
                        setSelectedIndex(index);
                        setShowRedeemModal(true);
                      }}
                      variant="outline" 
                      size="sm" 
                      className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white flex-1 rounded-[12px]"
                    >
                      <Minus className="w-4 h-4 mr-1" />
                      Redeem
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]"
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <TrendingUp className="w-16 h-16 text-[#A0B5B2] mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">No indexes yet</h3>
            <p className="text-[#A0B5B2] mb-6">Create your first index to get started</p>
            <Button className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 rounded-[12px]">
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CoreIndexAdmin() {
  const [adminTestTab, setAdminTestTab] = useState("Launch");
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [understood, setUnderstood] = useState(false);
  
  // Hub states
  const [searchTermHub, setSearchTermHub] = useState("");
  const [sortBy, setSortBy] = useState("Date");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [redeemAmount, setRedeemAmount] = useState(100);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

  const addAsset = (asset) => {
    if (!selectedAssets.find(a => a.symbol === asset.symbol)) {
      setSelectedAssets([...selectedAssets, {
        ...asset,
        isLong: true,
        purchaseAmountHYPE: 1000,
        purchaseAmountUSDC: 1000,
        allocationRatio: 25,
        leverage: 1
      }]);
    }
  };

  const removeAsset = (symbol) => {
    setSelectedAssets(selectedAssets.filter(a => a.symbol !== symbol));
  };

  const updateAsset = (symbol, updates) => {
    setSelectedAssets(selectedAssets.map(a => 
      a.symbol === symbol ? { ...a, ...updates } : a
    ));
  };

  const filteredAssets = mockAssets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIndexes = mockIndexes.filter(index => {
    const matchesSearch = index.name.toLowerCase().includes(searchTermHub.toLowerCase()) ||
                         index.symbol.toLowerCase().includes(searchTermHub.toLowerCase());
    const matchesFilter = filterStatus === "All" || index.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (amount) => `${amount.toLocaleString()}`;
  const formatPercent = (percent) => `${percent >= 0 ? '+' : ''}${percent}%`;

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-[#072723] min-h-[900px]">
      {/* Hero with Tab Selection */}
      <div className="px-8 py-6 border-b border-[#A0B5B2]/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold mb-2">Hackathon Testing</h1>
            <p className="text-[#A0B5B2]">Test Launch and Index functionality with dummy data</p>
          </div>
          
          {/* Test Tab Selector */}
          <div className="bg-[#0f3a36] rounded-[12px] p-1 border border-[#A0B5B2]/20">
            <div className="flex">
              {["Launch", "Index"].map((tab) => (
                <Button
                  key={tab}
                  variant={adminTestTab === tab ? "default" : "ghost"}
                  onClick={() => setAdminTestTab(tab)}
                  className={
                    adminTestTab === tab
                      ? "bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 rounded-[12px] px-6"
                      : "text-[#A0B5B2] hover:text-white hover:bg-[#072723] rounded-[12px] px-6"
                  }
                >
                  Test {tab}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Content */}
      {adminTestTab === "Launch" ? (
        <>
          {/* 3-column layout */}
          <div className="flex gap-8 p-8">
            {/* Left - Basics */}
            <div className="w-1/3 space-y-6">
              <h3 className="text-white font-medium">Basics</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-[#A0B5B2] block mb-2">Index Name</Label>
                  <Input 
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value)}
                    className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                    placeholder="Enter index name"
                  />
                </div>
                <div>
                  <Label className="text-[#A0B5B2] block mb-2">Symbol</Label>
                  <Input 
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                    placeholder="e.g., MYIDX"
                  />
                </div>
                <div>
                  <Label className="text-[#A0B5B2] block mb-2">Image Upload</Label>
                  <div className="flex gap-2">
                    <Input 
                      className="flex-1 bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                      placeholder="Upload image"
                    />
                    <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-[#A0B5B2] block mb-2">Description</Label>
                  <Textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                    placeholder="Describe your index"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-[#A0B5B2] block mb-2">Social Link</Label>
                  <Input 
                    value={socialLink}
                    onChange={(e) => setSocialLink(e.target.value)}
                    className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white rounded-[12px]"
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>

            {/* Center - Components */}
            <div className="w-1/3 space-y-6">
              <h3 className="text-white font-medium">Components</h3>
              
              {/* Asset Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10 rounded-[12px]"
                  placeholder="Search HyperCore assets..."
                />
              </div>

              {/* Asset Search Results */}
              {searchTerm && (
                <div className="bg-[#0f3a36] rounded-[12px] border border-[#A0B5B2]/20 p-3 space-y-2">
                  {filteredAssets.map((asset) => (
                    <div 
                      key={asset.symbol}
                      onClick={() => addAsset(asset)}
                      className="flex items-center justify-between p-2 hover:bg-[#072723] rounded-[12px] cursor-pointer"
                    >
                      <div>
                        <div className="text-white font-medium">{asset.symbol}</div>
                        <div className="text-[#A0B5B2]">{asset.name}</div>
                      </div>
                      <div className="text-white">${asset.price.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Asset Cards */}
              <div className="space-y-4">
                <Label className="text-[#A0B5B2]">Selected Assets</Label>
                {selectedAssets.length === 0 ? (
                  <div className="text-[#A0B5B2]">No assets selected yet</div>
                ) : (
                  selectedAssets.map((asset) => (
                    <div key={asset.symbol} className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20 space-y-4">
                      {/* Asset Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{asset.symbol}</div>
                          <div className="text-[#A0B5B2]">{asset.name}</div>
                          <div className="text-white">${asset.price.toLocaleString()}</div>
                        </div>
                        <Button 
                          onClick={() => removeAsset(asset.symbol)}
                          variant="outline" 
                          size="sm"
                          className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white rounded-[12px]"
                        >
                          Remove
                        </Button>
                      </div>

                      {/* Long/Short Toggle */}
                      <div className="flex items-center justify-between">
                        <Label className="text-[#A0B5B2]">Position</Label>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${!asset.isLong ? 'text-white' : 'text-[#A0B5B2]'}`}>Short</span>
                          <Switch 
                            checked={asset.isLong}
                            onCheckedChange={(checked) => updateAsset(asset.symbol, { isLong: checked })}
                          />
                          <span className={`text-sm ${asset.isLong ? 'text-white' : 'text-[#A0B5B2]'}`}>Long</span>
                        </div>
                      </div>

                      {/* Purchase Amount */}
                      <div className="space-y-2">
                        <Label className="text-[#A0B5B2]">Purchase Amount</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Input 
                              type="number"
                              value={asset.purchaseAmountHYPE}
                              onChange={(e) => {
                                const hype = Number(e.target.value);
                                updateAsset(asset.symbol, { 
                                  purchaseAmountHYPE: hype, 
                                  purchaseAmountUSDC: hype
                                });
                              }}
                              className="bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                              placeholder="HYPE"
                            />
                            <div className="text-xs text-[#A0B5B2] mt-1">HYPE</div>
                          </div>
                          <div>
                            <Input 
                              type="number"
                              value={asset.purchaseAmountUSDC}
                              readOnly
                              className="bg-[#072723] border-[#A0B5B2]/20 text-[#A0B5B2] rounded-[12px]"
                            />
                            <div className="text-xs text-[#A0B5B2] mt-1">USDC (auto)</div>
                          </div>
                        </div>
                      </div>

                      {/* Allocation Ratio */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[#A0B5B2]">Allocation Ratio</Label>
                          <Input 
                            type="number"
                            value={asset.allocationRatio}
                            onChange={(e) => updateAsset(asset.symbol, { allocationRatio: Number(e.target.value) })}
                            className="w-20 bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                            min={0}
                            max={100}
                          />
                        </div>
                        <Slider
                          value={[asset.allocationRatio]}
                          onValueChange={(value) => updateAsset(asset.symbol, { allocationRatio: value[0] })}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Leverage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[#A0B5B2]">Leverage</Label>
                          <Input 
                            type="number"
                            value={asset.leverage}
                            onChange={(e) => updateAsset(asset.symbol, { leverage: Number(e.target.value) })}
                            className="w-20 bg-[#072723] border-[#A0B5B2]/20 text-white rounded-[12px]"
                            min={1}
                            max={20}
                            step={0.1}
                          />
                        </div>
                        <Slider
                          value={[asset.leverage]}
                          onValueChange={(value) => updateAsset(asset.symbol, { leverage: value[0] })}
                          min={1}
                          max={20}
                          step={0.1}
                          className="w-full"
                        />
                      </div>

                      {/* Confirm Button */}
                      <Button 
                        className="w-full bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 rounded-[12px]"
                        onClick={() => {
                          // Update preview logic here
                        }}
                      >
                        Confirm & Update Preview
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right - Preview */}
            <div className="w-1/3 space-y-6">
              <h3 className="text-white font-medium">Preview</h3>
              
              {/* Chart */}
              <div className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20">
                <div className="flex gap-2 mb-4">
                  <Button className="bg-[#98FCE4] text-[#072723] rounded-[12px]">1D</Button>
                  <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] rounded-[12px]">7D</Button>
                </div>
                <div className="h-32 bg-[#072723] rounded-[12px] border border-[#A0B5B2]/20 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-[#A0B5B2]" />
                </div>
              </div>

              {/* Performance */}
              <div className="bg-[#0f3a36] rounded-[12px] p-4 border border-[#A0B5B2]/20">
                <h4 className="text-white font-medium mb-3">Performance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[#A0B5B2]">Return %</div>
                    <div className="text-[#98FCE4] flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      +18.2%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#A0B5B2]">Max Drawdown</div>
                    <div className="text-red-400">-5.8%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#0f3a36] border-t border-[#A0B5B2]/20 p-4 z-50">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-[#A0B5B2]">Required USDC</div>
                  <div className="text-white font-medium">$1,250.00</div>
                </div>
                <div>
                  <div className="text-[#A0B5B2]">Fee</div>
                  <div className="text-white font-medium">$12.50</div>
                </div>
                <div>
                  <div className="text-[#A0B5B2]">HYPE Balance</div>
                  <div className="text-white font-medium">$5,000.00</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]">
                  Inline Swap
                </Button>
                <Button 
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!indexName || !ticker || selectedAssets.length === 0}
                  className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 px-8 rounded-[12px]"
                >
                  Launch
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Index Hub Test */
        <>
          {/* Toolbar */}
          <div className="p-8 border-b border-[#A0B5B2]/20">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
                <Input 
                  value={searchTermHub}
                  onChange={(e) => setSearchTermHub(e.target.value)}
                  className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10 rounded-[12px]"
                  placeholder="Search indexes..."
                />
              </div>
              <div className="flex items-center gap-4">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-32 rounded-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#072723] border-[#A0B5B2]/20 rounded-[12px]">
                    <SelectItem value="Date">Date</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                    <SelectItem value="A��Z">A→Z</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-36 rounded-[12px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#072723] border-[#A0B5B2]/20 rounded-[12px]">
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Redeemed">Redeemed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Index Cards Grid */}
          <div className="p-8">
            {filteredIndexes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIndexes.map((index) => (
                  <div key={index.id} className="bg-[#0f3a36] rounded-[12px] p-6 border border-[#A0B5B2]/20">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-white font-medium">{index.name}</h3>
                        <div className="text-[#A0B5B2]">{index.symbol}</div>
                      </div>
                      <Badge className={`rounded-[12px] ${
                        index.status === "Active" ? "bg-[#98FCE4] text-[#072723]" : "bg-[#A0B5B2] text-[#072723]"
                      }`}>
                        {index.status}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[#A0B5B2]">Current Price</div>
                          <div className="text-white font-medium">{formatCurrency(index.currentPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[#A0B5B2]">24h Volume</div>
                          <div className="text-white">{formatCurrency(index.dayVolume)}</div>
                        </div>
                        <div>
                          <div className="text-[#A0B5B2]">Open Interest</div>
                          <div className="text-white">{formatCurrency(index.openInterest)}</div>
                        </div>
                        <div>
                          <div className="text-[#A0B5B2]">Max Leverage</div>
                          <div className="text-white">{index.maxLeverage}x</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-[#A0B5B2]">24h Change</div>
                          <div className={`flex items-center gap-1 ${index.change24h >= 0 ? 'text-[#98FCE4]' : 'text-red-400'}`}>
                            {index.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPercent(index.change24h)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#A0B5B2]">1W Change</div>
                          <div className={`flex items-center gap-1 ${index.change1w >= 0 ? 'text-[#98FCE4]' : 'text-red-400'}`}>
                            {index.change1w >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPercent(index.change1w)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#A0B5B2]">Return</div>
                          <div className="text-[#98FCE4]">{formatPercent(index.returnSinceLatest)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedIndex(index);
                          setShowDetailsModal(true);
                        }}
                        variant="outline" 
                        size="sm" 
                        className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1 rounded-[12px]"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      {index.status === "Active" && (
                        <Button 
                          onClick={() => {
                            setSelectedIndex(index);
                            setShowRedeemModal(true);
                          }}
                          variant="outline" 
                          size="sm" 
                          className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white flex-1 rounded-[12px]"
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Redeem
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]"
                      >
                        <Share className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <TrendingUp className="w-16 h-16 text-[#A0B5B2] mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">No indexes yet</h3>
                <p className="text-[#A0B5B2] mb-6">Create your first index to get started</p>
                <Button className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 rounded-[12px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals (shared) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#072723] border border-[#A0B5B2]/20 rounded-[12px] p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-medium mb-4">Confirm Launch</h3>
            <div className="bg-[#0f3a36] rounded-[12px] p-4 mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Index Name:</span>
                <span className="text-white">{indexName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Symbol:</span>
                <span className="text-white">{ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Assets:</span>
                <span className="text-white">{selectedAssets.length} selected</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox 
                checked={understood}
                onCheckedChange={setUnderstood}
              />
              <Label className="text-[#A0B5B2]">
                I understand the risks and fees associated with this index
              </Label>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmModal(false)}
                className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1 rounded-[12px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowSuccessModal(true);
                }}
                disabled={!understood}
                className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 flex-1 rounded-[12px]"
              >
                Confirm Launch
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#072723] border border-[#A0B5B2]/20 rounded-[12px] p-6 max-w-md w-full mx-4 text-center">
            <h3 className="text-white font-medium mb-4">Index Successfully Launched!</h3>
            <div className="bg-[#0f3a36] rounded-[12px] p-4 mb-4">
              <div className="text-white font-medium">{ticker}</div>
              <div className="text-[#A0B5B2]">0x1234...5678</div>
            </div>
            
            <Button 
              className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 w-full rounded-[12px]"
              onClick={() => setShowSuccessModal(false)}
            >
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Launch");

  return (
    <div className="min-h-screen bg-[#072723] text-white font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 w-full max-w-[1440px] mx-auto px-8 py-6 bg-[#072723] border-b border-[#A0B5B2]/20 px-[32px] py-[16px]">
        <div className="flex items-center justify-between">
          {/* Left - CoreIndex */}
          <div className="font-bold text-white text-[24px] leading-none">
            CoreIndex
          </div>

          {/* Center - Notch tabs */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="bg-[#0f3a36] rounded-full p-1 border border-[#A0B5B2]/20 relative">
              {/* Animated background pill */}
              <div 
                className="absolute top-1 bottom-1 bg-[#98FCE4] rounded-full transition-all duration-300 ease-out"
                style={{
                  right: `calc(${(2 - ["Launch", "Index", "Admin"].indexOf(activeTab)) * 33.333}% + 2px)`,
                  width: 'calc(33.333% - 4px)'
                }}
              />
              
              {/* Tab buttons */}
              <div className="flex relative z-10">
                {["Launch", "Index", "Admin"].map((tab) => (
                  <Button
                    key={tab}
                    variant="ghost"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-6 transition-colors duration-300 w-20 ${
                      activeTab === tab
                        ? "text-[#072723] hover:text-[#072723]"
                        : "text-[#A0B5B2] hover:text-white"
                    }`}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Connect Wallet (floating island style) */}
          <div className="bg-[#0f3a36] rounded-[12px] border border-[#A0B5B2]/20 p-1">
            <Button 
              variant="ghost"
              className="text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] rounded-[12px]"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full">
        {activeTab === "Launch" && <EnhancedLaunchPage />}
        {activeTab === "Index" && <CoreIndexHub />}
        {activeTab === "Admin" && <CoreIndexAdmin />}
      </div>
    </div>
  );
}