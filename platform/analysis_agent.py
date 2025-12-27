"""
基于 ReAct 模式的智能股票分析服务
适配 AI-Trader 平台
"""
import os
import re
import json
import asyncio
import requests
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, BaseMessage
from langchain.tools import tool
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

# ==================== 配置管理 ====================
class AgentConfig:
    """Agent 配置"""
    
    # API Keys
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ALPHA_VANTAGE_API_KEY = os.getenv("ALPHAADVANTAGE_API_KEY") or os.getenv("ALPHA_VANTAGE_API_KEY")
    
    # OpenAI 配置
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
    OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0"))
    
    # Alpha Vantage 配置
    ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
    
    # 日志目录
    BASE_DIR = Path(__file__).parent.parent / "data" / "analysis_logs"
    
    @classmethod
    def validate(cls):
        """验证配置"""
        if not cls.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY 未设置")
        if not cls.ALPHA_VANTAGE_API_KEY:
            logger.warning("ALPHA_VANTAGE_API_KEY 未设置")
        
        # 创建日志目录
        cls.BASE_DIR.mkdir(parents=True, exist_ok=True)


# ==================== Alpha Vantage 工具集 ====================
class AlphaVantageClient:
    """Alpha Vantage API 客户端"""
    
    def __init__(self):
        self.base_url = AgentConfig.ALPHA_VANTAGE_BASE_URL
        self.api_key = AgentConfig.ALPHA_VANTAGE_API_KEY
    
    def _request(self, params: Dict) -> Dict:
        """通用请求方法"""
        params["apikey"] = self.api_key
        try:
            response = requests.get(self.base_url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            # 检查API错误
            if "Error Message" in data:
                return {"error": data["Error Message"]}
            if "Note" in data:
                return {"error": "API调用频率超限，请稍后重试"}
            
            return data
        except Exception as e:
            return {"error": f"请求失败: {str(e)}"}

# 全局客户端实例
av_client = AlphaVantageClient()

@tool
def get_stock_price(symbol: str) -> str:
    """
    获取股票的实时价格和基本信息
    参数: symbol: 股票代码，如 'AAPL', 'TSLA'
    """
    params = {"function": "GLOBAL_QUOTE", "symbol": symbol.upper()}
    data = av_client._request(params)
    
    if "error" in data:
        return f"错误: {data['error']}"
    
    quote = data.get("Global Quote", {})
    if not quote:
        # Fallback to daily
        params = {"function": "TIME_SERIES_DAILY", "symbol": symbol.upper()}
        data = av_client._request(params)
        ts = data.get("Time Series (Daily)", {})
        if ts:
            latest = list(ts.keys())[0]
            close = ts[latest]["4. close"]
            return f"实时接口无数据，最近({latest})收盘价: ${close}"
        return f"未找到股票 {symbol} 的数据"
    
    result = f"""
📊 {symbol.upper()} 实时行情：
- 当前价格: ${quote.get('05. price', 'N/A')}
- 涨跌幅: {quote.get('10. change percent', 'N/A')}
- 涨跌额: ${quote.get('09. change', 'N/A')}
- 开盘价: ${quote.get('02. open', 'N/A')}
- 最高价: ${quote.get('03. high', 'N/A')}
- 最低价: ${quote.get('04. low', 'N/A')}
- 成交量: {quote.get('06. volume', 'N/A')}
"""
    return result.strip()

@tool
def get_news(symbol: str, limit: int = 5) -> str:
    """
    获取股票相关的最新新闻和情感分析
    """
    params = {"function": "NEWS_SENTIMENT", "tickers": symbol.upper(), "limit": limit}
    data = av_client._request(params)
    
    if "error" in data:
        return f"错误: {data['error']}"
    
    feed = data.get("feed", [])
    if not feed:
        return f"未找到股票 {symbol} 的相关新闻"
    
    news_list = []
    for idx, item in enumerate(feed[:limit], 1):
        title = item.get("title", "无标题")
        time = item.get("time_published", "")
        summary = item.get("summary", "")[:100]
        news_list.append(f"{idx}. {title}\n   时间: {time}\n   摘要: {summary}...")
    
    result = f"📰 {symbol.upper()} 最新新闻：\n{chr(10).join(news_list)}"
    return result.strip()

@tool
def calculate_indicators(symbol: str) -> str:
    """
    计算股票的关键技术指标(RSI, MACD, SMA)
    """
    # 获取RSI
    rsi_data = av_client._request({
        "function": "RSI", "symbol": symbol.upper(), "interval": "daily", "time_period": 14, "series_type": "close"
    })
    
    # 获取MACD
    macd_data = av_client._request({
        "function": "MACD", "symbol": symbol.upper(), "interval": "daily", "series_type": "close"
    })
    
    result_parts = [f"📈 {symbol.upper()} 技术指标分析："]
    
    # 解析RSI
    if "Technical Analysis: RSI" in rsi_data:
        rsi_values = rsi_data["Technical Analysis: RSI"]
        latest_date = list(rsi_values.keys())[0]
        rsi_value = float(rsi_values[latest_date]["RSI"])
        rsi_status = "超买" if rsi_value > 70 else "超卖" if rsi_value < 30 else "正常"
        result_parts.append(f"- RSI(14): {rsi_value:.2f} ({rsi_status})")
    
    # 解析MACD
    if "Technical Analysis: MACD" in macd_data:
        macd_values = macd_data["Technical Analysis: MACD"]
        latest_date = list(macd_values.keys())[0]
        macd = float(macd_values[latest_date]["MACD"])
        signal = float(macd_values[latest_date]["MACD_Signal"])
        hist = float(macd_values[latest_date]["MACD_Hist"])
        macd_status = "金叉(看涨)" if hist > 0 else "死叉(看跌)"
        result_parts.append(f"- MACD: {macd:.4f}, Signal: {signal:.4f}, Hist: {hist:.4f} ({macd_status})")
    
    if len(result_parts) == 1:
        return f"无法获取 {symbol} 的技术指标数据"
    
    return "\n".join(result_parts)

@tool
def get_company_info(symbol: str) -> str:
    """获取公司基本面信息"""
    params = {"function": "OVERVIEW", "symbol": symbol.upper()}
    data = av_client._request(params)
    
    if "error" in data or "Symbol" not in data:
        return f"未找到股票 {symbol} 的公司信息"
    
    result = f"""
🏢 {data.get('Name', 'N/A')} ({symbol.upper()})
- 行业: {data.get('Industry', 'N/A')}
- 市值: ${data.get('MarketCapitalization', 'N/A')}
- PE比率: {data.get('PERatio', 'N/A')}
- EPS: ${data.get('EPS', 'N/A')}
- 52周最高/最低: ${data.get('52WeekHigh', 'N/A')} / ${data.get('52WeekLow', 'N/A')}
简介: {data.get('Description', 'N/A')[:100]}...
"""
    return result.strip()

def get_all_tools():
    return [get_stock_price, get_news, calculate_indicators, get_company_info]

# ==================== 结果解析器 ====================
class ResultParser:
    def parse(self, agent_result: Dict[str, Any]) -> Dict[str, Any]:
        final_answer = agent_result.get("final_answer", "")
        recommendation = self._parse_recommendation(final_answer)
        confidence_score = self._parse_confidence(final_answer)
        return {
            "recommendation": recommendation,
            "confidence_score": confidence_score,
            "key_metrics": {} 
        }
    
    def _parse_recommendation(self, text: str) -> str:
        text_lower = text.lower()
        if any(k in text_lower for k in ['卖出', 'sell', '减仓']): return "SELL"
        if any(k in text_lower for k in ['买入', 'buy', '建仓']): return "BUY"
        return "HOLD"
    
    def _parse_confidence(self, text: str) -> float:
        match = re.search(r'(\d+(?:\.\d+)?)%', text)
        if match: return float(match.group(1)) / 100.0
        return 0.7

# ==================== 主服务类 ====================
class StockAnalysisAgent:
    def __init__(self):
        AgentConfig.validate()
        self.llm = ChatOpenAI(
            model=AgentConfig.OPENAI_MODEL,
            temperature=AgentConfig.OPENAI_TEMPERATURE,
            api_key=AgentConfig.OPENAI_API_KEY
        )
        self.tools = get_all_tools()
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        self.parser = ResultParser()
        self.histories: Dict[str, List[BaseMessage]] = {}
        
    async def analyze_stock(self, symbol: str, portfolio: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """执行股票分析"""
        query = f"请全面分析股票 {symbol.upper()}，包括消息面、技术面、基本面。最后给出买入/持有/卖出建议和置信度。"
        if portfolio and portfolio.get("positions"):
            pos = portfolio["positions"].get(symbol, {})
            if pos:
                query += f"\n用户持仓：{pos.get('shares', 0)}股，成本${pos.get('avg_cost', 0)}。"
        
        messages = [HumanMessage(content=query)]
        intermediate_steps = []
        tools_map = {t.name: t for t in self.tools}
        
        try:
            final_answer = ""
            for _ in range(6):
                ai = await asyncio.to_thread(self.llm_with_tools.invoke, messages)
                tool_calls = getattr(ai, "tool_calls", None)
                if not tool_calls:
                    final_answer = ai.content
                    break
                messages.append(ai)
                for call in tool_calls:
                    name = call["name"]
                    tool_obj = tools_map.get(name)
                    output = str(tool_obj.invoke(call["args"])) if tool_obj else f"未知工具: {name}"
                    intermediate_steps.append({"tool": name, "output": output})
                    messages.append(ToolMessage(content=output, tool_call_id=call["id"]))
            else:
                final_answer = ai.content

            # 解析结果
            agent_result = {"final_answer": final_answer}
            parsed = self.parser.parse(agent_result)
            
            # 提取或生成 key_metrics
            key_metrics = {
                "trend": "neutral", # 默认为中性
                "rsi": None,
                "sentiment": "neutral",
                "has_position": False
            }
            
            # 尝试从中间步骤或最终答案中提取指标
            # 简单规则提取
            lower_answer = final_answer.lower()
            if "bullish" in lower_answer or "看涨" in lower_answer or "uptrend" in lower_answer:
                key_metrics["trend"] = "bullish"
            elif "bearish" in lower_answer or "看跌" in lower_answer or "downtrend" in lower_answer:
                key_metrics["trend"] = "bearish"
                
            if "positive" in lower_answer or "乐观" in lower_answer:
                key_metrics["sentiment"] = "positive"
            elif "negative" in lower_answer or "悲观" in lower_answer:
                key_metrics["sentiment"] = "negative"
                
            # 尝试提取 RSI
            rsi_match = re.search(r'RSI.*?(\d+(?:\.\d+)?)', final_answer, re.IGNORECASE)
            if rsi_match:
                key_metrics["rsi"] = float(rsi_match.group(1))
            
            if portfolio and portfolio.get("positions") and symbol.upper() in portfolio["positions"]:
                key_metrics["has_position"] = True

            # 保存历史
            self.histories[symbol.upper()] = messages + [AIMessage(content=final_answer)]
            
            return {
                "symbol": symbol.upper(),
                "analysis_type": "comprehensive",
                "summary": final_answer,
                "recommendation": parsed["recommendation"],
                "confidence_score": parsed["confidence_score"],
                "key_metrics": key_metrics,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"分析失败: {e}")
            return {"error": str(e)}

    async def answer_question(self, symbol: str, question: str) -> Dict[str, Any]:
        """回答问题"""
        history = self.histories.get(symbol.upper(), [])
        messages = history + [HumanMessage(content=question)]
        tools_map = {t.name: t for t in self.tools}
        
        try:
            final_answer = ""
            for _ in range(6):
                ai = await asyncio.to_thread(self.llm_with_tools.invoke, messages)
                tool_calls = getattr(ai, "tool_calls", None)
                if not tool_calls:
                    final_answer = ai.content
                    break
                messages.append(ai)
                for call in tool_calls:
                    tool_obj = tools_map.get(call["name"])
                    output = str(tool_obj.invoke(call["args"])) if tool_obj else "Error"
                    messages.append(ToolMessage(content=output, tool_call_id=call["id"]))
            else:
                final_answer = ai.content
                
            self.histories[symbol.upper()] = messages + [AIMessage(content=final_answer)]
            return {"content": final_answer, "timestamp": datetime.now().isoformat()}
        except Exception as e:
            return {"error": str(e)}

# 全局实例
stock_analysis_agent = StockAnalysisAgent()
