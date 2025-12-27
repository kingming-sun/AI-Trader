import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  symbol: string
  analysisResult: any
}

export default function ChatInterface({ symbol, analysisResult }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (symbol && analysisResult) {
      const initialMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `您好！我是AI股票分析助手。我已经为您分析了${symbol}，建议为**${analysisResult.recommendation}**，置信度为${(analysisResult.confidence_score * 100).toFixed(1)}%。\n\n您可以问我关于这只股票的任何问题，比如：\n- 这个建议的依据是什么？\n- 技术面分析的具体情况？\n- 市场消息面对这只股票的影响？\n- 我的持仓情况如何优化？`,
        timestamp: new Date()
      }
      setMessages([initialMessage])
    }
  }, [symbol, analysisResult])

  const generateResponse = async (userMessage: string) => {
    // 模拟AI响应生成
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

    const responses = {
      '建议': `基于当前分析，${symbol}的${analysisResult.recommendation}建议主要考虑了以下因素：\n\n1. 技术分析：${analysisResult.key_metrics.trend}趋势\n2. 市场情绪：${analysisResult.key_metrics.sentiment}\n3. 您的持仓情况：${analysisResult.key_metrics.has_position ? '有持仓' : '无持仓'}\n\n置信度为${(analysisResult.confidence_score * 100).toFixed(1)}%，建议您结合自身风险承受能力做出决策。`,
      
      '技术': `技术面分析显示：\n\n- 趋势：${analysisResult.key_metrics.trend}\n- RSI指标：${analysisResult.key_metrics.rsi ? analysisResult.key_metrics.rsi.toFixed(1) : 'N/A'}\n\n${analysisResult.key_metrics.rsi ? (analysisResult.key_metrics.rsi > 70 ? 'RSI显示超买信号' : analysisResult.key_metrics.rsi < 30 ? 'RSI显示超卖信号' : 'RSI处于正常区间') : ''}\n\n技术分析建议：${analysisResult.key_metrics.trend === 'bullish' ? '当前技术面偏多头' : analysisResult.key_metrics.trend === 'bearish' ? '当前技术面偏空头' : '技术面中性'}`,
      
      '消息': `市场消息分析：\n\n- 整体市场情绪：${analysisResult.key_metrics.sentiment}\n- 新闻情感分析显示${analysisResult.key_metrics.sentiment === 'positive' ? '积极' : analysisResult.key_metrics.sentiment === 'negative' ? '消极' : '中性'}情绪\n\n建议您关注最新的公司公告、行业动态和宏观经济因素，这些都会影响股价走势。`,
      
      '持仓': analysisResult.key_metrics.has_position ? 
        `根据您的持仓情况，我建议：\n\n- 当前有${symbol}的持仓\n- 建议${analysisResult.recommendation === 'SELL' ? '考虑减仓或止盈' : analysisResult.recommendation === 'BUY' ? '可以考虑加仓' : '继续持有并密切关注'}\n\n请注意风险控制，建议单只股票占投资组合比例不超过20%。` :
        `您当前没有${symbol}的持仓。\n\n基于分析结果，建议${analysisResult.recommendation === 'BUY' ? '可以考虑建立小仓位' : analysisResult.recommendation === 'SELL' ? '暂时观望' : '保持关注'}。\n\n投资有风险，建议从小仓位开始，逐步建立头寸。`,
      
      '风险': `风险提示：\n\n1. 市场风险：股价受整体市场环境影响\n2. 行业风险：关注行业发展趋势\n3. 公司风险：留意公司基本面变化\n4. 流动性风险：确保有足够的现金应对突发情况\n\n建议您：\n- 分散投资，不要把所有资金投入单一股票\n- 设置止损点，控制亏损幅度\n- 定期复盘，及时调整投资策略\n- 保持理性，避免情绪化交易`
    }

    // 智能匹配关键词
    let response = responses['建议'] // 默认响应
    
    if (userMessage.includes('技术') || userMessage.includes('指标') || userMessage.includes('趋势')) {
      response = responses['技术']
    } else if (userMessage.includes('消息') || userMessage.includes('新闻') || userMessage.includes('情绪')) {
      response = responses['消息']
    } else if (userMessage.includes('持仓') || userMessage.includes('仓位') || userMessage.includes('头寸')) {
      response = responses['持仓']
    } else if (userMessage.includes('风险') || userMessage.includes('安全') || userMessage.includes('控制')) {
      response = responses['风险']
    }

    return response
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await generateResponse(input.trim())
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后重试，或者换一个方式提问。',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (analysisResult) {
      const initialMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `对话已刷新。当前对${symbol}的分析建议是**${analysisResult.recommendation}**，置信度为${(analysisResult.confidence_score * 100).toFixed(1)}%。\n\n请继续提问！`,
        timestamp: new Date()
      }
      setMessages([initialMessage])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Bot className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">AI分析助手</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          刷新
        </button>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start max-w-xs lg:max-w-md ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' ? 'bg-blue-600 ml-2' : 'bg-gray-300 mr-2'
              }`}>
                {message.role === 'user' ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-gray-600" />
                )}
              </div>
              <div className={`rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-xs lg:max-w-md">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-300 mr-2">
                <Bot className="h-4 w-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="询问关于这只股票的问题..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          提示：可以问"建议"、"技术"、"消息"、"持仓"、"风险"等关键词
        </div>
      </div>
    </div>
  )
}