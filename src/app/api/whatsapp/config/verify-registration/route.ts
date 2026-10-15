import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  getPhoneNumberOwningWabaId,
  getSubscribedApps,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { appSubscriptionState } from '@/lib/whatsapp/waba-pairing'
import { getT } from '@/lib/i18n/translate'

const t = getT('Api')

/**
 * GET /api/whatsapp/config/verify-registration
 *
 * Diagnostic endpoint — confirms the user's saved phone number is
 * actually reachable on Meta's side. Solves the failure mode that
 * surfaced the multi-number bug originally: "UI says Connected but
 * Meta isn't delivering events."
 *
 * Four checks run independently so the UI can show which step
 * passes and which fails:
 *
 *   1. phone_info  — GET /{phone_number_id} succeeds
 *   2. waba_id_matches_number — the saved WABA ID is the one Meta
 *                    reports in the number's health_status
 *   3. waba_subscription — our app appears in
 *                    GET /{owning_waba_id}/subscribed_apps
 *   4. registered_at — local timestamp set by POST /config when
 *                    /register last succeeded; NULL means the
 *                    number was saved but never actually subscribed
 *
 * Returns 200 in every case so the UI can render diagnostic detail
 * rather than a generic error toast. The combined `live` flag is
 * what the UI badges on.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: t('common.unauthorized') }, { status: 401 })
  }

  // whatsapp_config is one-row-per-account post-017. Resolve the
  // caller's account_id so a teammate who joined an existing account
  // sees the same registration state as the admin who set it up.
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const accountId = profile?.account_id as string | undefined
  if (!accountId) {
    return NextResponse.json({
      live: false,
      checks: { config_exists: false },
      message: t('common.profileNotLinked'),
    })
  }

  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({
      live: false,
      checks: { config_exists: false },
      message: t('whatsappConfig.noConfigShort'),
    })
  }

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    return NextResponse.json({
      live: false,
      checks: {
        config_exists: true,
        token_decryptable: false,
      },
      message:
        t('whatsappConfig.tokenUndecryptable'),
    })
  }

  const checks: {
    config_exists: boolean
    token_decryptable: boolean
    phone_metadata_ok: boolean
    waba_id_matches_number: boolean | null
    waba_subscribed_to_app: boolean | null
    locally_marked_registered: boolean
  } = {
    config_exists: true,
    token_decryptable: true,
    phone_metadata_ok: false,
    waba_id_matches_number: null,
    waba_subscribed_to_app: null,
    locally_marked_registered: config.registered_at != null,
  }
  const errors: string[] = []

  // 1. Phone metadata
  try {
    await verifyPhoneNumber({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })
    checks.phone_metadata_ok = true
  } catch (err) {
    errors.push(
      t('whatsappConfig.phoneCheckFailed', { message: err instanceof Error ? err.message : String(err) }),
    )
  }

  // 2. Which WABA does Meta route this number through? A saved WABA ID
  //    can pass every other check (it may even list the number) while
  //    Meta delivers the number's webhooks via a different WABA — one
  //    that nobody subscribed. Best-effort: null when Meta won't say.
  let owningWabaId: string | null = null
  try {
    owningWabaId = await getPhoneNumberOwningWabaId({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })
  } catch (err) {
    console.warn(
      '[verify-registration] owning WABA lookup failed:',
      err instanceof Error ? err.message : err,
    )
  }
  if (owningWabaId && config.waba_id) {
    checks.waba_id_matches_number = owningWabaId === config.waba_id
    if (!checks.waba_id_matches_number) {
      errors.push(
        t('whatsappConfig.wabaNotOwner', { owner: owningWabaId, configured: config.waba_id }),
      )
    }
  }

  // 3. WABA subscription — checked on the WABA Meta actually routes
  //    through, falling back to the saved one.
  const wabaToCheck = owningWabaId ?? config.waba_id
  if (wabaToCheck) {
    try {
      const subs = await getSubscribedApps({
        wabaId: wabaToCheck,
        accessToken,
      })
      // Meta lists EVERY app subscribed to the WABA, not just the one
      // the token belongs to — so "non-empty" doesn't prove it's ours.
      // With META_APP_ID set we can check for our app by id.
      const state = appSubscriptionState(subs, process.env.META_APP_ID)
      checks.waba_subscribed_to_app = state.appIdMatch ?? state.subscribed
      if (!state.subscribed) {
        errors.push(t('whatsappConfig.wabaNoApps'))
      } else if (state.appIdMatch === false) {
        errors.push(
          t('whatsappConfig.wabaWrongApp', { appId: process.env.META_APP_ID!.trim() }),
        )
      }
    } catch (err) {
      errors.push(
        t('whatsappConfig.wabaCheckFailed', { message: err instanceof Error ? err.message : String(err) }),
      )
    }
  }
  if (!config.waba_id) {
    errors.push(
      t('whatsappConfig.noWabaId'),
    )
  }

  const live =
    checks.phone_metadata_ok &&
    checks.waba_id_matches_number !== false &&
    (checks.waba_subscribed_to_app ?? false) &&
    checks.locally_marked_registered

  return NextResponse.json({
    live,
    checks,
    errors,
    owning_waba_id: owningWabaId,
    last_registration_error: config.last_registration_error ?? null,
    registered_at: config.registered_at ?? null,
    subscribed_apps_at: config.subscribed_apps_at ?? null,
  })
}
