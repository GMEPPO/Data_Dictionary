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
    // URLs do webhook: produção e teste
    const N8N_WEBHOOK_PRODUCTION = 'https://groupegmpi.app.n8n.cloud/webhook/761b05cc-158e-4140-9f11-8be71f4d2f3a';
    const N8N_WEBHOOK_TEST = 'https://groupegmpi.app.n8n.cloud/webhook-test/761b05cc-158e-4140-9f11-8be71f4d2f3a';
    
    // Tentar primeiro com produção, depois com teste
    const urlsToTry = [N8N_WEBHOOK_PRODUCTION, N8N_WEBHOOK_TEST];
    
    let response;
    let lastError = null;
    let usedUrl = null;
    
    // Tentar cada URL
    for (const url of urlsToTry) {
      try {
        console.log('Tentando conectar com:', url);
        console.log('Payload:', JSON.stringify(req.body));
        
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        
        // Se a resposta for OK, usar esta URL
        if (response.ok) {
          usedUrl = url;
          console.log('Sucesso com URL:', url);
          break;
        }
        
        // Se for 404, tentar próxima URL
        if (response.status === 404) {
          console.log('URL não encontrada (404), tentando próxima...');
          continue;
        }
        
        // Outros erros, tentar próxima URL também
        const errorText = await response.text();
        console.log(`Erro ${response.status} com ${url}, tentando próxima...`);
        lastError = { status: response.status, message: errorText };
        continue;
        
      } catch (fetchError) {
        console.error('Erro de rede com', url, ':', fetchError.message);
        lastError = fetchError;
        // Continuar para próxima URL
        continue;
      }
    }
    
    // Se nenhuma URL funcionou
    if (!response || !response.ok) {
      console.error('Todas as URLs falharam. Último erro:', lastError);
      return res.status(200).json({
        message: 'Erro de conexão com o n8n. Tentei tanto a URL de produção quanto a de teste.\n\nVerifique:\n1. Se o workflow está ativo no n8n\n2. Se o método HTTP do webhook é POST\n3. Se as URLs estão corretas',
        links: [],
        documents: []
      });
    }

    // Obtener respuesta
    const data = await response.text();
    console.log('Status do n8n:', response.status);
    console.log('URL usada:', usedUrl);
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

