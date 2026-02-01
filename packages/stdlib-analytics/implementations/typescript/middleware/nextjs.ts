/**
 * Next.js Analytics Integration
 * 
 * Server and client-side analytics for Next.js applications.
 */

import type { NextRequest } from 'next/server';
import type { Analytics } from '../index';
import type { Context, PageContext, DeviceContext, CampaignContext } from '../types';

// ============================================
// Server-Side Analytics (API Routes / Server Components)
// ============================================

export interface NextAnalyticsOptions {
  /** Analytics client instance */
  analytics: Analytics;
  
  /** Extract user ID from request */
  getUserId?: (req: NextRequest) => string | undefined;
  
  /** Extract anonymous ID from cookies */
  getAnonymousId?: (req: NextRequest) => string | undefined;
}

/**
 * Create analytics context from Next.js request
 */
export function getAnalyticsContext(req: NextRequest): Context {
  return {
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined,
    locale: parseAcceptLanguage(req.headers.get('accept-language')),
    page: buildPageContext(req),
    device: buildDeviceContext(req),
    campaign: buildCampaignContext(req),
    referrer: buildReferrerContext(req),
  };
}

/**
 * Server-side track helper
 */
export function createServerAnalytics(
  analytics: Analytics,
  req: NextRequest,
  userId?: string
) {
  const context = getAnalyticsContext(req);
  const anonymousId = getAnonymousIdFromCookies(req);

  return {
    track: (event: string, properties?: Record<string, unknown>) => {
      return analytics.track({
        event,
        userId,
        anonymousId,
        properties,
        context,
      });
    },
    identify: (traits?: Record<string, unknown>) => {
      if (!userId) {
        return Promise.resolve({ ok: false, error: { code: 'INVALID_USER_ID', message: 'User ID required' } });
      }
      return analytics.identify({
        userId,
        anonymousId,
        traits,
        context,
      });
    },
    page: (name?: string, properties?: Record<string, unknown>) => {
      return analytics.page({
        userId,
        anonymousId,
        name,
        properties,
        context,
      });
    },
  };
}

// ============================================
// Client-Side Analytics (React Hooks)
// ============================================

/**
 * Client-side analytics config
 */
export interface ClientAnalyticsConfig {
  writeKey: string;
  provider: 'segment' | 'amplitude' | 'mixpanel' | 'posthog';
  debug?: boolean;
}

/**
 * Generate client-side analytics script
 */
export function getClientScript(config: ClientAnalyticsConfig): string {
  switch (config.provider) {
    case 'segment':
      return getSegmentScript(config.writeKey);
    case 'amplitude':
      return getAmplitudeScript(config.writeKey);
    case 'mixpanel':
      return getMixpanelScript(config.writeKey);
    case 'posthog':
      return getPostHogScript(config.writeKey);
    default:
      return '';
  }
}

function getSegmentScript(writeKey: string): string {
  return `
    !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="${writeKey}";analytics.SNIPPET_VERSION="4.15.3";
    analytics.load("${writeKey}");
    analytics.page();
    }}();
  `.trim();
}

function getAmplitudeScript(apiKey: string): string {
  return `
    !function(){"use strict";!function(e,t){var n=e.amplitude||{_q:[],_iq:{}};if(n.invoked)e.console&&console.error&&console.error("Amplitude snippet has been loaded.");else{var r=function(e,t){e.prototype[t]=function(){return this._q.push({name:t,args:Array.prototype.slice.call(arguments,0)}),this}},s=function(e,t,n){return function(r){e._q.push({name:t,args:Array.prototype.slice.call(n,0),resolve:r})}},o=function(e,t,n){e[t]=function(){if(n)return{promise:new Promise(s(e,t,Array.prototype.slice.call(arguments)))}}},i=function(e){for(var t=0;t<m.length;t++)o(e,m[t],!1);for(var n=0;n<g.length;n++)o(e,g[n],!0)};n.invoked=!0;var u=t.createElement("script");u.type="text/javascript",u.integrity="sha384-x0ik2D45ZDEEEpYpEuDpmj05fY1PIdKs/PKeyVQ9x6q4E7xM9LlXGtLZMwE8m2qx",u.crossOrigin="anonymous",u.async=!0,u.src="https://cdn.amplitude.com/libs/analytics-browser-2.0.0-min.js.gz",u.onload=function(){e.amplitude.runQueuedFunctions||console.log("[Amplitude] Error: could not load SDK")};var a=t.getElementsByTagName("script")[0];a.parentNode.insertBefore(u,a);for(var c=function(){return this._q=[],this},p=["add","append","clearAll","prepend","set","setOnce","unset","preInsert","postInsert","remove","getUserProperties"],l=0;l<p.length;l++)r(c,p[l]);n.Identify=c;for(var d=function(){return this._q=[],this},f=["getEventProperties","setProductId","setQuantity","setPrice","setRevenue","setRevenueType","setEventProperties"],v=0;v<f.length;v++)r(d,f[v]);n.Revenue=d;var m=["getDeviceId","setDeviceId","getSessionId","setSessionId","getUserId","setUserId","setOptOut","setTransport","reset"],g=["init","add","remove","track","logEvent","identify","groupIdentify","setGroup","revenue","flush"];i(n),n.createInstance=function(){var e=n._iq.push({_q:[]})-1;return i(n._iq[e]),n._iq[e]},e.amplitude=n}}(window,document)}();
    amplitude.init("${apiKey}");
  `.trim();
}

function getMixpanelScript(token: string): string {
  return `
    (function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===f.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
    mixpanel.init("${token}");
  `.trim();
}

function getPostHogScript(apiKey: string): string {
  return `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init("${apiKey}", {api_host: 'https://app.posthog.com'});
  `.trim();
}

// ============================================
// React Component for Script Injection
// ============================================

/**
 * Props for AnalyticsScript component
 */
export interface AnalyticsScriptProps {
  config: ClientAnalyticsConfig;
}

/**
 * Generate script tag for Next.js
 * Use in _document.tsx or layout.tsx
 */
export function getAnalyticsScriptTag(config: ClientAnalyticsConfig): string {
  const script = getClientScript(config);
  return `<script>${script}</script>`;
}

// ============================================
// Helper Functions
// ============================================

function buildPageContext(req: NextRequest): PageContext {
  const url = req.url;
  const urlObj = new URL(url);

  return {
    path: urlObj.pathname,
    url,
    search: urlObj.search || undefined,
    referrer: req.headers.get('referer') || undefined,
  };
}

function buildDeviceContext(req: NextRequest): DeviceContext {
  const ua = req.headers.get('user-agent') || '';
  
  return {
    type: detectDeviceType(ua),
    browser: detectBrowser(ua),
    osName: detectOS(ua),
  };
}

function buildCampaignContext(req: NextRequest): CampaignContext | undefined {
  const url = new URL(req.url);
  const params = url.searchParams;
  
  if (!params.get('utm_source') && !params.get('utm_campaign')) {
    return undefined;
  }

  return {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    name: params.get('utm_campaign') || undefined,
    term: params.get('utm_term') || undefined,
    content: params.get('utm_content') || undefined,
  };
}

function buildReferrerContext(req: NextRequest): { url?: string } | undefined {
  const referrer = req.headers.get('referer');
  if (!referrer) return undefined;
  return { url: referrer };
}

function getClientIP(req: NextRequest): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         undefined;
}

function getAnonymousIdFromCookies(req: NextRequest): string | undefined {
  const cookies = req.cookies;
  return cookies.get('anonymousId')?.value;
}

function parseAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^([a-zA-Z]{2}(-[a-zA-Z]{2})?)/);
  return match ? match[1] : undefined;
}

function detectDeviceType(ua: string): string {
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function detectBrowser(ua: string): string | undefined {
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  if (/edge/i.test(ua)) return 'Edge';
  return undefined;
}

function detectOS(ua: string): string | undefined {
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  return undefined;
}
