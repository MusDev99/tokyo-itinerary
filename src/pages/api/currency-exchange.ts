import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 15); // 🔄 Fixed to 30 days for reliability
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];

  const url = `https://api.investing.com/api/financialdata/historical/1902?start-date=${startDate}&end-date=${endDate}&time-frame=Daily&add-missing-rows=false`;

  try {
    const response = await fetch(url, {
      headers: {
        'Domain-Id': 'www',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': '__cf_bm=ljA9vbMxIbKhPDEvl7rEIsSJC_sm4x1JjpSm901cjio-1761834130-1.0.1.1-JkwEu31LFrxpuubrcVB6nUIYYp5J8wOKIAMegK9cyFR1cxPq0JpR4ZZ4QYMf3NXYNF4eGNevIHd8DuP6p_OmdSpZEl7TDcMFCoD8fPqHPToxx0sAlfUilg7ALFz6gsEc; __cflb=02DiuEaBtsFfH7bEbN4qQwLpwTUxNYEGxzBFQPgBQ18aY',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch currency data',
        status: response.status,
        details: errorText 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await response.json();
    console.log('✅ Data fetched successfully:', data);
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('💥 Error fetching currency data:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};