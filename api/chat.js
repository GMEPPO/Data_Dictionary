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
    
    console.log('Enviando para n8n:', N8N_WEBHOOK_URL);
    console.log('Payload:', JSON.stringify(req.body));
    
    // Enviar petición a n8n
    let response;
    try {
      response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
    } catch (fetchError) {
      console.error('Erro de rede ao conectar com n8n:', fetchError);
      return res.status(200).json({
        message: 'Erro de conexão com o n8n. Verifique se o workflow está ativo e se a URL do webhook está correta.',
        links: [],
        documents: []
      });
    }

    // Obtener respuesta
    const data = await response.text();
    console.log('Status do n8n:', response.status);
    console.log('Resposta do n8n:', data.substring(0, 200));

    // Verificar si la respuesta es OK
    if (!response.ok) {
      console.error('Erro do n8n:', response.status, data);
      
      // Se o webhook não está registrado, retornar mensagem amigável
      if (response.status === 404 || data.includes('not registered') || data.includes('não está registrado')) {
        return res.status(200).json({
          message: 'O webhook do n8n não está registrado ou o workflow não está ativo.\n\nPor favor:\n1. Abra o n8n\n2. Verifique se o workflow está ATIVO (toggle no canto superior direito)\n3. Verifique se o método HTTP do webhook é POST\n4. Use a Production URL (não a Test URL)',
          links: [],
          documents: []
        });
      }
      
      // Outros erros HTTP
      return res.status(200).json({
        message: `Erro ao conectar com n8n (Status ${response.status}).\n\nResposta: ${data.substring(0, 200)}`,
        links: [],
        documents: []
      });
    }
    
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

