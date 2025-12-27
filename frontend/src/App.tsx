import { useState } from 'react'
import StockSelector from './components/StockSelector'
import PortfolioInput from './components/PortfolioInput'
import StockAnalysis from './components/StockAnalysis'
import ChatInterface from './components/ChatInterface'
import { BarChart3, TrendingUp, DollarSign, MessageCircle } from 'lucide-react'

interface Position {
  symbol: string
  shares: number
  avgCost: number
  currentPrice?: number
}

interface AnalysisResult {
  symbol: string
  analysis_type: string
  summary: string
  key_metrics: {
    trend: string
    rsi?: number
    sentiment: string
    has_position: boolean
  }
  recommendation: string
  confidence_score: number
  timestamp: string
}

function App() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<Position[]>([])
  const [currentPrices, setCurrentPrices] = useState<{ [symbol: string]: number }>({})
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  const handleStockSelect = (symbol: string) => {
    setSelectedStock(symbol)
  }

  const handleAnalysisUpdate = (result: AnalysisResult) => {
    setAnalysisResult(result)
  }

  const handlePortfolioUpdate = (positions: Position[]) => {
    setPortfolio(positions)
    // 更新当前价格
    const prices: { [symbol: string]: number } = {}
    positions.forEach(pos => {
      if (pos.currentPrice) {
        prices[pos.symbol] = pos.currentPrice
      }
    })
    setCurrentPrices(prices)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">智能股票分析平台</h1>
                <p className="text-sm text-gray-500">基于AI的股票投资建议</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>实时数据</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <DollarSign className="h-4 w-4 mr-1" />
                <span>Alpha Vantage</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <StockSelector 
              onStockSelect={handleStockSelect} 
              selectedStock={selectedStock}
            />
            <PortfolioInput 
              onPortfolioUpdate={handlePortfolioUpdate}
              currentPrices={currentPrices}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            <StockAnalysis 
              symbol={selectedStock || ''}
              portfolio={portfolio}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
            
            {/* AI对话助手 */}
            {analysisResult && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center p-4 border-b border-gray-200">
                  <MessageCircle className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800">AI分析助手</h3>
                </div>
                <ChatInterface 
                  symbol={selectedStock || ''}
                  analysisResult={analysisResult}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2024 智能股票分析平台. 基于Alpha Vantage API和LangGraph AI技术</p>
            <p className="mt-1">投资有风险，入市需谨慎。本分析仅供参考，不构成投资建议。</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App