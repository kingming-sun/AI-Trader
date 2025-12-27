import { useState } from 'react'
import { Plus, Trash2, DollarSign, TrendingUp } from 'lucide-react'

interface Position {
  symbol: string
  shares: number
  avgCost: number
  currentPrice?: number
}

interface PortfolioInputProps {
  onPortfolioUpdate: (positions: Position[]) => void
  currentPrices: { [symbol: string]: number }
}

export default function PortfolioInput({ onPortfolioUpdate, currentPrices }: PortfolioInputProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [newPosition, setNewPosition] = useState({ symbol: '', shares: 0, avgCost: 0 })

  const addPosition = () => {
    if (!newPosition.symbol.trim() || newPosition.shares <= 0 || newPosition.avgCost <= 0) {
      return
    }

    const position: Position = {
      symbol: newPosition.symbol.toUpperCase().trim(),
      shares: newPosition.shares,
      avgCost: newPosition.avgCost,
      currentPrice: currentPrices[newPosition.symbol.toUpperCase().trim()]
    }

    const updatedPositions = [...positions, position]
    setPositions(updatedPositions)
    onPortfolioUpdate(updatedPositions)
    
    // 重置输入
    setNewPosition({ symbol: '', shares: 0, avgCost: 0 })
  }

  const removePosition = (index: number) => {
    const updatedPositions = positions.filter((_, i) => i !== index)
    setPositions(updatedPositions)
    onPortfolioUpdate(updatedPositions)
  }

  const calculateTotalValue = () => {
    return positions.reduce((total, position) => {
      const currentPrice = currentPrices[position.symbol] || position.currentPrice || 0
      return total + (position.shares * currentPrice)
    }, 0)
  }

  const calculateTotalCost = () => {
    return positions.reduce((total, position) => {
      return total + (position.shares * position.avgCost)
    }, 0)
  }

  const calculateTotalPnL = () => {
    const totalValue = calculateTotalValue()
    const totalCost = calculateTotalCost()
    return totalValue - totalCost
  }

  const calculatePnLPercentage = () => {
    const totalCost = calculateTotalCost()
    if (totalCost === 0) return 0
    return (calculateTotalPnL() / totalCost) * 100
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <DollarSign className="h-6 w-6 text-green-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-800">我的持仓</h2>
      </div>

      {/* 添加持仓 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="股票代码"
          value={newPosition.symbol}
          onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <input
          type="number"
          placeholder="持股数量"
          value={newPosition.shares || ''}
          onChange={(e) => setNewPosition({ ...newPosition, shares: parseInt(e.target.value) || 0 })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <input
          type="number"
          placeholder="平均成本"
          step="0.01"
          value={newPosition.avgCost || ''}
          onChange={(e) => setNewPosition({ ...newPosition, avgCost: parseFloat(e.target.value) || 0 })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          onClick={addPosition}
          disabled={!newPosition.symbol.trim() || newPosition.shares <= 0 || newPosition.avgCost <= 0}
          className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-1" />
          添加
        </button>
      </div>

      {/* 持仓列表 */}
      {positions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">当前持仓</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">股票代码</th>
                  <th className="text-right py-2">持股数量</th>
                  <th className="text-right py-2">平均成本</th>
                  <th className="text-right py-2">当前价格</th>
                  <th className="text-right py-2">市值</th>
                  <th className="text-right py-2">盈亏</th>
                  <th className="text-right py-2">盈亏率</th>
                  <th className="text-center py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => {
                  const currentPrice = currentPrices[position.symbol] || position.currentPrice || 0
                  const marketValue = position.shares * currentPrice
                  const cost = position.shares * position.avgCost
                  const pnl = marketValue - cost
                  const pnlPercentage = (pnl / cost) * 100

                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{position.symbol}</td>
                      <td className="text-right py-2">{position.shares.toLocaleString()}</td>
                      <td className="text-right py-2">${position.avgCost.toFixed(2)}</td>
                      <td className="text-right py-2">${currentPrice.toFixed(2)}</td>
                      <td className="text-right py-2">${marketValue.toFixed(2)}</td>
                      <td className={`text-right py-2 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className={`text-right py-2 ${pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                      </td>
                      <td className="text-center py-2">
                        <button
                          onClick={() => removePosition(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 总计 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">总成本</div>
                <div className="font-semibold">${calculateTotalCost().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600">总市值</div>
                <div className="font-semibold">${calculateTotalValue().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-600">总盈亏</div>
                <div className={`font-semibold ${calculateTotalPnL() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateTotalPnL() >= 0 ? '+' : ''}${calculateTotalPnL().toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">总盈亏率</div>
                <div className={`font-semibold ${calculatePnLPercentage() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculatePnLPercentage() >= 0 ? '+' : ''}{calculatePnLPercentage().toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>暂无持仓数据</p>
          <p className="text-sm">添加您的持仓信息以获得个性化分析</p>
        </div>
      )}
    </div>
  )
}