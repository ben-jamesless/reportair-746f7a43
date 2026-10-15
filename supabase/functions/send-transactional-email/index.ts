import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { z } from 'npm:zod@3'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "BuildFolder"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "notify.reportair.co"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "reportair.co"

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Every authenticated action is validated in code; public requests only target
// the fixed admin inbox and cannot choose recipients, URLs, or template data.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  let sourceInviteId: string | null = null
  try {
    const body = await req.json()
    const service = createClient(supabaseUrl, supabaseServiceKey)
    const parsed = z.object({ templateName: z.enum(['company-invite', 'beta-approval', 'access-request', 'welcome']), inviteId: z.string().uuid().optional(), requestId: z.string().uuid().optional(), email: z.string().trim().email().max(254).optional(), name: z.string().trim().min(1).max(120).optional(), company: z.string().trim().max(200).optional(), website: z.string().max(500).optional() }).safeParse(body)
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid email request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const input = parsed.data
    templateName = input.templateName
    messageId = crypto.randomUUID()
    if (templateName === 'access-request') {
      if (!input.email || !input.name) throw new Error('Name and email are required')
      if (input.website) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const email = input.email.toLowerCase()
      const { data: prior } = await service.from('early_access_requests').select('id').eq('email', email).maybeSingle()
      const { error } = await service.rpc('request_early_access', { _email: email, _full_name: input.name, _company: input.company ?? '', _website: '' })
      if (error) throw new Error('Could not save access request')
      if (prior) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: request } = await service.from('early_access_requests').select('id,full_name,email,company').eq('email', email).single()
      if (!request) throw new Error('Could not read request')
      recipientEmail = 'ben.jameslee@gmail.com'
      idempotencyKey = `access-request-${request.id}`
      templateData = { name: request.full_name, email: request.email, company: request.company, inviteUrl: 'https://buildfolder.com/admin/early-access' }
    } else {
      const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: { user }, error: authError } = await service.auth.getUser(jwt)
      if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (templateName === 'company-invite') {
        if (!input.inviteId) throw new Error('Invitation is required')
        const { data: invite } = await service.from('company_invites').select('*').eq('id', input.inviteId).maybeSingle()
        if (!invite || invite.accepted_at || invite.cancelled_at || Date.parse(invite.expires_at) <= Date.now()) throw new Error('Invitation unavailable')
        const { data: team } = await service.from('teams').select('name,billing_owner_user_id,suspended_at').eq('id', invite.team_id).single()
        if (!team || team.billing_owner_user_id !== user.id || team.suspended_at) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        sourceInviteId = invite.id
        recipientEmail = invite.email
        idempotencyKey = `company-invite-${invite.id}-${Math.floor(Date.now() / 60000)}`
        templateData = { company: team.name, inviteUrl: `https://buildfolder.com/company-invite/${invite.token}` }
      } else if (templateName === 'beta-approval') {
        const { data: admin } = await service.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle()
        if (!admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        if (!input.requestId) throw new Error('Access request is required')
        const { data: request } = await service.from('early_access_requests').select('*').eq('id', input.requestId).eq('status', 'approved').single()
        if (!request) throw new Error('Request is not approved')
        recipientEmail = request.email
        idempotencyKey = `beta-approval-${request.id}-${Math.floor(Date.now() / 60000)}`
        templateData = { name: request.full_name, inviteUrl: `https://buildfolder.com/auth?tab=signup&beta=1&email=${encodeURIComponent(request.email)}` }
      } else {
        if (!user.email) throw new Error('Email required')
        recipientEmail = user.email
        idempotencyKey = `welcome-${user.id}`
        templateData = { name: String(user.user_metadata?.full_name ?? '') }
      }
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Could not process email request' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      code: suppressionError.code,
      message: suppressionError.message,
      recipient_redacted: redactEmail(effectiveRecipient),
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { templateName, recipient_redacted: redactEmail(effectiveRecipient) })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      code: tokenLookupError.code,
      message: tokenLookupError.message,
      email_redacted: redactEmail(normalizedEmail),
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        code: tokenError.code,
        message: tokenError.message,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        code: reReadError?.code,
        message: reReadError?.message,
        email_redacted: redactEmail(normalizedEmail),
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email_redacted: redactEmail(normalizedEmail),
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    if (sourceInviteId) await supabase.from('company_invites').update({ delivery_status: 'failed', delivery_error: 'Could not queue email' }).eq('id', sourceInviteId)
    console.error('Failed to enqueue email', {
      code: enqueueError.code,
      message: enqueueError.message,
      templateName,
      recipient_redacted: redactEmail(effectiveRecipient),
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, recipient_redacted: redactEmail(effectiveRecipient) })
  if (sourceInviteId) await supabase.from('company_invites').update({ delivery_status: 'queued', delivery_error: null }).eq('id', sourceInviteId)

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
