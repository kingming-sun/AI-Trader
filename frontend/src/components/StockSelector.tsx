import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface StockQuote {
  symbol: string
  price: number
  change: number
  change_percent: number
  volume: number
  timestamp: string
}

interface StockSelectorProps {
  onStockSelect: (symbol: string) => void
  selectedStock: string | null
}

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' }
]

export default function StockSelector({ onStockSelect, selectedStock }: StockSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [stockQuote, setStockQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (symbol: string) => {
    if (!symbol.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stocks/${symbol.toUpperCase()}/quote`)
      if (!response.ok) {
        throw new Error('股票代码不存在或数据获取失败')
      }
      
      const data = await response.json()
      setStockQuote(data)
      onStockSelect(symbol.toUpperCase())
      setSearchTerm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
      setStockQuote(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(searchTerm)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <TrendingUp className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-800">股票选择</h2>
      </div>

      {/* 搜索框 */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="输入股票代码（如：AAPL）"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <button
            type="submit"
            disabled={loading || !searchTerm.trim()}
            className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </form>

      {/* 热门股票 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">热门股票</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {POPULAR_STOCKS.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => handleSearch(stock.symbol)}
              disabled={loading}
              className={`p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 ${
                selectedStock === stock.symbol ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="font-medium text-gray-900">{stock.symbol}</div>
              <div className="text-xs text-gray-500 truncate">{stock.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 股票报价显示 */}
      {stockQuote && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{stockQuote.symbol}</h3>
              <p className="text-2xl font-bold text-gray-900">${stockQuote.price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center ${
                stockQuote.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stockQuote.change >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                <span className="font-medium">
                  {stockQuote.change >= 0 ? '+' : ''}{stockQuote.change.toFixed(2)}
                </span>
              </div>
              <div className={`text-sm ${
                stockQuote.change_percent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stockQuote.change_percent >= 0 ? '+' : ''}{stockQuote.change_percent.toFixed(2)}%
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>成交量</span>
              <span>{stockQuote.volume.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
              <span>更新时间</span>
              <span>{new Date(stockQuote.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
