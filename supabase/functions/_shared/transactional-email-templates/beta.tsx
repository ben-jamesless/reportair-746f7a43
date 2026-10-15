import * as React from 'npm:react@18.3.1';
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

interface Props { name?: string; company?: string; inviteUrl?: string; email?: string }
const main = { backgroundColor: '#ffffff', color: '#14181C', fontFamily: 'Geist, Arial, sans-serif' };
const content = { padding: '32px 24px', maxWidth: '560px' };
const cta = { backgroundColor: '#14181C', color: '#ffffff', padding: '12px 20px', textDecoration: 'none' };
function Email({ name, company, inviteUrl, email, kind }: Props & { kind: 'invite' | 'approval' | 'request' | 'welcome' }) {
  const title = kind === 'invite' ? `Invitation to ${company || 'your company'}` : kind === 'approval' ? 'Your beta access is approved' : kind === 'request' ? 'New early-access request' : 'Welcome to BuildFolder';
  return <Html lang="en"><Head /><Preview>{title}</Preview><Body style={main}><Container style={content}>
    <Text style={{ fontWeight: 700 }}>BuildFolder</Text><Heading>{title}</Heading>
    <Text>{kind === 'request' ? `${name || 'Someone'} (${email || ''}) requested early access${company ? ` for ${company}` : ''}.` : `Hi ${name || 'there'},`}</Text>
    {kind === 'invite' && <Text>You have been invited to join {company || 'your company'} and its selected projects. Use the email address this invitation was sent to.</Text>}
    {kind === 'approval' && <Text>You can now create your BuildFolder account using this email address.</Text>}
    {kind === 'welcome' && <Text>Your account is ready. We look forward to your feedback as you document your events.</Text>}
    <Button style={cta} href={inviteUrl || 'https://buildfolder.com/projects'}>{kind === 'request' ? 'Review request' : kind === 'approval' ? 'Create account' : kind === 'invite' ? 'Accept invitation' : 'Open projects'}</Button>
  </Container></Body></Html>;
}
export const companyInvite = { component: (props: Props) => <Email {...props} kind="invite" />, subject: 'Your BuildFolder colleague invitation' } satisfies TemplateEntry;
export const betaApproval = { component: (props: Props) => <Email {...props} kind="approval" />, subject: 'Your BuildFolder beta access is approved' } satisfies TemplateEntry;
export const accessRequest = { component: (props: Props) => <Email {...props} kind="request" />, subject: 'New BuildFolder early-access request' } satisfies TemplateEntry;
export const welcome = { component: (props: Props) => <Email {...props} kind="welcome" />, subject: 'Welcome to BuildFolder' } satisfies TemplateEntry;