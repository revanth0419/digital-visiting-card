import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RateLimitRecord = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  const record: RateLimitRecord = existing && now < existing.resetAt
    ? existing
    : { count: 0, resetAt: now + windowMs };

  if (record.count >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  rateBuckets.set(key, record);
  return { allowed: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Authentication failed:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('Authenticated user:', user.id);

    // Basic server-side rate limiting (per instance)
    const limit = checkRateLimit(`fetch-link-metadata:${user.id}`, 30, 10 * 60 * 1000);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', retryAfterSeconds: limit.retryAfterSeconds }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(limit.retryAfterSeconds ?? 60),
          },
        }
      );
    }

    const { url } = await req.json();

    // Validate URL is provided and is a string
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid URL string required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow http and https URLs
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return new Response(
        JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format and block internal/private IP ranges
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Block localhost and private IPs to prevent SSRF attacks
      const blockedPatterns = [
        /^localhost$/i,
        /^127\.\d+\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/, // Cloud metadata endpoint
        /^\[?::1\]?$/, // IPv6 localhost
        /^\[?fe80:/i, // IPv6 link-local
        /^\[?fc00:/i, // IPv6 private
      ];
      
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return new Response(
          JSON.stringify({ error: 'URL not allowed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (urlError) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching metadata for URL:', url);

    // Fetch the HTML content with more realistic headers and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Log for server-side monitoring (safe in edge functions)
      console.log(JSON.stringify({
        level: 'error',
        message: 'Failed to fetch URL',
        status: response.status,
      }));
      // Return partial success instead of throwing
      return new Response(
        JSON.stringify({
          error: `Failed to fetch: ${response.status}`,
          imageUrl: null,
          title: null,
          price: null,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const html = await response.text();

    // Extract Open Graph metadata
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogPriceMatch = html.match(/<meta[^>]*property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i);
    
    // Fallback to regular meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const imageMatch = html.match(/<meta[^>]*name=["']image["'][^>]*content=["']([^"']+)["']/i);
    
    // Try to extract price from various common patterns
    const pricePatterns = [
      /["']price["'][^>]*content=["']([^"']+)["']/i,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)/,
      /\$\s*([0-9,]+(?:\.[0-9]{2})?)/,
      /price["\s:]+([0-9,]+(?:\.[0-9]{2})?)/i,
    ];
    
    let priceMatch = ogPriceMatch?.[1];
    if (!priceMatch) {
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          priceMatch = match[1];
          break;
        }
      }
    }

    const imageUrl = ogImageMatch?.[1] || imageMatch?.[1] || null;
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || null;
    const price = priceMatch || null;

    console.log('Extracted metadata:', { imageUrl, title, price });

    return new Response(
      JSON.stringify({
        imageUrl,
        title,
        price,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    // Log for server-side monitoring (safe in edge functions)
    console.log(JSON.stringify({
      level: 'error',
      message: 'Error fetching metadata',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        imageUrl: null,
        title: null,
        price: null,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
