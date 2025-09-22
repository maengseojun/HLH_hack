import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Search, Filter, TrendingUp, TrendingDown, Share, Eye, Minus, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const mockIndexes = [
  {
    id: 1,
    name: "DeFi Titans",
    ticker: "DEFI",
    currentValue: "$2,847.50",
    returns: {
      "5m": "+2.1%",
      "1h": "+5.4%", 
      "1d": "+12.3%",
      "7d": "+18.2%",
      "1m": "+45.6%"
    },
    status: "Active",
    nav: "$2,847.50",
    composition: [
      { asset: "UNI", percentage: 30, value: "$854.25" },
      { asset: "AAVE", percentage: 25, value: "$711.88" },
      { asset: "COMP", percentage: 20, value: "$569.50" },
      { asset: "SUSHI", percentage: 15, value: "$427.13" },
      { asset: "CRV", percentage: 10, value: "$284.75" }
    ]
  },
  {
    id: 2,
    name: "AI Future Fund",
    ticker: "AIFF",
    currentValue: "$1,234.67",
    returns: {
      "5m": "-0.5%",
      "1h": "+1.2%",
      "1d": "+8.9%", 
      "7d": "+24.1%",
      "1m": "+67.8%"
    },
    status: "Active",
    nav: "$1,234.67",
    composition: [
      { asset: "RENDER", percentage: 35, value: "$432.13" },
      { asset: "FET", percentage: 25, value: "$308.67" },
      { asset: "OCEAN", percentage: 20, value: "$246.93" },
      { asset: "AGIX", percentage: 20, value: "$246.93" }
    ]
  },
  {
    id: 3,
    name: "Layer 1 Kings",
    ticker: "L1K",
    currentValue: "$5,678.90",
    returns: {
      "5m": "+0.8%",
      "1h": "+3.4%",
      "1d": "+15.7%",
      "7d": "+22.5%", 
      "1m": "+89.2%"
    },
    status: "Redeemed",
    nav: "$5,678.90",
    composition: [
      { asset: "ETH", percentage: 40, value: "$2,271.56" },
      { asset: "SOL", percentage: 30, value: "$1,703.67" },
      { asset: "AVAX", percentage: 20, value: "$1,135.78" },
      { asset: "DOT", percentage: 10, value: "$567.89" }
    ]
  }
];

const mockChartData = [
  { date: "Sep 14", value: 100 },
  { date: "Sep 15", value: 108 },
  { date: "Sep 16", value: 115 },
  { date: "Sep 17", value: 125 },
  { date: "Sep 18", value: 118 },
  { date: "Sep 19", value: 132 },
  { date: "Sep 20", value: 145 },
  { date: "Sep 21", value: 142 }
];

export function CoreIndexHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("Date");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedTimeframe, setSelectedTimeframe] = useState("7d");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<typeof mockIndexes[0] | null>(null);
  const [redeemAmount, setRedeemAmount] = useState(100);
  const [redeemType, setRedeemType] = useState("partial");
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

  const filteredIndexes = mockIndexes.filter(index => {
    const matchesSearch = index.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         index.ticker.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || index.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const openDetails = (index: typeof mockIndexes[0]) => {
    setSelectedIndex(index);
    setShowDetailsModal(true);
  };

  const openRedeem = (index: typeof mockIndexes[0]) => {
    setSelectedIndex(index);
    setShowRedeemModal(true);
  };

  const getReturnColor = (returnStr: string) => {
    return returnStr.startsWith('+') ? 'text-[#98FCE4]' : 'text-red-400';
  };

  const getReturnIcon = (returnStr: string) => {
    return returnStr.startsWith('+') ? 
      <TrendingUp className="w-3 h-3" /> : 
      <TrendingDown className="w-3 h-3" />;
  };

  const expectedRefund = selectedIndex ? 
    (parseFloat(selectedIndex.currentValue.replace('$', '').replace(',', '')) * (redeemAmount / 100)).toFixed(2) :
    "0.00";

  const COLORS = ['#98FCE4', '#D7EAE8', '#A0B5B2', '#72a59a', '#5a8a7f'];

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-[#072723] min-h-[900px]">
      {/* Toolbar */}
      <div className="p-8 border-b border-[#A0B5B2]/20">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A0B5B2]" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white pl-10"
              placeholder="Search indexes..."
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#072723] border-[#A0B5B2]/20">
                <SelectItem value="Date" className="text-white hover:bg-[#0f3a36]">Date</SelectItem>
                <SelectItem value="Return" className="text-white hover:bg-[#0f3a36]">Return</SelectItem>
                <SelectItem value="A→Z" className="text-white hover:bg-[#0f3a36]">A→Z</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white w-36">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#072723] border-[#A0B5B2]/20">
                <SelectItem value="All" className="text-white hover:bg-[#0f3a36]">All</SelectItem>
                <SelectItem value="Active" className="text-white hover:bg-[#0f3a36]">Active</SelectItem>
                <SelectItem value="Redeemed" className="text-white hover:bg-[#0f3a36]">Redeemed</SelectItem>
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
              <div key={index.id} className="bg-[#0f3a36] rounded-lg p-6 border border-[#A0B5B2]/20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-medium">{index.name}</h3>
                    <div className="text-[#A0B5B2]">{index.ticker}</div>
                  </div>
                  <Badge 
                    variant={index.status === "Active" ? "default" : "secondary"}
                    className={index.status === "Active" ? 
                      "bg-[#98FCE4] text-[#072723]" : 
                      "bg-[#A0B5B2] text-[#072723]"
                    }
                  >
                    {index.status}
                  </Badge>
                </div>

                <div className="mb-4">
                  <div className="text-white font-medium mb-2">{index.currentValue}</div>
                  
                  {/* Return Timeframes */}
                  <div className="flex items-center gap-2 mb-2">
                    {Object.entries(index.returns).map(([timeframe, returnValue]) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          selectedTimeframe === timeframe 
                            ? 'bg-[#98FCE4] text-[#072723]' 
                            : 'bg-[#072723] text-[#A0B5B2] hover:bg-[#98FCE4] hover:text-[#072723]'
                        }`}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>

                  <div className={`flex items-center gap-1 ${getReturnColor(index.returns[selectedTimeframe as keyof typeof index.returns])}`}>
                    {getReturnIcon(index.returns[selectedTimeframe as keyof typeof index.returns])}
                    {index.returns[selectedTimeframe as keyof typeof index.returns]}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => openDetails(index)}
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                  {index.status === "Active" && (
                    <Button 
                      onClick={() => openRedeem(index)}
                      variant="outline" 
                      size="sm" 
                      className="bg-transparent border-red-400 text-red-400 hover:bg-red-400 hover:text-white flex-1"
                    >
                      <Minus className="w-4 h-4 mr-1" />
                      Redeem
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723]"
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16">
            <div className="mb-4">
              <TrendingUp className="w-16 h-16 text-[#A0B5B2] mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">No indexes yet</h3>
              <p className="text-[#A0B5B2] mb-6">Create your first index to get started</p>
            </div>
            <Button className="bg-[#98FCE4] text-[#072723] hover:bg-[#98FCE4]/90">
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-[#072723] border-[#A0B5B2]/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Index Details</DialogTitle>
          </DialogHeader>
          {selectedIndex && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-[#A0B5B2]">Index Name</div>
                  <div className="text-white font-medium">{selectedIndex.name}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[#A0B5B2]">Ticker</div>
                  <div className="text-white font-medium">{selectedIndex.ticker}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[#A0B5B2]">Current NAV</div>
                  <div className="text-white font-medium">{selectedIndex.nav}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[#A0B5B2]">Status</div>
                  <Badge 
                    variant={selectedIndex.status === "Active" ? "default" : "secondary"}
                    className={selectedIndex.status === "Active" ? 
                      "bg-[#98FCE4] text-[#072723]" : 
                      "bg-[#A0B5B2] text-[#072723]"
                    }
                  >
                    {selectedIndex.status}
                  </Badge>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-[#0f3a36] rounded-lg p-4">
                <h4 className="text-white font-medium mb-4">Performance Chart</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockChartData}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-[#A0B5B2]" />
                      <YAxis axisLine={false} tickLine={false} className="text-[#A0B5B2]" />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#98FCE4" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Composition */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#0f3a36] rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">Composition</h4>
                  <div className="space-y-3">
                    {selectedIndex.composition.map((item, index) => (
                      <div key={item.asset} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-white">{item.asset}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white">{item.percentage}%</div>
                          <div className="text-[#A0B5B2]">{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#0f3a36] rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">Allocation</h4>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedIndex.composition}
                          cx="50%"
                          cy="50%"
                          innerRadius={20}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="percentage"
                        >
                          {selectedIndex.composition.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Redeem Modal */}
      <Dialog open={showRedeemModal} onOpenChange={setShowRedeemModal}>
        <DialogContent className="bg-[#072723] border-[#A0B5B2]/20">
          <DialogHeader>
            <DialogTitle className="text-white">Redeem Index</DialogTitle>
          </DialogHeader>
          {selectedIndex && (
            <div className="space-y-4">
              <div className="bg-[#0f3a36] rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">{selectedIndex.name} ({selectedIndex.ticker})</h4>
                <div className="text-[#A0B5B2]">Current Value: {selectedIndex.currentValue}</div>
              </div>

              <Tabs value={redeemType} onValueChange={setRedeemType}>
                <TabsList className="bg-[#0f3a36] w-full">
                  <TabsTrigger 
                    value="partial" 
                    className="flex-1 data-[state=active]:bg-[#98FCE4] data-[state=active]:text-[#072723]"
                  >
                    Partial Redemption
                  </TabsTrigger>
                  <TabsTrigger 
                    value="full" 
                    className="flex-1 data-[state=active]:bg-[#98FCE4] data-[state=active]:text-[#072723]"
                  >
                    Full Redemption
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="partial" className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[#A0B5B2]">Redemption Amount</Label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Input
                            type="number"
                            value={redeemAmount}
                            onChange={(e) => setRedeemAmount(Number(e.target.value))}
                            min={1}
                            max={100}
                            className="bg-[#0f3a36] border-[#A0B5B2]/20 text-white"
                          />
                        </div>
                        <span className="text-white">%</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="full" className="mt-4">
                  <div className="text-[#A0B5B2]">
                    You will redeem 100% of your position in this index.
                  </div>
                </TabsContent>
              </Tabs>

              <div className="bg-[#0f3a36] rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#A0B5B2]">Expected Refund:</span>
                  <span className="text-white">${expectedRefund}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A0B5B2]">Redemption Fee:</span>
                  <span className="text-white">0.5%</span>
                </div>
                <div className="border-t border-[#A0B5B2]/20 pt-2">
                  <div className="flex justify-between">
                    <span className="text-white font-medium">Net Amount:</span>
                    <span className="text-white font-medium">${(parseFloat(expectedRefund) * 0.995).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="risk"
                  checked={acknowledgeRisk}
                  onCheckedChange={(checked) => setAcknowledgeRisk(checked as boolean)}
                />
                <Label htmlFor="risk" className="text-[#A0B5B2]">
                  I acknowledge the redemption risks and understand this action is irreversible
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRedeemModal(false)}
                  className="bg-transparent border-[#D7EAE8] text-[#D7EAE8] hover:bg-[#D7EAE8] hover:text-[#072723] flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  disabled={!acknowledgeRisk}
                  className="bg-red-500 text-white hover:bg-red-600 flex-1"
                  onClick={() => setShowRedeemModal(false)}
                >
                  Redeem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}