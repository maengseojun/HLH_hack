import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Search, Upload, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts";

const mockChartData = [
  { date: "Sep 14", value: 100 },
  { date: "Sep 15", value: 105 },
  { date: "Sep 16", value: 98 },
  { date: "Sep 17", value: 112 },
  { date: "Sep 18", value: 108 },
  { date: "Sep 19", value: 115 },
  { date: "Sep 20", value: 122 },
  { date: "Sep 21", value: 118 }
];

const mockAssets = [
  { symbol: "BTC", name: "Bitcoin", price: "$65,432" },
  { symbol: "ETH", name: "Ethereum", price: "$2,845" },
  { symbol: "SOL", name: "Solana", price: "$142" },
  { symbol: "AVAX", name: "Avalanche", price: "$28" }
];

export function CoreIndexLaunch() {
  const [selectedAssets, setSelectedAssets] = useState<Array<{symbol: string, name: string, weight: number}>>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [chartPeriod, setChartPeriod] = useState("7D");
  const [leverage, setLeverage] = useState("Low");
  const [understood, setUnderstood] = useState(false);

  const addAsset = (asset: typeof mockAssets[0]) => {
    if (!selectedAssets.find(a => a.symbol === asset.symbol)) {
      setSelectedAssets([...selectedAssets, { ...asset, weight: 25 }]);
    }
  };

  const removeAsset = (symbol: string) => {
    setSelectedAssets(selectedAssets.filter(a => a.symbol !== symbol));
  };

  const updateWeight = (symbol: string, weight: number) => {
    setSelectedAssets(selectedAssets.map(a => 
      a.symbol === symbol ? { ...a, weight: weight } : a
    ));
  };

  const totalCost = 1250.00;
  const fee = 12.50;
  const hybeBalance = 5000.00;

  const handleLaunch = () => {
    setShowConfirmModal(true);
  };

  const confirmLaunch = () => {
    setShowConfirmModal(false);
    setShowSuccessModal(true);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-[#072723] min-h-[900px]">
      {/* Compact Hero */}
      <div className="px-8 py-6 border-b border-[#A0B5B2]/20">
        <h1 className="text-white font-bold mb-2">CoreIndex Launch</h1>
        <p className="text-[#A0B5B2]">Create, preview, and launch instantly</p>
      </div>

      {/* Main 3-column layout */}
      <div className="flex gap-8 p-8">
        {/* Left Column - Basics */}
        <div className="w-1/3 space-y-6">
          <div className="space-y-4">
            <h3 className="text-white font-medium">Basics</h3>
            
            <div className="space-y-2">
              <Label htmlFor="indexName" className="text-[#A0B5B2]">Index Name</Label>
              <Input 
                id="indexName"
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white"
                placeholder="Enter index name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker" className="text-[#A0B5B2]">Ticker</Label>
              <Input 
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white"
                placeholder="e.g., MYIDX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover" className="text-[#A0B5B2]">Cover Image</Label>
              <div className="flex gap-2">
                <Input 
                  id="cover"
                  className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white flex-1"
                  placeholder="Upload image"
                />
                <Button variant="outline" size="icon" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723]">
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#A0B5B2]">Description</Label>
              <Textarea 
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white"
                placeholder="Describe your index"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social" className="text-[#A0B5B2]">Social Link (Optional)</Label>
              <Input 
                id="social"
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white"
                placeholder="https://"
              />
            </div>
          </div>
        </div>

        {/* Center Column - Components */}
        <div className="w-1/3 space-y-6">
          <div className="space-y-4">
            <h3 className="text-white font-medium">Components</h3>
            
            {/* Asset Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10"
                placeholder="Search assets..."
              />
            </div>

            {/* Asset Search Results */}
            {searchTerm && (
              <div className="bg-[#0f3a36] rounded-lg border border-[#A0B5B2]/20 p-3 space-y-2">
                {mockAssets.filter(asset => 
                  asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((asset) => (
                  <div 
                    key={asset.symbol}
                    onClick={() => addAsset(asset)}
                    className="flex items-center justify-between p-2 hover:bg-[#072723] rounded cursor-pointer"
                  >
                    <div>
                      <div className="text-white font-medium">{asset.symbol}</div>
                      <div className="text-[#A0B5B2]">{asset.name}</div>
                    </div>
                    <div className="text-white">{asset.price}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Assets */}
            <div className="space-y-3">
              <Label className="text-[#A0B5B2]">Selected Assets</Label>
              {selectedAssets.map((asset) => (
                <div key={asset.symbol} className="bg-[#0f3a36] rounded-lg p-4 border border-[#A0B5B2]/20">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white font-medium">{asset.symbol}</div>
                      <div className="text-[#A0B5B2]">{asset.name}</div>
                    </div>
                    <Button 
                      onClick={() => removeAsset(asset.symbol)}
                      variant="outline" 
                      size="sm"
                      className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#A0B5B2]">Weight</Label>
                      <span className="text-white">{asset.weight}%</span>
                    </div>
                    <Slider
                      value={[asset.weight]}
                      onValueChange={(value) => updateWeight(asset.symbol, value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Leverage Presets */}
            <div className="space-y-2">
              <Label className="text-[#A0B5B2]">Leverage</Label>
              <div className="flex gap-2">
                {["Low", "Mid", "High"].map((level) => (
                  <Button
                    key={level}
                    onClick={() => setLeverage(level)}
                    variant={leverage === level ? "default" : "outline"}
                    className={leverage === level ? 
                      "bg-[#98FCE4] text-[#072723]" : 
                      "bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723]"
                    }
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="w-1/3 space-y-6">
          <div className="space-y-4">
            <h3 className="text-white font-medium">Preview</h3>
            
            {/* Chart */}
            <div className="bg-[#0f3a36] rounded-lg p-4 border border-[#A0B5B2]/20">
              {/* Replaced Radix Tabs with simple segmented control to ensure clickability */}
              <div className="mb-4 inline-flex rounded-xl p-1 bg-[#072723] border border-[#A0B5B2]/20">
                {["7D","1M"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      chartPeriod === p
                        ? "bg-[#98FCE4] text-[#072723]"
                        : "text-[#A0B5B2] hover:bg-[#0f3a36]"
                    }`}
                    aria-pressed={chartPeriod === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
              
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData}>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[#A0B5B2]" />
                    <YAxis axisLine={false} tickLine={false} className="text-[#A0B5B2]" />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#98FCE4" 
                      fill="#98FCE4" 
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-[#0f3a36] rounded-lg p-4 border border-[#A0B5B2]/20 space-y-3">
              <h4 className="text-white font-medium">Performance</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[#A0B5B2]">Return %</div>
                  <div className="text-[#98FCE4] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +18.2%
                  </div>
                </div>
                <div>
                  <div className="text-[#A0B5B2]">Max DD</div>
                  <div className="text-red-400">-5.8%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer - Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f3a36] border-t border-[#A0B5B2]/20 p-4">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-[#A0B5B2]">Total Cost</div>
              <div className="text-white font-medium">{totalCost.toFixed(2)} HYPE</div>
            </div>
            <div>
              <div className="text-[#A0B5B2]">Fee</div>
              <div className="text-white font-medium">{fee.toFixed(2)} HYPE</div>
            </div>
            <div>
              <div className="text-[#A0B5B2]">HYPE Balance</div>
              <div className="text-white font-medium">{hybeBalance.toFixed(2)} HYPE</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723]">
              Inline Swap
            </Button>
            <Button 
              onClick={handleLaunch}
              disabled={!indexName || !ticker || selectedAssets.length === 0}
              className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 px-8"
            >
              Launch
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-[#072723] border-[#A0B5B2]/20">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Launch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#0f3a36] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Index Name:</span>
                <span className="text-white">{indexName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Ticker:</span>
                <span className="text-white">{ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Assets:</span>
                <span className="text-white">{selectedAssets.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0B5B2]">Total Cost:</span>
                <span className="text-white">{totalCost.toFixed(2)} HYPE</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="understand"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked as boolean)}
              />
              <Label htmlFor="understand" className="text-[#A0B5B2]">
                I understand the risks and fees associated with this index
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmModal(false)}
                className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmLaunch}
                disabled={!understood}
                className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 flex-1"
              >
                Confirm Launch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-[#072723] border-[#A0B5B2]/20">
          <DialogHeader>
            <DialogTitle className="text-white text-center">Index Successfully Launched!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="bg-[#0f3a36] rounded-lg p-4">
              <div className="text-white font-medium">{ticker}</div>
              <div className="text-[#A0B5B2]">0x1234...5678</div>
            </div>
            
            <Button 
              className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90 w-full"
              onClick={() => setShowSuccessModal(false)}
            >
              Share
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
