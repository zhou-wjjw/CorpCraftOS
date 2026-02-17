/**
 * Customer Service
 * 客户管理服务
 */

import { EventEmitter } from 'events';
import Customer, { ICustomer } from '../models/Customer';
import { CustomerFilter, CustomerAnalytics, EnrichmentOptions } from './types';

export class CustomerService extends EventEmitter {
  /**
   * 创建客户
   */
  async createCustomer(customerData: Partial<ICustomer>): Promise<ICustomer> {
    try {
      // 数据验证
      this.validateCustomerData(customerData);

      // 检查重复
      const existingCustomer = await this.findDuplicate(customerData);
      if (existingCustomer) {
        throw new Error('Customer already exists');
      }

      // 数据增强
      const enrichedData = await this.enrichCustomerData(customerData);

      // 创建客户
      const customer = new Customer(enrichedData);
      await customer.save();

      this.emit('customerCreated', customer);
      return customer;
    } catch (error) {
      this.emit('customerError', { error, data: customerData });
      throw error;
    }
  }

  /**
   * 批量创建客户
   */
  async createCustomers(customersData: Partial<ICustomer>[]): Promise<ICustomer[]> {
    const results = await Promise.allSettled(
      customersData.map(data => this.createCustomer(data))
    );

    const created: ICustomer[] = [];
    const errors: any[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        created.push(result.value);
      } else {
        errors.push({ index, error: result.reason });
      }
    });

    this.emit('batchCreateCompleted', { created, errors });
    return created;
  }

  /**
   * 更新客户
   */
  async updateCustomer(id: string, updates: Partial<ICustomer>): Promise<ICustomer | null> {
    try {
      const customer = await Customer.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );

      if (customer) {
        this.emit('customerUpdated', customer);
      }

      return customer;
    } catch (error) {
      this.emit('customerError', { error, id, updates });
      throw error;
    }
  }

  /**
   * 删除客户
   */
  async deleteCustomer(id: string): Promise<boolean> {
    try {
      const result = await Customer.findByIdAndDelete(id);
      if (result) {
        this.emit('customerDeleted', id);
        return true;
      }
      return false;
    } catch (error) {
      this.emit('customerError', { error, id });
      throw error;
    }
  }

  /**
   * 获取客户
   */
  async getCustomer(id: string): Promise<ICustomer | null> {
    return await Customer.findById(id);
  }

  /**
   * 搜索客户
   */
  async searchCustomers(filter: CustomerFilter, options: any = {}): Promise<{
    customers: ICustomer[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query = this.buildQuery(filter);
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort(options.sort || { createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return {
      customers,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取客户分析
   */
  async getAnalytics(startDate?: Date, endDate?: Date): Promise<CustomerAnalytics> {
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = startDate;
      if (endDate) dateFilter.createdAt.$lte = endDate;
    }

    const [
      totalCustomers,
      statusDistribution,
      priorityDistribution,
      leadSourceDistribution,
      averageEstimatedValue,
      recentCustomers,
    ] = await Promise.all([
      Customer.countDocuments(dateFilter),
      Customer.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$leadSource', count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: '$estimatedValue' } } },
      ]),
      Customer.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return {
      totalCustomers,
      statusDistribution: statusDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      priorityDistribution: priorityDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      leadSourceDistribution: leadSourceDistribution.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      averageEstimatedValue: averageEstimatedValue[0]?.avg || 0,
      recentCustomers,
    };
  }

  /**
   * 数据增强
   */
  private async enrichCustomerData(data: Partial<ICustomer>, options?: EnrichmentOptions): Promise<Partial<ICustomer>> {
    const enriched = { ...data };

    // 计算增强分数
    let score = 0;
    if (data.email) score += 20;
    if (data.phone) score += 15;
    if (data.company) score += 25;
    if (data.title) score += 15;
    if (data.socialMedia?.linkedin) score += 10;
    if (data.socialMedia?.website) score += 10;
    if (data.address?.city) score += 5;

    enriched.metadata = {
      ...data.metadata,
      enrichmentScore: score,
      confidence: this.calculateConfidence(data),
    };

    // 自动分类
    if (!data.category && data.company) {
      enriched.category = this.categorizeCompany(data.company);
    }

    // 自动设置优先级
    if (!data.priority && data.estimatedValue) {
      enriched.priority = this.calculatePriority(data.estimatedValue);
    }

    return enriched;
  }

  /**
   * 查找重复客户
   */
  private async findDuplicate(data: Partial<ICustomer>): Promise<ICustomer | null> {
    if (data.email) {
      return await Customer.findOne({ email: data.email });
    }

    if (data.company && data.name) {
      return await Customer.findOne({ company: data.company, name: data.name });
    }

    return null;
  }

  /**
   * 构建查询
   */
  private buildQuery(filter: CustomerFilter): any {
    const query: any = {};

    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;
    if (filter.category) query.category = filter.category;
    if (filter.leadSource) query.leadSource = filter.leadSource;
    if (filter.tags?.length) query.tags = { $in: filter.tags };

    if (filter.search) {
      query.$or = [
        { name: new RegExp(filter.search, 'i') },
        { email: new RegExp(filter.search, 'i') },
        { company: new RegExp(filter.search, 'i') },
      ];
    }

    if (filter.dateRange) {
      query.createdAt = {};
      if (filter.dateRange.start) query.createdAt.$gte = filter.dateRange.start;
      if (filter.dateRange.end) query.createdAt.$lte = filter.dateRange.end;
    }

    if (filter.valueRange) {
      query.estimatedValue = {};
      if (filter.valueRange.min !== undefined) query.estimatedValue.$gte = filter.valueRange.min;
      if (filter.valueRange.max !== undefined) query.estimatedValue.$lte = filter.valueRange.max;
    }

    return query;
  }

  /**
   * 验证客户数据
   */
  private validateCustomerData(data: Partial<ICustomer>): void {
    if (!data.name) {
      throw new Error('Customer name is required');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * 验证邮箱格式
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(data: Partial<ICustomer>): number {
    let confidence = 0;
    let totalWeight = 0;

    const weights = {
      email: 0.3,
      phone: 0.2,
      company: 0.25,
      title: 0.15,
      socialMedia: 0.1,
    };

    if (data.email) { confidence += weights.email; totalWeight += weights.email; }
    if (data.phone) { confidence += weights.phone; totalWeight += weights.phone; }
    if (data.company) { confidence += weights.company; totalWeight += weights.company; }
    if (data.title) { confidence += weights.title; totalWeight += weights.title; }
    if (data.socialMedia?.linkedin || data.socialMedia?.website) {
      confidence += weights.socialMedia;
      totalWeight += weights.socialMedia;
    }

    return totalWeight > 0 ? confidence / totalWeight : 0;
  }

  /**
   * 分类公司
   */
  private categorizeCompany(company: string): string {
    const industryKeywords = {
      Technology: ['tech', 'software', 'AI', 'cloud', 'data', 'digital'],
      Finance: ['bank', 'finance', 'investment', 'capital', 'fund'],
      Healthcare: ['health', 'medical', 'pharma', 'clinic'],
      Retail: ['retail', 'store', 'shop', 'market'],
      Manufacturing: ['manufacturing', 'factory', 'production'],
      Consulting: ['consulting', 'advisory', 'solutions'],
    };

    const lowerCompany = company.toLowerCase();

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => lowerCompany.includes(keyword))) {
        return industry;
      }
    }

    return 'Other';
  }

  /**
   * 计算优先级
   */
  private calculatePriority(estimatedValue: number): 'low' | 'medium' | 'high' {
    if (estimatedValue >= 100000) return 'high';
    if (estimatedValue >= 50000) return 'medium';
    return 'low';
  }
}

export default CustomerService;
