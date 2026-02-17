"""
AICRM System - Data Analytics & AI Processing
数据分析和AI处理模块
"""
import json
import asyncio
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from loguru import logger

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI library not available")

try:
    from anthropic import AsyncAnthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic library not available")

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
import re


class AnalysisType(Enum):
    """分析类型"""
    SENTIMENT = "sentiment"  # 情感分析
    KEYWORD_EXTRACTION = "keyword_extraction"  # 关键词提取
    ENTITY_RECOGNITION = "entity_recognition"  # 实体识别
    TOPIC_MODELING = "topic_modeling"  # 主题建模
    CUSTOMER_SEGMENTATION = "customer_segmentation"  # 客户细分
    PREDICTION = "prediction"  # 预测分析
    CLASSIFICATION = "classification"  # 分类
    SUMMARIZATION = "summarization"  # 摘要生成


class ModelProvider(Enum):
    """模型提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"


@dataclass
class AnalysisResult:
    """分析结果"""
    success: bool
    analysis_type: AnalysisType
    data: Any = None
    confidence: float = 0.0
    model_used: str = None
    metadata: Dict = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "success": self.success,
            "analysis_type": self.analysis_type.value,
            "data": self.data,
            "confidence": self.confidence,
            "model_used": self.model_used,
            "metadata": self.metadata,
            "error": self.error
        }


class DataProcessor:
    """数据预处理器"""

    @staticmethod
    def clean_text(text: str) -> str:
        """清理文本数据"""
        if not text:
            return ""

        # 移除HTML标签
        text = re.sub(r'<[^>]+>', '', text)

        # 移除特殊字符但保留中文、英文、数字和基本标点
        text = re.sub(r'[^\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9\s,。!?;:、""''（）()【】「」]', '', text)

        # 移除多余空白
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    @staticmethod
    def extract_email(text: str) -> List[str]:
        """提取邮箱地址"""
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        return re.findall(pattern, text)

    @staticmethod
    def extract_phone(text: str) -> List[str]:
        """提取电话号码"""
        patterns = [
            r'1[3-9]\d{9}',  # 中国手机号
            r'\d{3,4}-\d{7,8}',  # 座机
            r'\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}'  # 国际格式
        ]
        phones = []
        for pattern in patterns:
            phones.extend(re.findall(pattern, text))
        return phones

    @staticmethod
    def extract_wechat(text: str) -> List[str]:
        """提取微信号"""
        pattern = r'(?:微信|WeChat|wechat)[:：]?\s*([a-zA-Z0-9_-]{6,20})'
        return re.findall(pattern, text)

    @staticmethod
    def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """标准化DataFrame"""
        # 移除完全重复的行
        df = df.drop_duplicates()

        # 移除全为空的列
        df = df.dropna(axis=1, how='all')

        # 填充缺失值
        for col in df.columns:
            if df[col].dtype in ['object', 'string']:
                df[col] = df[col].fillna('')
            else:
                df[col] = df[col].fillna(df[col].median() if df[col].dtype in ['int64', 'float64'] else 0)

        return df


class SentimentAnalyzer:
    """情感分析器"""

    def __init__(self, provider: ModelProvider = ModelProvider.OPENAI, api_key: str = None):
        self.provider = provider
        self.api_key = api_key

        if provider == ModelProvider.OPENAI and OPENAI_AVAILABLE:
            self.client = AsyncOpenAI(api_key=api_key)
        elif provider == ModelProvider.ANTHROPIC and ANTHROPIC_AVAILABLE:
            self.client = AsyncAnthropic(api_key=api_key)
        else:
            self.client = None

    async def analyze(self, text: str) -> AnalysisResult:
        """分析文本情感"""
        try:
            text = DataProcessor.clean_text(text)

            if not text:
                return AnalysisResult(
                    success=False,
                    analysis_type=AnalysisType.SENTIMENT,
                    error="Empty text after cleaning"
                )

            if self.provider == ModelProvider.OPENAI and self.client:
                return await self._analyze_with_openai(text)
            elif self.provider == ModelProvider.ANTHROPIC and self.client:
                return await self._analyze_with_anthropic(text)
            else:
                return await self._analyze_with_rules(text)

        except Exception as e:
            logger.error(f"Sentiment analysis failed: {str(e)}")
            return AnalysisResult(
                success=False,
                analysis_type=AnalysisType.SENTIMENT,
                error=str(e)
            )

    async def _analyze_with_openai(self, text: str) -> AnalysisResult:
        """使用OpenAI分析"""
        response = await self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {
                    "role": "system",
                    "content": "You are a sentiment analyzer. Analyze the sentiment of the given text and respond with a JSON object containing: sentiment (positive/negative/neutral), score (-1 to 1), confidence (0 to 1), and key_topics (array of strings)."
                },
                {
                    "role": "user",
                    "content": f"Analyze the sentiment of this text: {text}"
                }
            ],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)

        return AnalysisResult(
            success=True,
            analysis_type=AnalysisType.SENTIMENT,
            data=result,
            confidence=result.get("confidence", 0.8),
            model_used="gpt-4-turbo-preview"
        )

    async def _analyze_with_anthropic(self, text: str) -> AnalysisResult:
        """使用Anthropic分析"""
        response = await self.client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze the sentiment of this text. Respond with a JSON object containing:
{{
    "sentiment": "positive/negative/neutral",
    "score": -1.0 to 1.0,
    "confidence": 0.0 to 1.0,
    "key_topics": ["topic1", "topic2"]
}}

Text to analyze: {text}"""
                }
            ]
        )

        result_text = response.content[0].text
        # 提取JSON（可能在markdown代码块中）
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        result = json.loads(result_text)

        return AnalysisResult(
            success=True,
            analysis_type=AnalysisType.SENTIMENT,
            data=result,
            confidence=result.get("confidence", 0.8),
            model_used="claude-3-opus"
        )

    async def _analyze_with_rules(self, text: str) -> AnalysisResult:
        """使用规则分析"""
        # 简单规则引擎
        positive_words = ['好', '优秀', '棒', '满意', '喜欢', '推荐', '不错', 'positive', 'good', 'great', 'excellent']
        negative_words = ['差', '坏', '糟糕', '不满意', '失望', '差劲', '问题', 'negative', 'bad', 'terrible', 'poor']

        text_lower = text.lower()

        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count:
            sentiment = "positive"
            score = min(0.8, 0.3 + positive_count * 0.1)
        elif negative_count > positive_count:
            sentiment = "negative"
            score = max(-0.8, -0.3 - negative_count * 0.1)
        else:
            sentiment = "neutral"
            score = 0.0

        return AnalysisResult(
            success=True,
            analysis_type=AnalysisType.SENTIMENT,
            data={
                "sentiment": sentiment,
                "score": score,
                "confidence": 0.6,
                "key_topics": []
            },
            confidence=0.6,
            model_used="rule-based"
        )


class EntityExtractor:
    """实体提取器"""

    def __init__(self, provider: ModelProvider = ModelProvider.OPENAI, api_key: str = None):
        self.provider = provider
        self.api_key = api_key

        if provider == ModelProvider.OPENAI and OPENAI_AVAILABLE:
            self.client = AsyncOpenAI(api_key=api_key)
        elif provider == ModelProvider.ANTHROPIC and ANTHROPIC_AVAILABLE:
            self.client = AsyncAnthropic(api_key=api_key)
        else:
            self.client = None

    async def extract(self, text: str) -> AnalysisResult:
        """提取实体"""
        try:
            text = DataProcessor.clean_text(text)

            if not text:
                return AnalysisResult(
                    success=False,
                    analysis_type=AnalysisType.ENTITY_RECOGNITION,
                    error="Empty text"
                )

            # 先使用规则提取基础实体
            entities = {
                "emails": DataProcessor.extract_email(text),
                "phones": DataProcessor.extract_phone(text),
                "wechats": DataProcessor.extract_wechat(text)
            }

            # 如果有AI服务，提取更复杂的实体
            if self.client:
                ai_entities = await self._extract_with_ai(text)
                entities.update(ai_entities)

            return AnalysisResult(
                success=True,
                analysis_type=AnalysisType.ENTITY_RECOGNITION,
                data=entities,
                confidence=0.8,
                model_used=self.provider.value
            )

        except Exception as e:
            logger.error(f"Entity extraction failed: {str(e)}")
            return AnalysisResult(
                success=False,
                analysis_type=AnalysisType.ENTITY_RECOGNITION,
                error=str(e)
            )

    async def _extract_with_ai(self, text: str) -> Dict:
        """使用AI提取实体"""
        if self.provider == ModelProvider.OPENAI:
            response = await self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract entities from the text. Respond with JSON containing: companies, people, locations, products, dates, prices, and other relevant entities."
                    },
                    {
                        "role": "user",
                        "content": f"Extract entities from: {text}"
                    }
                ],
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return result

        elif self.provider == ModelProvider.ANTHROPIC:
            response = await self.client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": f"Extract entities (companies, people, locations, products, dates, prices) from this text. Respond with JSON: {text}"
                }]
            )

            result_text = response.content[0].text
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()

            return json.loads(result_text)

        return {}


class CustomerSegmentation:
    """客户细分"""

    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = None
        self.vectorizer = TfidfVectorizer(max_features=100)

    async def segment(
        self,
        data: pd.DataFrame,
        features: List[str] = None,
        n_clusters: int = 5
    ) -> AnalysisResult:
        """
        客户细分分析

        Args:
            data: 客户数据DataFrame
            features: 用于细分的特征列名
            n_clusters: 聚类数量

        Returns:
            AnalysisResult: 细分结果
        """
        try:
            # 数据预处理
            data = DataProcessor.normalize_dataframe(data)

            if features is None:
                features = data.select_dtypes(include=[np.number]).columns.tolist()

            if len(features) == 0:
                return AnalysisResult(
                    success=False,
                    analysis_type=AnalysisType.CUSTOMER_SEGMENTATION,
                    error="No numeric features available for segmentation"
                )

            # 提取特征
            X = data[features].values

            # 标准化
            X_scaled = self.scaler.fit_transform(X)

            # K-means聚类
            self.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            clusters = self.kmeans.fit_predict(X_scaled)

            # 添加聚类结果到数据
            data_with_clusters = data.copy()
            data_with_clusters['cluster'] = clusters

            # 分析每个聚类的特征
            cluster_analysis = {}
            for i in range(n_clusters):
                cluster_data = data_with_clusters[data_with_clusters['cluster'] == i]
                cluster_analysis[f"cluster_{i}"] = {
                    "size": len(cluster_data),
                    "percentage": len(cluster_data) / len(data) * 100,
                    "characteristics": {}
                }

                # 计算每个特征的均值
                for feature in features:
                    if cluster_data[feature].dtype in [np.int64, np.float64]:
                        cluster_analysis[f"cluster_{i}"]["characteristics"][feature] = {
                            "mean": float(cluster_data[feature].mean()),
                            "median": float(cluster_data[feature].median()),
                            "std": float(cluster_data[feature].std())
                        }

            return AnalysisResult(
                success=True,
                analysis_type=AnalysisType.CUSTOMER_SEGMENTATION,
                data={
                    "clusters": cluster_analysis,
                    "cluster_centers": self.kmeans.cluster_centers_.tolist(),
                    "inertia": float(self.kmeans.inertia_),
                    "n_clusters": n_clusters
                },
                confidence=0.75,
                model_used="kmeans",
                metadata={
                    "features_used": features,
                    "total_samples": len(data)
                }
            )

        except Exception as e:
            logger.error(f"Customer segmentation failed: {str(e)}")
            return AnalysisResult(
                success=False,
                analysis_type=AnalysisType.CUSTOMER_SEGMENTATION,
                error=str(e)
            )

    def predict_cluster(self, data: np.ndarray) -> np.ndarray:
        """预测新数据的聚类"""
        if self.kmeans is None:
            raise ValueError("Model not trained. Call segment() first.")

        X_scaled = self.scaler.transform(data)
        return self.kmeans.predict(X_scaled)


class DataAnalyzer:
    """数据分析器主类"""

    def __init__(self, config: Dict = None):
        self.config = config or {}

        # 初始化各个分析器
        openai_key = self.config.get("openai_api_key")
        anthropic_key = self.config.get("anthropic_api_key")

        provider = ModelProvider.OPENAI if openai_key else ModelProvider.ANTHROPIC if anthropic_key else None

        if provider:
            self.sentiment_analyzer = SentimentAnalyzer(provider, openai_key or anthropic_key)
            self.entity_extractor = EntityExtractor(provider, openai_key or anthropic_key)
        else:
            self.sentiment_analyzer = SentimentAnalyzer(ModelProvider.LOCAL)
            self.entity_extractor = EntityExtractor(ModelProvider.LOCAL)

        self.customer_segmentation = CustomerSegmentation()

    async def analyze_sentiment(self, text: str) -> AnalysisResult:
        """分析情感"""
        return await self.sentiment_analyzer.analyze(text)

    async def extract_entities(self, text: str) -> AnalysisResult:
        """提取实体"""
        return await self.entity_extractor.extract(text)

    async def segment_customers(self, data: pd.DataFrame, features: List[str] = None,
                                n_clusters: int = 5) -> AnalysisResult:
        """客户细分"""
        return await self.customer_segmentation.segment(data, features, n_clusters)

    async def analyze_text(self, text: str, analyses: List[AnalysisType] = None) -> Dict[str, AnalysisResult]:
        """
        综合文本分析

        Args:
            text: 待分析文本
            analyses: 要执行的分析类型列表

        Returns:
            各分析类型的结果字典
        """
        if analyses is None:
            analyses = [
                AnalysisType.SENTIMENT,
                AnalysisType.ENTITY_RECOGNITION,
                AnalysisType.KEYWORD_EXTRACTION
            ]

        results = {}

        # 情感分析
        if AnalysisType.SENTIMENT in analyses:
            results["sentiment"] = await self.analyze_sentiment(text)

        # 实体提取
        if AnalysisType.ENTITY_RECOGNITION in analyses:
            results["entities"] = await self.extract_entities(text)

        return results

    def process_dataframe(self, df: pd.DataFrame, operations: List[str] = None) -> pd.DataFrame:
        """
        处理DataFrame

        Args:
            df: 输入DataFrame
            operations: 操作列表 ["clean", "deduplicate", "normalize"]

        Returns:
            处理后的DataFrame
        """
        if operations is None:
            operations = ["clean", "deduplicate", "normalize"]

        result = df.copy()

        if "clean" in operations:
            # 清理文本列
            for col in result.select_dtypes(include=['object', 'string']).columns:
                result[col] = result[col].apply(lambda x: DataProcessor.clean_text(str(x)))

        if "deduplicate" in operations:
            result = result.drop_duplicates()

        if "normalize" in operations:
            result = DataProcessor.normalize_dataframe(result)

        return result
