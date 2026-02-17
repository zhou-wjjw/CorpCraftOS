"""
客户意向评分模块
基于多维度分析客户购买意向
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from loguru import logger

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import jieba
import jieba.analyse


@dataclass
class IntentScore:
    """意向评分数据类"""
    company_id: int
    company_name: str

    # 综合意向分
    overall_score: float  # 0-100

    # 各维度得分
    behavior_score: float  # 行为意向分
    content_score: float  # 内容意向分
    interaction_score: float  # 互动意向分
    timing_score: float  # 时效意向分

    # 意向等级
    intent_level: str  # 高/中/低

    # 关键因素
    key_factors: List[str]

    # 预测
    purchase_probability: float  # 购买概率 0-1

    # 建议
    next_action: str
    recommended_channel: str

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'company_id': self.company_id,
            'company_name': self.company_name,
            'overall_score': self.overall_score,
            'behavior_score': self.behavior_score,
            'content_score': self.content_score,
            'interaction_score': self.interaction_score,
            'timing_score': self.timing_score,
            'intent_level': self.intent_level,
            'key_factors': self.key_factors,
            'purchase_probability': self.purchase_probability,
            'next_action': self.next_action,
            'recommended_channel': self.recommended_channel,
        }


class IntentScoreModel:
    """意向评分模型"""

    # 权重配置
    WEIGHTS = {
        'behavior': 0.35,
        'content': 0.25,
        'interaction': 0.25,
        'timing': 0.15,
    }

    # 关键词词典（用于内容分析）
    HIGH_INTENT_KEYWORDS = [
        '采购', '购买', '需求', '报价', '询价',
        '合作', '项目', '招标', '采购计划',
        '预算', '方案', '供应商', '服务商',
    ]

    MEDIUM_INTENT_KEYWORDS = [
        '了解', '咨询', '产品', '服务',
        '比较', '选型', '考察',
    ]

    def __init__(self):
        self.scaler = StandardScaler()
        self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42)

    def calculate_intent_score(
        self,
        company_data: Dict[str, Any],
        interactions: List[Dict[str, Any]] = None,
        website_content: str = None,
    ) -> IntentScore:
        """
        计算意向评分

        Args:
            company_data: 企业数据
            interactions: 互动记录列表
            website_content: 网站内容

        Returns:
            IntentScore对象
        """
        # 1. 计算行为意向分
        behavior_score = self._calculate_behavior_score(company_data, interactions or [])

        # 2. 计算内容意向分
        content_score = self._calculate_content_score(website_content or '')

        # 3. 计算互动意向分
        interaction_score = self._calculate_interaction_score(interactions or [])

        # 4. 计算时效意向分
        timing_score = self._calculate_timing_score(company_data, interactions or [])

        # 5. 计算综合得分
        overall_score = (
            behavior_score * self.WEIGHTS['behavior'] +
            content_score * self.WEIGHTS['content'] +
            interaction_score * self.WEIGHTS['interaction'] +
            timing_score * self.WEIGHTS['timing']
        )

        # 6. 确定意向等级
        intent_level = self._determine_intent_level(overall_score)

        # 7. 提取关键因素
        key_factors = self._extract_key_factors(
            behavior_score, content_score, interaction_score, timing_score
        )

        # 8. 预测购买概率
        purchase_probability = self._predict_purchase_probability(overall_score)

        # 9. 生成建议
        next_action, recommended_channel = self._generate_recommendations(
            intent_level, key_factors, interactions or []
        )

        return IntentScore(
            company_id=company_data.get('id', 0),
            company_name=company_data.get('name', ''),
            overall_score=round(overall_score, 2),
            behavior_score=round(behavior_score, 2),
            content_score=round(content_score, 2),
            interaction_score=round(interaction_score, 2),
            timing_score=round(timing_score, 2),
            intent_level=intent_level,
            key_factors=key_factors,
            purchase_probability=round(purchase_probability, 2),
            next_action=next_action,
            recommended_channel=recommended_channel,
        )

    def _calculate_behavior_score(self, company_data: Dict[str, Any], interactions: List[Dict]) -> float:
        """计算行为意向分"""
        score = 0.0

        # 检查是否有采购相关行为
        business_scope = company_data.get('business_scope', '')

        # 高意向行为
        high_intent_count = sum(1 for keyword in self.HIGH_INTENT_KEYWORDS if keyword in business_scope)
        score += min(high_intent_count * 10, 40)

        # 中意向行为
        medium_intent_count = sum(1 for keyword in self.MEDIUM_INTENT_KEYWORDS if keyword in business_scope)
        score += min(medium_intent_count * 5, 20)

        # 互动频率
        if interactions:
            recent_interactions = [
                i for i in interactions
                if datetime.fromisoformat(i['interaction_date'].replace('Z', '+00:00')) > datetime.now() - timedelta(days=30)
            ]
            score += min(len(recent_interactions) * 5, 30)

        # 网站活跃度
        if company_data.get('website'):
            score += 10

        return min(score, 100.0)

    def _calculate_content_score(self, content: str) -> float:
        """计算内容意向分"""
        if not content:
            return 0.0

        score = 0.0

        # 使用jieba提取关键词
        keywords = jieba.analyse.extract_tags(content, topK=20)

        # 计算意向关键词权重
        high_intent_matches = sum(1 for kw in keywords if kw in self.HIGH_INTENT_KEYWORDS)
        medium_intent_matches = sum(1 for kw in keywords if kw in self.MEDIUM_INTENT_KEYWORDS)

        score += min(high_intent_matches * 15, 60)
        score += min(medium_intent_matches * 10, 30)

        # 内容长度（表示活跃度）
        if len(content) > 1000:
            score += 10
        elif len(content) > 500:
            score += 5

        return min(score, 100.0)

    def _calculate_interaction_score(self, interactions: List[Dict]) -> float:
        """计算互动意向分"""
        if not interactions:
            return 0.0

        score = 0.0

        # 最近30天的互动
        recent_interactions = [
            i for i in interactions
            if datetime.fromisoformat(i['interaction_date'].replace('Z', '+00:00')) > datetime.now() - timedelta(days=30)
        ]

        # 互动频率
        score += min(len(recent_interactions) * 8, 40)

        # 互动类型权重
        interaction_weights = {
            'meeting': 20,
            'call': 15,
            'visit': 25,
            'email': 10,
            'social': 5,
        }

        for interaction in recent_interactions:
            interaction_type = interaction.get('interaction_type', 'email')
            weight = interaction_weights.get(interaction_type, 5)
            score += min(weight, 25)

        # 意向度评分
        interest_levels = [i.get('interest_level', 0) for i in recent_interactions if i.get('interest_level')]
        if interest_levels:
            avg_interest = sum(interest_levels) / len(interest_levels)
            score += avg_interest * 10

        return min(score, 100.0)

    def _calculate_timing_score(self, company_data: Dict[str, Any], interactions: List[Dict]) -> float:
        """计算时效意向分"""
        score = 50.0  # 基础分

        if not interactions:
            return score

        # 最近互动时间
        latest_interaction = max(
            interactions,
            key=lambda x: datetime.fromisoformat(x['interaction_date'].replace('Z', '+00:00'))
        )
        days_since_contact = (
            datetime.now() - datetime.fromisoformat(latest_interaction['interaction_date'].replace('Z', '+00:00'))
        ).days

        # 时间衰减
        if days_since_contact <= 7:
            score += 40
        elif days_since_contact <= 30:
            score += 30
        elif days_since_contact <= 90:
            score += 20
        elif days_since_contact <= 180:
            score += 10

        return min(score, 100.0)

    def _determine_intent_level(self, score: float) -> str:
        """确定意向等级"""
        if score >= 80:
            return '高'
        elif score >= 60:
            return '中'
        else:
            return '低'

    def _extract_key_factors(
        self,
        behavior_score: float,
        content_score: float,
        interaction_score: float,
        timing_score: float,
    ) -> List[str]:
        """提取关键影响因素"""
        factors = []

        if behavior_score >= 70:
            factors.append('行为活跃')
        if content_score >= 70:
            factors.append('内容相关度高')
        if interaction_score >= 70:
            factors.append('互动频繁')
        if timing_score >= 70:
            factors.append('近期有互动')

        # 如果所有分数都低，添加提示
        if not factors:
            factors.append('需要培养')

        return factors

    def _predict_purchase_probability(self, intent_score: float) -> float:
        """预测购买概率"""
        # 使用sigmoid函数将分数映射到0-1概率
        import math
        probability = 1 / (1 + math.exp(-(intent_score - 50) / 15))
        return probability

    def _generate_recommendations(
        self,
        intent_level: str,
        key_factors: List[str],
        interactions: List[Dict],
    ) -> tuple:
        """生成下一步行动建议"""
        if intent_level == '高':
            if 'meeting' not in [i.get('interaction_type') for i in interactions[-30:]]:
                next_action = '安排上门拜访或视频会议'
                recommended_channel = 'meeting'
            else:
                next_action = '发送详细方案和报价'
                recommended_channel = 'email'
        elif intent_level == '中':
            next_action = '定期发送相关内容和案例'
            recommended_channel = 'email'
        else:
            next_action = '添加到培育池，定期触达'
            recommended_channel = 'social'

        return next_action, recommended_channel


# 便捷函数
def calculate_intent_score(
    company_data: Dict[str, Any],
    interactions: List[Dict[str, Any]] = None,
    website_content: str = None,
) -> IntentScore:
    """计算意向评分"""
    model = IntentScoreModel()
    return model.calculate_intent_score(company_data, interactions, website_content)


def batch_calculate_scores(
    companies_data: List[Dict[str, Any]],
    interactions_map: Dict[int, List[Dict]] = None,
    content_map: Dict[int, str] = None,
) -> List[IntentScore]:
    """批量计算意向评分"""
    model = IntentScoreModel()
    results = []

    for company in companies_data:
        company_id = company.get('id')
        interactions = interactions_map.get(company_id, []) if interactions_map else []
        content = content_map.get(company_id) if content_map else None

        score = model.calculate_intent_score(company, interactions, content)
        results.append(score)

    return results
