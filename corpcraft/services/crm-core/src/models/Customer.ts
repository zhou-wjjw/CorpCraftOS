/**
 * Customer Model
 * 客户数据模型
 */

import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
  // 基本信息
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  industry?: string;

  // 地址信息
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  // 社交媒体
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
  };

  // 客户分类
  category?: string;
  tags?: string[];
  leadSource?: string;

  // 客户状态
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high';

  // 价值评估
  estimatedValue?: number;
  actualValue?: number;
  probability?: number;

  // 时间戳
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  // 元数据
  metadata?: {
    source?: string;
    crawlerJobId?: string;
    originalUrl?: string;
    rawData?: any;
    enrichmentScore?: number;
    confidence?: number;
  };

  // 自定义字段
  customFields?: Record<string, any>;
}

const CustomerSchema = new Schema<ICustomer>({
  name: { type: String, required: true },
  email: { type: String, sparse: true, index: true },
  phone: { type: String },
  company: { type: String, index: true },
  title: { type: String },
  industry: { type: String },

  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },

  socialMedia: {
    linkedin: String,
    twitter: String,
    facebook: String,
    website: String,
  },

  category: String,
  tags: [String],
  leadSource: String,

  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    default: 'new',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true,
  },

  estimatedValue: { type: Number },
  actualValue: { type: Number },
  probability: { type: Number, min: 0, max: 100 },

  lastContactDate: Date,
  nextFollowUpDate: Date,

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },

  metadata: {
    source: String,
    crawlerJobId: String,
    originalUrl: String,
    rawData: Schema.Types.Mixed,
    enrichmentScore: Number,
    confidence: Number,
  },

  customFields: Schema.Types.Mixed,
});

// 更新时间戳中间件
CustomerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 索引优化
CustomerSchema.index({ company: 1, status: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ tags: 1 });
CustomerSchema.index({ 'metadata.source': 1 });

export default model<ICustomer>('Customer', CustomerSchema);
