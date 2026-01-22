// API Route de Vercel para hacer proxy a n8n y evitar CORS
export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const N8N_WEBHOOK_URL = 'https://groupegmpi.app.n8n.cloud/webhook/761b05cc-158e-4140-9f11-8be71f4d2f3a';
    
    // Enviar petición a n8n
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    // Verificar si la respuesta es OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro do n8n:', response.status, errorText);
      
      // Se o webhook não está registrado, retornar mensagem amigável
      if (response.status === 404 || errorText.includes('not registered')) {
        return res.status(200).json({
          message: 'O webhook do n8n não está registrado ou o workflow não está ativo. Por favor, verifique se o workflow está ativo no n8n.',
          links: [],
          documents: []
        });
      }
      
      return res.status(response.status).json({
        error: 'Erro ao conectar com n8n',
        message: errorText || `Erro ${response.status}`,
        links: [],
        documents: []
      });
    }

    // Obtener respuesta
    const data = await response.text();
    
    // Intentar parsear como JSON, si falla devolver como texto
    let responseData;
    try {
      responseData = JSON.parse(data);
    } catch {
      responseData = { message: data, links: [], documents: [] };
    }

    // Asegurar formato correcto
    if (!responseData.message && typeof responseData === 'string') {
      responseData = { message: responseData, links: [], documents: [] };
    } else if (!responseData.message) {
      responseData = { message: JSON.stringify(responseData), links: [], documents: [] };
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error al conectar con n8n:', error);
    return res.status(500).json({
      error: 'Error al conectar con n8n',
      message: error.message
    });
  }
}

