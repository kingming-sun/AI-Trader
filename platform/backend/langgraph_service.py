from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
import httpx
import asyncio
import os
from datetime import datetime
import structlog

logger = structlog.get_logger()

# 状态定义
class AnalysisState(TypedDict):
    symbol: str
    analysis_type: str
    messages: List[BaseMessage]
    stock_data: Dict[str, Any]
    technical_data: Dict[str, Any]
    news_data: List[Dict[str, Any]]
    analysis_result: Dict[str, Any]
    recommendation: str
    confidence_score: float
    portfolio: Optional[Dict[str, Any]]

# LangGraph Agent服务
class StockAnalysisAgent:
    def __init__(self):
        self.api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
        self.base_url = "https://www.alphavantage.co/query"
        self.mcp_server_url = os.getenv("ALPHA_VANTAGE_MCP_SERVER_URL", "https://mcp.alphavantage.co/mcp")
        self.client = httpx.AsyncClient(timeout=30.0)
        self.graph = self._build_analysis_graph()
    
    def _build_analysis_graph(self) -> StateGraph:
        """构建分析图"""
        workflow = StateGraph(AnalysisState)
        
        # 添加节点
        workflow.add_node("data_collection", self._collect_stock_data)
        workflow.add_node("technical_analysis", self._perform_technical_analysis)
        workflow.add_node("news_sentiment_analysis", self._analyze_news_sentiment)
        workflow.add_node("portfolio_analysis", self._analyze_portfolio_context)
        workflow.add_node("synthesize_recommendation", self._synthesize_recommendation)
        
        # 设置边（顺序执行，避免并发更新冲突）
        workflow.add_edge(START, "data_collection")
        workflow.add_edge("data_collection", "technical_analysis")
        workflow.add_edge("technical_analysis", "news_sentiment_analysis")
        # 根据是否需要投资组合分析选择下一步
        workflow.add_conditional_edges(
            "news_sentiment_analysis",
            self._should_analyze_portfolio,
            {
                True: "portfolio_analysis",
                False: "synthesize_recommendation"
            }
        )
        workflow.add_edge("portfolio_analysis", "synthesize_recommendation")
        workflow.add_edge("synthesize_recommendation", END)
        
        return workflow.compile()
    
    def _should_analyze_portfolio(self, state: AnalysisState) -> bool:
        """判断是否需要进行投资组合分析"""
        return state.get("portfolio") is not None and len(state["portfolio"]) > 0
    
    async def _collect_stock_data(self, state: AnalysisState) -> AnalysisState:
        """收集股票基础数据"""
        symbol = state["symbol"]
        logger.info(f"开始收集股票数据: {symbol}")
        
        try:
            # 获取实时报价
            quote_params = {
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.api_key
            }
            
            quote_response = await self.client.get(self.base_url, params=quote_params)
            quote_data = quote_response.json().get("Global Quote", {})
            
            # 获取公司概览
            overview_params = {
                "function": "OVERVIEW",
                "symbol": symbol,
                "apikey": self.api_key
            }
            
            overview_response = await self.client.get(self.base_url, params=overview_params)
            overview_data = overview_response.json()
            
            # 获取历史数据
            history_params = {
                "function": "TIME_SERIES_DAILY",
                "symbol": symbol,
                "apikey": self.api_key
            }
            
            history_response = await self.client.get(self.base_url, params=history_params)
            history_data = history_response.json().get("Time Series (Daily)", {})
            
            state["stock_data"] = {
                "quote": quote_data,
                "overview": overview_data,
                "history": history_data,
                "collected_at": datetime.now().isoformat()
            }
            
            state["messages"].append(AIMessage(content=f"成功收集 {symbol} 的基础数据"))
            logger.info(f"股票数据收集完成: {symbol}")
            
        except Exception as e:
            logger.error(f"收集股票数据失败: {symbol}", error=str(e))
            state["messages"].append(AIMessage(content=f"数据收集失败: {str(e)}"))
            state["stock_data"] = {"error": str(e)}
        
        return state
    
    async def _perform_technical_analysis(self, state: AnalysisState) -> AnalysisState:
        """执行技术分析"""
        symbol = state["symbol"]
        logger.info(f"开始技术分析: {symbol}")
        
        try:
            # 获取多个技术指标
            indicators = ["SMA", "RSI", "MACD", "BBANDS"]
            technical_data = {}
            
            for indicator in indicators:
                params = {
                    "function": indicator,
                    "symbol": symbol,
                    "interval": "daily",
                    "time_period": "20",
                    "series_type": "close",
                    "apikey": self.api_key
                }
                
                response = await self.client.get(self.base_url, params=params)
                data = response.json()
                technical_data[indicator] = data
            
            # 简单的技术分析逻辑
            sma_data = technical_data.get("SMA", {}).get("Technical Analysis: SMA", {})
            rsi_data = technical_data.get("RSI", {}).get("Technical Analysis: RSI", {})
            
            latest_sma = None
            latest_rsi = None
            
            if sma_data:
                latest_date = sorted(sma_data.keys())[0]
                latest_sma = float(sma_data[latest_date].get("SMA", 0))
            
            if rsi_data:
                latest_date = sorted(rsi_data.keys())[0]
                latest_rsi = float(rsi_data[latest_date].get("RSI", 50))
            
            state["technical_data"] = {
                "indicators": technical_data,
                "analysis": {
                    "sma": latest_sma,
                    "rsi": latest_rsi,
                    "trend": "bullish" if latest_rsi and latest_rsi > 50 else "bearish",
                    "strength": "strong" if latest_rsi and (latest_rsi > 70 or latest_rsi < 30) else "moderate"
                }
            }
            
            state["messages"].append(AIMessage(content=f"技术分析完成: {symbol}"))
            logger.info(f"技术分析完成: {symbol}")
            
        except Exception as e:
            logger.error(f"技术分析失败: {symbol}", error=str(e))
            state["technical_data"] = {"error": str(e)}
            state["messages"].append(AIMessage(content=f"技术分析失败: {str(e)}"))
        
        return state
    
    async def _analyze_news_sentiment(self, state: AnalysisState) -> AnalysisState:
        """分析新闻情感"""
        symbol = state["symbol"]
        logger.info(f"开始新闻情感分析: {symbol}")
        
        try:
            # 获取新闻数据
            news_params = {
                "function": "NEWS_SENTIMENT",
                "tickers": symbol,
                "apikey": self.api_key
            }
            
            response = await self.client.get(self.base_url, params=news_params)
            news_data = response.json().get("feed", [])
            
            # 简单的情感分析
            positive_count = 0
            negative_count = 0
            neutral_count = 0
            total_score = 0
            
            for news in news_data[:10]:  # 分析最近10条新闻
                sentiment = news.get("overall_sentiment_label", "neutral")
                score = float(news.get("overall_sentiment_score", 0))
                
                if sentiment == "positive":
                    positive_count += 1
                elif sentiment == "negative":
                    negative_count += 1
                else:
                    neutral_count += 1
                
                total_score += score
            
            avg_sentiment_score = total_score / len(news_data) if news_data else 0
            
            state["news_data"] = {
                "news_items": news_data[:10],
                "sentiment_summary": {
                    "positive": positive_count,
                    "negative": negative_count,
                    "neutral": neutral_count,
                    "average_score": avg_sentiment_score,
                    "overall_sentiment": "positive" if avg_sentiment_score > 0.1 else "negative" if avg_sentiment_score < -0.1 else "neutral"
                }
            }
            
            state["messages"].append(AIMessage(content=f"新闻情感分析完成: {symbol}"))
            logger.info(f"新闻情感分析完成: {symbol}")
            
        except Exception as e:
            logger.error(f"新闻情感分析失败: {symbol}", error=str(e))
            state["news_data"] = {"error": str(e)}
            state["messages"].append(AIMessage(content=f"新闻情感分析失败: {str(e)}"))
        
        return state
    
    async def _analyze_portfolio_context(self, state: AnalysisState) -> AnalysisState:
        """分析投资组合上下文"""
        symbol = state["symbol"]
        portfolio = state.get("portfolio", {})
        
        logger.info(f"开始投资组合分析: {symbol}")
        
        try:
            # 简单的投资组合分析逻辑
            current_position = portfolio.get("positions", {}).get(symbol, {})
            total_value = portfolio.get("total_value", 0)
            
            if current_position:
                position_size = current_position.get("shares", 0)
                avg_cost = current_position.get("avg_cost", 0)
                
                # 计算盈亏
                current_price = float(state["stock_data"].get("quote", {}).get("05. price", 0))
                unrealized_pnl = (current_price - avg_cost) * position_size
                pnl_percentage = (unrealized_pnl / (avg_cost * position_size)) * 100 if avg_cost > 0 else 0
                
                portfolio_analysis = {
                    "has_position": True,
                    "position_size": position_size,
                    "avg_cost": avg_cost,
                    "current_price": current_price,
                    "unrealized_pnl": unrealized_pnl,
                    "pnl_percentage": pnl_percentage,
                    "position_percentage": (position_size * current_price / total_value * 100) if total_value > 0 else 0
                }
            else:
                portfolio_analysis = {
                    "has_position": False,
                    "recommendation": "可以考虑建立小仓位观察"
                }
            
            state["portfolio_context"] = portfolio_analysis
            state["messages"].append(AIMessage(content=f"投资组合分析完成: {symbol}"))
            logger.info(f"投资组合分析完成: {symbol}")
            
        except Exception as e:
            logger.error(f"投资组合分析失败: {symbol}", error=str(e))
            state["portfolio_context"] = {"error": str(e)}
            state["messages"].append(AIMessage(content=f"投资组合分析失败: {str(e)}"))
        
        return state
    
    async def _synthesize_recommendation(self, state: AnalysisState) -> AnalysisState:
        """综合分析和生成建议"""
        symbol = state["symbol"]
        logger.info(f"开始综合分析: {symbol}")
        
        try:
            # 整合所有分析结果
            technical = state.get("technical_data", {}).get("analysis", {})
            sentiment = state.get("news_data", {}).get("sentiment_summary", {})
            portfolio = state.get("portfolio_context", {})
            
            # 生成综合评分
            tech_score = 0
            sentiment_score = 0
            portfolio_score = 0
            
            # 技术分析评分
            if technical.get("trend") == "bullish":
                tech_score = 1
            elif technical.get("trend") == "bearish":
                tech_score = -1
            
            # 情感分析评分
            sentiment_score = sentiment.get("average_score", 0)
            
            # 投资组合评分
            if portfolio.get("has_position"):
                pnl_percentage = portfolio.get("pnl_percentage", 0)
                if pnl_percentage > 10:
                    portfolio_score = -0.5  # 建议获利了结
                elif pnl_percentage < -10:
                    portfolio_score = 0.5   # 可以考虑补仓
            
            # 综合评分
            total_score = tech_score + sentiment_score + portfolio_score
            
            # 生成建议
            if total_score > 0.5:
                recommendation = "BUY"
                confidence = min(0.9, abs(total_score))
            elif total_score < -0.5:
                recommendation = "SELL"
                confidence = min(0.9, abs(total_score))
            else:
                recommendation = "HOLD"
                confidence = 0.6
            
            # 生成分析摘要
            summary_parts = []
            
            if technical:
                summary_parts.append(f"技术分析显示{technical.get('trend', '中性')}趋势")
            
            if sentiment:
                summary_parts.append(f"市场情绪为{sentiment.get('overall_sentiment', '中性')}")
            
            if portfolio.get("has_position"):
                summary_parts.append(f"当前持仓盈亏{portfolio.get('pnl_percentage', 0):.1f}%")
            
            summary = "；".join(summary_parts) if summary_parts else "综合分析显示中性信号"
            
            state["analysis_result"] = {
                "symbol": symbol,
                "recommendation": recommendation,
                "confidence_score": confidence,
                "summary": summary,
                "detailed_scores": {
                    "technical": tech_score,
                    "sentiment": sentiment_score,
                    "portfolio": portfolio_score,
                    "total": total_score
                },
                "key_metrics": {
                    "trend": technical.get("trend", "unknown"),
                    "rsi": technical.get("rsi"),
                    "sentiment": sentiment.get("overall_sentiment", "neutral"),
                    "has_position": portfolio.get("has_position", False)
                }
            }
            
            state["recommendation"] = recommendation
            state["confidence_score"] = confidence
            
            state["messages"].append(AIMessage(content=f"综合分析完成: {symbol} - {recommendation}"))
            logger.info(f"综合分析完成: {symbol} - {recommendation}")
            
        except Exception as e:
            logger.error(f"综合分析失败: {symbol}", error=str(e))
            state["analysis_result"] = {"error": str(e)}
            state["messages"].append(AIMessage(content=f"综合分析失败: {str(e)}"))
        
        return state
    
    async def analyze_stock(self, symbol: str, analysis_type: str = "comprehensive", portfolio: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """执行股票分析"""
        logger.info(f"开始股票分析: {symbol}, 类型: {analysis_type}")
        
        # 根据是否提供持仓信息构建两版提示词
        base_prompt = f"请全面分析股票 {symbol}：消息面、技术面与基本面，并给出买入/持有/卖出建议及置信度。"
        if portfolio and portfolio.get("positions") and portfolio["positions"].get(symbol):
            pos = portfolio["positions"][symbol]
            base_prompt += f" 用户持仓：{pos.get('shares', 0)}股，成本价${pos.get('avg_cost', 0)}；请结合持仓给出加仓/减仓/持有建议。"
        initial_state = AnalysisState(
            symbol=symbol,
            analysis_type=analysis_type,
            messages=[HumanMessage(content=base_prompt)],
            stock_data={},
            technical_data={},
            news_data=[],
            analysis_result={},
            recommendation="",
            confidence_score=0.0,
            portfolio=portfolio
        )
        
        try:
            result = await self.graph.ainvoke(initial_state)
            
            return {
                "symbol": result["symbol"],
                "analysis_type": result["analysis_type"],
                "recommendation": result["recommendation"],
                "confidence_score": result["confidence_score"],
                "summary": result["analysis_result"].get("summary", ""),
                "key_metrics": result["analysis_result"].get("key_metrics", {}),
                "detailed_analysis": {
                    **result["analysis_result"],
                    **({"news_data": result.get("news_data")} if result.get("news_data") else {})
                },
                "messages": [msg.content for msg in result["messages"]],
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"股票分析失败: {symbol}", error=str(e))
            return {
                "symbol": symbol,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# 全局Agent实例
stock_analysis_agent = StockAnalysisAgent()
