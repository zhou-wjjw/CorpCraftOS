"""
企业画像模块
构建企业多维画像，包括基本信息、经营状况、信用评级等
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from loguru import logger

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans


@dataclass
class CompanyProfile:
    """企业画像数据类"""
    company_id: int
    name: str

    # 基本信息
    industry: str
    scale: str  # 大型/中型/小型/微型
    business_status: str

    # 经营指标
    operation_score: float  # 经营得分 (0-100)
    financial_score: float  # 财务得分 (0-100)
    credit_score: float  # 信用得分 (0-100)

    # 风险评估
    risk_level: str  # 低/中/高
    risk_tags: List[str]

    # 标签
    tags: List[str]

    # 推荐指标
    recommended: bool
    priority: int  # 优先级 1-5

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'company_id': self.company_id,
            'name': self.name,
            'industry': self.industry,
            'scale': self.scale,
            'business_status': self.business_status,
            'operation_score': self.operation_score,
            'financial_score': self.financial_score,
            'credit_score': self.credit_score,
            'risk_level': self.risk_level,
            'risk_tags': self.risk_tags,
            'tags': self.tags,
            'recommended': self.recommended,
            'priority': self.priority,
        }


class CompanyProfileBuilder:
    """企业画像构建器"""

    def __init__(self):
        self.scaler = StandardScaler()

    def build_profile(self, company_data: Dict[str, Any]) -> CompanyProfile:
        """
        构建企业画像

        Args:
            company_data: 企业数据字典

        Returns:
            CompanyProfile对象
        """
        # 1. 确定企业规模
        scale = self._determine_scale(company_data)

        # 2. 计算经营得分
        operation_score = self._calculate_operation_score(company_data)

        # 3. 计算财务得分
        financial_score = self._calculate_financial_score(company_data)

        # 4. 计算信用得分
        credit_score = self._calculate_credit_score(company_data)

        # 5. 评估风险等级
        risk_level, risk_tags = self._assess_risk(company_data)

        # 6. 生成标签
        tags = self._generate_tags(company_data)

        # 7. 判断是否推荐
        recommended, priority = self._evaluate_recommendation(
            operation_score, financial_score, credit_score, risk_level
        )

        return CompanyProfile(
            company_id=company_data.get('id', 0),
            name=company_data.get('name', ''),
            industry=company_data.get('industry', ''),
            scale=scale,
            business_status=company_data.get('business_status', ''),
            operation_score=operation_score,
            financial_score=financial_score,
            credit_score=credit_score,
            risk_level=risk_level,
            risk_tags=risk_tags,
            tags=tags,
            recommended=recommended,
            priority=priority,
        )

    def _determine_scale(self, company_data: Dict[str, Any]) -> str:
        """确定企业规模"""
        # 根据行业和从业人员、营业收入等指标确定
        industry = company_data.get('industry', '')
        employee_count = company_data.get('employee_count', 0)
        revenue = company_data.get('annual_revenue', 0)

        # 简化版的规模判断
        if employee_count >= 1000 or revenue >= 400000000:  # 4亿
            return '大型'
        elif employee_count >= 100 or revenue >= 20000000:  # 2000万
            return '中型'
        elif employee_count >= 10 or revenue >= 5000000:  # 500万
            return '小型'
        else:
            return '微型'

    def _calculate_operation_score(self, company_data: Dict[str, Any]) -> float:
        """计算经营得分"""
        score = 50.0  # 基础分

        # 成立年限 (0-20分)
        if 'establishment_date' in company_data:
            establishment_date = company_data['establishment_date']
            if isinstance(establishment_date, str):
                establishment_date = datetime.fromisoformat(establishment_date)
            years = (datetime.now() - establishment_date).days / 365
            score += min(years * 2, 20)

        # 经营状态 (0-30分)
        status = company_data.get('business_status', '')
        if status in ['在业', '正常', '存续']:
            score += 30
        elif status in ['迁入', '迁出']:
            score += 20
        elif status in ['停业', '清算']:
            score += 10

        return min(score, 100.0)

    def _calculate_financial_score(self, company_data: Dict[str, Any]) -> float:
        """计算财务得分"""
        score = 50.0  # 基础分

        # 注册资本 (0-20分)
        capital = company_data.get('registered_capital', 0)
        if capital >= 100000000:  # 1亿以上
            score += 20
        elif capital >= 10000000:  # 1000万以上
            score += 15
        elif capital >= 1000000:  # 100万以上
            score += 10
        elif capital >= 100000:  # 10万以上
            score += 5

        # 实收资本比例 (0-30分)
        paid_in = company_data.get('paid_in_capital', 0)
        if capital > 0:
            ratio = paid_in / capital
            score += ratio * 30

        return min(score, 100.0)

    def _calculate_credit_score(self, company_data: Dict[str, Any]) -> float:
        """计算信用得分"""
        score = 60.0  # 基础分

        # 纳税评级 (0-20分)
        tax_rating = company_data.get('tax_rating', '')
        if tax_rating == 'A':
            score += 20
        elif tax_rating == 'B':
            score += 15
        elif tax_rating == 'C':
            score += 10
        elif tax_rating == 'D':
            score += 5

        # 行政处罚 (0-20分)
        # 这里可以接入第三方征信数据
        # 暂时给予基础分

        return min(score, 100.0)

    def _assess_risk(self, company_data: Dict[str, Any]) -> tuple:
        """评估风险等级"""
        risk_tags = []
        risk_score = 0

        # 经营状态风险
        status = company_data.get('business_status', '')
        if status in ['吊销', '注销', '清算']:
            risk_score += 30
            risk_tags.append('经营异常')

        # 成立时间风险
        if 'establishment_date' in company_data:
            establishment_date = company_data['establishment_date']
            if isinstance(establishment_date, str):
                establishment_date = datetime.fromisoformat(establishment_date)
            years = (datetime.now() - establishment_date).days / 365
            if years < 1:
                risk_score += 20
                risk_tags.append('新成立企业')

        # 注册资本风险
        capital = company_data.get('registered_capital', 0)
        paid_in = company_data.get('paid_in_capital', 0)
        if capital > 0:
            ratio = paid_in / capital
            if ratio < 0.5:
                risk_score += 15
                risk_tags.append('实缴不足')

        # 确定风险等级
        if risk_score >= 50:
            risk_level = '高'
        elif risk_score >= 30:
            risk_level = '中'
        else:
            risk_level = '低'

        return risk_level, risk_tags

    def _generate_tags(self, company_data: Dict[str, Any]) -> List[str]:
        """生成标签"""
        tags = []

        # 行业标签
        industry = company_data.get('industry', '')
        if industry:
            tags.append(industry)

        # 地区标签
        province = company_data.get('province', '')
        city = company_data.get('city', '')
        if province:
            tags.append(province)
        if city:
            tags.append(city)

        # 规模标签
        scale = self._determine_scale(company_data)
        tags.append(scale)

        # 特殊标签
        if company_data.get('listed', False):
            tags.append('上市公司')

        if company_data.get('high_tech', False):
            tags.append('高新技术企业')

        return list(set(tags))

    def _evaluate_recommendation(
        self,
        operation_score: float,
        financial_score: float,
        credit_score: float,
        risk_level: str
    ) -> tuple:
        """评估是否推荐客户"""
        # 综合得分
        total_score = (operation_score + financial_score + credit_score) / 3

        # 风险调整
        if risk_level == '高':
            total_score *= 0.7
        elif risk_level == '中':
            total_score *= 0.85

        # 确定优先级
        if total_score >= 80:
            recommended = True
            priority = 5
        elif total_score >= 70:
            recommended = True
            priority = 4
        elif total_score >= 60:
            recommended = True
            priority = 3
        elif total_score >= 50:
            recommended = False
            priority = 2
        else:
            recommended = False
            priority = 1

        return recommended, priority


class CompanyClusterAnalyzer:
    """企业聚类分析器"""

    def __init__(self, n_clusters: int = 5):
        self.n_clusters = n_clusters
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42)

    def cluster_companies(self, companies: List[Dict[str, Any]]) -> Dict[int, List[int]]:
        """
        对企业进行聚类分析

        Args:
            companies: 企业列表

        Returns:
            聚类结果字典 {cluster_id: [company_ids]}
        """
        if not companies:
            return {}

        # 提取特征
        features = []
        company_ids = []

        for company in companies:
            feature_vector = [
                company.get('registered_capital', 0) / 1000000,  # 注册资本（百万）
                company.get('employee_count', 0),  # 员工数
                company.get('annual_revenue', 0) / 1000000,  # 营收（百万）
                1 if company.get('business_status') == '在业' else 0,  # 经营状态
            ]
            features.append(feature_vector)
            company_ids.append(company.get('id'))

        # 标准化
        features_array = np.array(features)
        features_scaled = self.scaler.fit_transform(features_array)

        # 聚类
        clusters = self.kmeans.fit_predict(features_scaled)

        # 组织结果
        result = {i: [] for i in range(self.n_clusters)}
        for company_id, cluster_id in zip(company_ids, clusters):
            result[cluster_id].append(company_id)

        return result

    def get_cluster_centers(self) -> List[Dict[str, float]]:
        """获取聚类中心"""
        if not hasattr(self.kmeans, 'cluster_centers_'):
            return []

        centers = []
        for center in self.kmeans.cluster_centers_:
            centers.append({
                'capital': center[0],
                'employees': center[1],
                'revenue': center[2],
                'status_factor': center[3],
            })

        return centers


# 便捷函数
def build_company_profile(company_data: Dict[str, Any]) -> CompanyProfile:
    """构建企业画像"""
    builder = CompanyProfileBuilder()
    return builder.build_profile(company_data)


def batch_build_profiles(companies_data: List[Dict[str, Any]]) -> List[CompanyProfile]:
    """批量构建企业画像"""
    builder = CompanyProfileBuilder()
    return [builder.build_profile(data) for data in companies_data]


def cluster_companies(companies: List[Dict[str, Any]], n_clusters: int = 5) -> Dict[int, List[int]]:
    """对企业进行聚类分析"""
    analyzer = CompanyClusterAnalyzer(n_clusters=n_clusters)
    return analyzer.cluster_companies(companies)
