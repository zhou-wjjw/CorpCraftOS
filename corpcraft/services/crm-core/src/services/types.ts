/**
 * CRM Service Type Definitions
 */

import { ICustomer } from '../models/Customer';

export interface CustomerFilter {
  status?: string;
  priority?: string;
  category?: string;
  leadSource?: string;
  tags?: string[];
  search?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  valueRange?: {
    min?: number;
    max?: number;
  };
}

export interface CustomerAnalytics {
  totalCustomers: number;
  statusDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
  leadSourceDistribution: Record<string, number>;
  averageEstimatedValue: number;
  recentCustomers: any[];
}

export interface EnrichmentOptions {
  enableEmailValidation?: boolean;
  enableSocialMediaLookup?: boolean;
  enableCompanyEnrichment?: boolean;
}

export interface CrawlIntegrationConfig {
  autoCreateCustomers?: boolean;
  enrichmentEnabled?: boolean;
  duplicateDetection?: boolean;
  autoCategorization?: boolean;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'social' | 'direct';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetAudience: {
    filters: CustomerFilter;
    estimatedReach: number;
  };
  content: {
    subject?: string;
    body: string;
    template?: string;
  };
  schedule?: {
    startDate?: Date;
    endDate?: Date;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
  metrics: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    converted?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesPipeline {
  stages: Array<{
    id: string;
    name: string;
    probability: number;
    estimatedValue: number;
    customers: string[];
  }>;
  totalValue: number;
  weightedValue: number;
  conversionRate: number;
  averageDealSize: number;
}
