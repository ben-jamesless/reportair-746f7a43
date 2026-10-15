import type * as React from 'npm:react@18.3.1';
import { companyInvite, betaApproval, accessRequest, welcome } from './beta.tsx';
export interface TemplateEntry { component: React.ComponentType<any>; subject: string | ((data: Record<string, any>) => string); displayName?: string; previewData?: Record<string, unknown>; to?: string }
export const TEMPLATES: Record<string, TemplateEntry> = { 'company-invite': companyInvite, 'beta-approval': betaApproval, 'access-request': accessRequest, welcome };