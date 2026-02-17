"""
AI数据分析模块
实现情感分析、实体提取、客户细分等功能
"""
import re
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer


class SentimentLabel(Enum):
    """情感标签"""
    POSITIVE = "positive"  # 积极
    NEGATIVE = "negative"  # 消极
    NEUTRAL = "neutral"    # 中性


@dataclass
class SentimentResult:
    """情感分析结果"""
    label: SentimentLabel
    score: float  # 0-1之间，表示置信度
    positive_probability: float
    negative_probability: float
    neutral_probability: float


@dataclass
class Entity:
    """实体"""
    text: str
    label: str  # 类型: PERSON, EMAIL, PHONE, COMPANY, etc.
    start: int
    end: int
    confidence: float


@dataclass
class EntityExtractionResult:
    """实体提取结果"""
    entities: List[Entity]
    text: str


@dataclass
class CustomerSegment:
    """客户细分"""
    segment_id: int
    size: int  # 该细分中的客户数
    characteristics: Dict[str, float]  # 特征中心点
    description: str


class SentimentAnalyzer:
    """情感分析器"""

    def __init__(self, openai_api_key: Optional[str] = None, anthropic_api_key: Optional[str] = None):
        self.openai_api_key = openai_api_key
        self.anthropic_api_key = anthropic_api_key
        self._use_local_fallback = True  # 如果API不可用，使用本地规则

    async def analyze(self, text: str) -> SentimentResult:
        """
        分析文本情感

        Args:
            text: 待分析的文本

        Returns:
            SentimentResult对象
        """
        # 尝试使用AI API
        if self.openai_api_key:
            try:
                return await self._analyze_with_openai(text)
            except Exception as e:
                logger.warning(f"OpenAI分析失败，使用本地规则: {e}")

        # 降级到本地规则
        return self._analyze_with_rules(text)

    async def _analyze_with_openai(self, text: str) -> SentimentResult:
        """使用OpenAI API分析"""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.openai_api_key)

            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个情感分析专家。分析给定文本的情感倾向，返回JSON格式：{\"sentiment\": \"positive/negative/neutral\", \"confidence\": 0.0-1.0, \"scores\": {\"positive\": 0.0-1.0, \"negative\": 0.0-1.0, \"neutral\": 0.0-1.0}}"
                    },
                    {"role": "user", "content": text}
                ],
                temperature=0.3,
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            return SentimentResult(
                label=SentimentLabel(result.get('sentiment', 'neutral')),
                score=result.get('confidence', 0.5),
                positive_probability=result.get('scores', {}).get('positive', 0.33),
                negative_probability=result.get('scores', {}).get('negative', 0.33),
                neutral_probability=result.get('scores', {}).get('neutral', 0.33),
            )

        except ImportError:
            logger.warning("OpenAI库未安装")
            raise
        except Exception as e:
            logger.error(f"OpenAI API调用失败: {e}")
            raise

    def _analyze_with_rules(self, text: str) -> SentimentResult:
        """使用规则进行情感分析"""
        # 简单的情感词典
        positive_words = [
            '好', '优秀', '满意', '喜欢', '高兴', '开心', '棒', '赞',
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'happy',
            '满意', '推荐', '感谢', '谢谢', '优质', '高效'
        ]

        negative_words = [
            '差', '不好', '讨厌', '失望', '愤怒', '糟糕', '垃圾', '烂',
            'bad', 'terrible', 'awful', 'hate', 'disappointed', 'angry',
            '投诉', '问题', '错误', '失败', '慢', '贵', '不满意'
        ]

        # 统计情感词
        positive_count = sum(1 for word in positive_words if word in text)
        negative_count = sum(1 for word in negative_words if word in text)

        total = positive_count + negative_count

        if total == 0:
            # 没有明显的情感词，判断为中性
            return SentimentResult(
                label=SentimentLabel.NEUTRAL,
                score=0.5,
                positive_probability=0.33,
                negative_probability=0.33,
                neutral_probability=0.34,
            )

        # 计算概率
        positive_prob = (positive_count + 1) / (total + 3)  # 拉普拉斯平滑
        negative_prob = (negative_count + 1) / (total + 3)
        neutral_prob = 1 - positive_prob - negative_prob

        # 确定主要情感
        if positive_prob > negative_prob and positive_prob > neutral_prob:
            label = SentimentLabel.POSITIVE
            score = positive_prob
        elif negative_prob > positive_prob and negative_prob > neutral_prob:
            label = SentimentLabel.NEGATIVE
            score = negative_prob
        else:
            label = SentimentLabel.NEUTRAL
            score = max(positive_prob, negative_prob, neutral_prob)

        return SentimentResult(
            label=label,
            score=score,
            positive_probability=positive_prob,
            negative_probability=negative_prob,
            neutral_probability=neutral_prob,
        )


class EntityExtractor:
    """实体提取器"""

    # 实体识别的正则表达式模式
    PATTERNS = {
        'EMAIL': re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        ),
        'PHONE': re.compile(
            r'(?:\+?86[-\s]?)?1[3-9]\d{9}'
        ),
        'WECHAT': re.compile(
            r'(?:微信|wx|weixin)[-:\s]?([A-Za-z0-9_-]{6,20})',
            re.IGNORECASE
        ),
        'URL': re.compile(
            r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w .-]*/?'
        ),
        'IP_ADDRESS': re.compile(
            r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
        ),
        'DATE': re.compile(
            r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?'
        ),
        'PRICE': re.compile(
            r'¥?[$￥]?\s?\d+(?:,\d{3})*(?:\.\d{2})?元?'
        ),
    }

    def __init__(self):
        self._use_ai = False  # 是否使用AI增强

    async def extract(self, text: str) -> EntityExtractionResult:
        """
        从文本中提取实体

        Args:
            text: 待提取的文本

        Returns:
            EntityExtractionResult对象
        """
        entities = []

        # 使用正则表达式提取
        for label, pattern in self.PATTERNS.items():
            for match in pattern.finditer(text):
                entity = Entity(
                    text=match.group(),
                    label=label,
                    start=match.start(),
                    end=match.end(),
                    confidence=0.9,  # 正则表达式匹配的置信度较高
                )
                entities.append(entity)

        # 提取人名（简单的中文人名模式）
        person_entities = self._extract_chinese_names(text)
        entities.extend(person_entities)

        # 提取公司名（简单模式）
        company_entities = self._extract_company_names(text)
        entities.extend(company_entities)

        # 按起始位置排序
        entities.sort(key=lambda e: e.start)

        return EntityExtractionResult(
            entities=entities,
            text=text
        )

    def _extract_chinese_names(self, text: str) -> List[Entity]:
        """提取中文人名"""
        # 简单的中文人名模式：2-3个汉字
        name_pattern = re.compile(r'[\u4e00-\u9fa5]{2,3}(?:先生|女士|小姐|老师|经理|总监|CEO)?')
        entities = []

        for match in name_pattern.finditer(text):
            # 排除一些明显不是人名的词
            excluded_words = {'这个', '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '如果', '虽然'}
            word = match.group()
            if word not in excluded_words:
                entity = Entity(
                    text=word,
                    label='PERSON',
                    start=match.start(),
                    end=match.end(),
                    confidence=0.6,  # 人名识别置信度较低
                )
                entities.append(entity)

        return entities

    def _extract_company_names(self, text: str) -> List[Entity]:
        """提取公司名"""
        # 公司后缀
        company_suffixes = ['公司', '企业', '集团', '有限公司', '科技', '网络', '信息', '咨询', 'Co.', 'Ltd.', 'Inc.']

        entities = []
        for suffix in company_suffixes:
            # 查找包含公司后缀的文本
            pattern = re.compile(f'[^，。；！？\\s]+{suffix}')
            for match in pattern.finditer(text):
                entity = Entity(
                    text=match.group(),
                    label='COMPANY',
                    start=match.start(),
                    end=match.end(),
                    confidence=0.7,
                )
                entities.append(entity)

        return entities


class CustomerSegmentation:
    """客户细分"""

    def __init__(self):
        self.scaler = StandardScaler()
        self.vectorizer = TfidfVectorizer(max_features=100)

    async def segment_customers(
        self,
        customers: List[Dict[str, Any]],
        n_clusters: int = 5,
        features: List[str] = None
    ) -> List[CustomerSegment]:
        """
        对客户进行细分

        Args:
            customers: 客户数据列表
            n_clusters: 细分数量
            features: 用于聚类特征列表

        Returns:
            CustomerSegment列表
        """
        if not customers:
            return []

        # 转换为DataFrame
        df = pd.DataFrame(customers)

        # 准备特征
        feature_matrix = self._prepare_features(df, features)

        if feature_matrix is None or feature_matrix.shape[1] == 0:
            logger.warning("没有可用的特征进行聚类")
            return []

        # 标准化
        feature_matrix_scaled = self.scaler.fit_transform(feature_matrix)

        # K-means聚类
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(feature_matrix_scaled)

        # 分析每个细分
        segments = []

        for cluster_id in range(n_clusters):
            cluster_mask = cluster_labels == cluster_id
            cluster_size = cluster_mask.sum()

            # 获取该细分的特征中心
            cluster_center = kmeans.cluster_centers_[cluster_id]
            feature_names = self._get_feature_names(df, features)

            characteristics = dict(zip(feature_names, cluster_center))

            # 生成描述
            description = self._generate_description(cluster_id, cluster_size, characteristics)

            segment = CustomerSegment(
                segment_id=cluster_id,
                size=int(cluster_size),
                characteristics=characteristics,
                description=description
            )
            segments.append(segment)

        logger.info(f"客户细分完成，共{len(segments)}个细分")
        return segments

    def _prepare_features(
        self,
        df: pd.DataFrame,
        custom_features: List[str] = None
    ) -> Optional[np.ndarray]:
        """准备特征矩阵"""
        features_list = []

        # 数值特征
        numeric_features = []

        if 'sentiment_score' in df.columns:
            numeric_features.append('sentiment_score')

        if 'engagement_score' in df.columns:
            numeric_features.append('engagement_score')

        if 'value_score' in df.columns:
            numeric_features.append('value_score')

        if 'total_interactions' in df.columns:
            numeric_features.append('total_interactions')

        if 'total_deals' in df.columns:
            numeric_features.append('total_deals')

        if 'total_amount' in df.columns:
            numeric_features.append('total_amount')

        if custom_features:
            numeric_features.extend([f for f in custom_features if f in df.columns and df[f].dtype in ['int64', 'float64']])

        # 提取数值特征
        if numeric_features:
            numeric_df = df[numeric_features].fillna(0)
            features_list.append(numeric_df.values)

        # 文本特征（如果有description或notes）
        if 'description' in df.columns or 'notes' in df.columns:
            text_col = 'description' if 'description' in df.columns else 'notes'
            text_data = df[text_col].fillna('').astype(str)

            try:
                text_features = self.vectorizer.fit_transform(text_data).toarray()
                features_list.append(text_features)
            except Exception as e:
                logger.warning(f"文本特征提取失败: {e}")

        # 合并所有特征
        if features_list:
            feature_matrix = np.concatenate(features_list, axis=1)
            return feature_matrix

        return None

    def _get_feature_names(self, df: pd.DataFrame, custom_features: List[str] = None) -> List[str]:
        """获取特征名称"""
        names = []

        numeric_features = ['sentiment_score', 'engagement_score', 'value_score',
                          'total_interactions', 'total_deals', 'total_amount']

        for feature in numeric_features:
            if feature in df.columns:
                names.append(feature)

        if custom_features:
            names.extend([f for f in custom_features if f in df.columns])

        # 文本特征名称
        if hasattr(self.vectorizer, 'get_feature_names_out'):
            text_feature_names = [f'text_{name}' for name in self.vectorizer.get_feature_names_out()]
            names.extend(text_feature_names)

        return names

    def _generate_description(
        self,
        cluster_id: int,
        size: int,
        characteristics: Dict[str, float]
    ) -> str:
        """生成细分描述"""
        # 找出最显著的特征
        sorted_features = sorted(characteristics.items(), key=lambda x: abs(x[1]), reverse=True)

        top_features = sorted_features[:5]

        desc_parts = [f"细分 #{cluster_id + 1}"]

        # 客户数量
        desc_parts.append(f"(包含 {size} 个客户)")

        # 关键特征
        if top_features:
            desc_parts.append("关键特征:")
            for feature_name, value in top_features:
                if abs(value) > 0.1:  # 只显示显著的特征
                    direction = "高" if value > 0 else "低"
                    desc_parts.append(f"  - {feature_name}: {direction}")

        return ", ".join(desc_parts)


class AIAnalytics:
    """AI分析引擎主类"""

    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        anthropic_api_key: Optional[str] = None
    ):
        self.sentiment_analyzer = SentimentAnalyzer(openai_api_key, anthropic_api_key)
        self.entity_extractor = EntityExtractor()
        self.customer_segmentation = CustomerSegmentation()

        # 统计信息
        self.total_analyzed = 0

    async def analyze_sentiment(self, text: str) -> SentimentResult:
        """分析文本情感"""
        result = await self.sentiment_analyzer.analyze(text)
        self.total_analyzed += 1
        return result

    async def extract_entities(self, text: str) -> EntityExtractionResult:
        """提取实体"""
        result = await self.entity_extractor.extract(text)
        self.total_analyzed += 1
        return result

    async def segment_customers(
        self,
        customers: List[Dict[str, Any]],
        n_clusters: int = 5,
        features: List[str] = None
    ) -> List[CustomerSegment]:
        """客户细分"""
        segments = await self.customer_segmentation.segment_customers(
            customers, n_clusters, features
        )
        self.total_analyzed += len(customers)
        return segments

    async def analyze_text(self, text: str) -> Dict[str, Any]:
        """
        对文本进行综合分析

        Args:
            text: 待分析文本

        Returns:
            包含情感和实体的分析结果
        """
        sentiment = await self.analyze_sentiment(text)
        entities = await self.extract_entities(text)

        return {
            'sentiment': {
                'label': sentiment.label.value,
                'score': sentiment.score,
                'probabilities': {
                    'positive': sentiment.positive_probability,
                    'negative': sentiment.negative_probability,
                    'neutral': sentiment.neutral_probability,
                }
            },
            'entities': [
                {
                    'text': entity.text,
                    'label': entity.label,
                    'confidence': entity.confidence,
                }
                for entity in entities.entities
            ],
            'entity_count': len(entities.entities),
        }

    def get_stats(self) -> Dict[str, int]:
        """获取统计信息"""
        return {
            'total_analyzed': self.total_analyzed,
        }


# 全局实例
_analytics: Optional[AIAnalytics] = None


def get_analytics(
    openai_api_key: Optional[str] = None,
    anthropic_api_key: Optional[str] = None
) -> AIAnalytics:
    """获取全局AI分析实例"""
    global _analytics
    if _analytics is None:
        _analytics = AIAnalytics(openai_api_key, anthropic_api_key)
    return _analytics


# 便捷函数
async def analyze_sentiment(text: str) -> Dict[str, Any]:
    """便捷的情感分析函数"""
    analytics = get_analytics()
    result = await analytics.analyze_sentiment(text)
    return {
        'label': result.label.value,
        'score': result.score,
        'probabilities': {
            'positive': result.positive_probability,
            'negative': result.negative_probability,
            'neutral': result.neutral_probability,
        }
    }


async def extract_entities(text: str) -> List[Dict[str, Any]]:
    """便捷的实体提取函数"""
    analytics = get_analytics()
    result = await analytics.extract_entities(text)
    return [
        {
            'text': entity.text,
            'label': entity.label,
            'confidence': entity.confidence,
        }
        for entity in result.entities
    ]
