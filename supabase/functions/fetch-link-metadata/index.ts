import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching metadata for URL:', url);

    // Fetch the HTML content with more realistic headers
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
    });

    if (!response.ok) {
      console.error(`Failed to fetch URL: ${response.status}`);
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
    console.error('Error fetching metadata:', error);
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
