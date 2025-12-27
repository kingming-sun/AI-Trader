import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, BarChart3, Clock, Target } from 'lucide-react'

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

interface StockAnalysisProps {
  symbol: string
  portfolio: any[]
  onAnalysisUpdate: (result: any) => void
}

export default function StockAnalysis({ symbol, portfolio, onAnalysisUpdate }: StockAnalysisProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (symbol) {
      analyzeStock()
    }
  }, [symbol, portfolio])

  const analyzeStock = async () => {
    setLoading(true)
    setError('')

    try {
      const portfolioData = portfolio.length > 0 ? {
        positions: portfolio.reduce((acc, pos) => {
          acc[pos.symbol] = {
            shares: pos.shares,
            avg_cost: pos.avgCost
          }
          return acc
        }, {} as Record<string, { shares: number; avg_cost: number }>),
        total_value: portfolio.reduce((total, pos) => total + (pos.shares * (pos.currentPrice || 0)), 0)
      } : null

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/analysis/${symbol}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis_type: 'comprehensive',
          time_period: '1m',
          portfolio: portfolioData
        })
      })

      if (!response.ok) {
        throw new Error('分析请求失败')
      }

      const data = await response.json()
      setAnalysisResult(data)
      onAnalysisUpdate(data) // 通知父组件更新分析结果
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
      setAnalysisResult(null)
      onAnalysisUpdate(null)
    } finally {
      setLoading(false)
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation.toUpperCase()) {
      case 'BUY':
        return 'text-green-600 bg-green-100'
      case 'SELL':
        return 'text-red-600 bg-red-100'
      case 'HOLD':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend.toLowerCase()) {
      case 'bullish':
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case 'bearish':
        return <TrendingDown className="h-5 w-5 text-red-600" />
      default:
        return <BarChart3 className="h-5 w-5 text-gray-600" />
    }
  }

  if (!symbol) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">选择股票开始分析</h3>
        <p className="text-gray-500">请先选择一个股票代码来获取智能分析</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">正在分析中...</h3>
        <p className="text-gray-500">请稍等，我们正在为您生成深度分析报告</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <Target className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">分析失败</h3>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!analysisResult) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">智能分析报告</h2>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            {new Date(analysisResult.timestamp).toLocaleString()}
          </span>
        </div>
      </div>

      {/* 核心建议 */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">投资建议</h3>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(analysisResult.recommendation)}`}>
                {analysisResult.recommendation}
              </span>
              <span className="text-sm text-gray-600">
                置信度: {(analysisResult.confidence_score * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{analysisResult.symbol}</div>
            <div className="text-sm text-gray-500">分析类型: {analysisResult.analysis_type}</div>
          </div>
        </div>
      </div>

      {/* 分析摘要 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">分析摘要</h3>
        <p className="text-gray-700 leading-relaxed">{analysisResult.summary}</p>
      </div>

      {/* 关键指标 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">关键指标</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              {getTrendIcon(analysisResult.key_metrics.trend)}
              <span className="ml-2 text-sm font-medium text-gray-600">技术趋势</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {analysisResult.key_metrics.trend}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span className="ml-2 text-sm font-medium text-gray-600">RSI指标</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {analysisResult.key_metrics.rsi ? analysisResult.key_metrics.rsi.toFixed(1) : 'N/A'}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="ml-2 text-sm font-medium text-gray-600">市场情绪</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {analysisResult.key_metrics.sentiment}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Target className="h-5 w-5 text-orange-600" />
              <span className="ml-2 text-sm font-medium text-gray-600">持仓状态</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {analysisResult.key_metrics.has_position ? '有持仓' : '无持仓'}
            </div>
          </div>
        </div>
      </div>

      {/* 详细分析 */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">详细分析</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      </div>

      {/* 重新分析按钮 */}
      <div className="mt-6 text-center">
        <button
          onClick={analyzeStock}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '分析中...' : '重新分析'}
        </button>
      </div>
    </div>
  )
}
