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
    for (let i = 0; i < urlsToTry.length; i++) {
      const url = urlsToTry[i];
      const isTestUrl = url.includes('webhook-test');
      
      try {
        console.log(`[Tentativa ${i + 1}/${urlsToTry.length}] Tentando conectar com:`, url);
        console.log('Payload:', JSON.stringify(req.body));
        
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
          timeout: 30000, // 30 segundos
        });
        
        console.log(`Resposta recebida de ${isTestUrl ? 'TEST' : 'PRODUCTION'}: Status ${response.status}`);
        
        // Se a resposta for OK, usar esta URL
        if (response.ok) {
          usedUrl = url;
          console.log(`✅ Sucesso com URL ${isTestUrl ? 'TEST' : 'PRODUCTION'}:`, url);
          break;
        }
        
        // Ler o texto da resposta para diagnóstico
        const errorText = await response.text();
        console.log(`❌ Erro ${response.status} com ${isTestUrl ? 'TEST' : 'PRODUCTION'}:`, errorText.substring(0, 200));
        
        // Se for 404 ou "not registered", tentar próxima URL
        if (response.status === 404 || 
            errorText.includes('not registered') || 
            errorText.includes('não está registrado') ||
            errorText.includes('is not registered')) {
          console.log(`⚠️ Webhook não registrado em ${isTestUrl ? 'TEST' : 'PRODUCTION'}, tentando próxima URL...`);
          lastError = { 
            status: response.status, 
            message: errorText,
            url: isTestUrl ? 'TEST' : 'PRODUCTION'
          };
          
          // Se é a última URL, não continuar
          if (i === urlsToTry.length - 1) {
            break;
          }
          continue;
        }
        
        // Outros erros HTTP, tentar próxima URL também
        lastError = { 
          status: response.status, 
          message: errorText,
          url: isTestUrl ? 'TEST' : 'PRODUCTION'
        };
        
        // Se é a última URL, não continuar
        if (i === urlsToTry.length - 1) {
          break;
        }
        continue;
        
      } catch (fetchError) {
        console.error(`❌ Erro de rede com ${isTestUrl ? 'TEST' : 'PRODUCTION'}:`, fetchError.message);
        lastError = { 
          error: fetchError.message,
          url: isTestUrl ? 'TEST' : 'PRODUCTION'
        };
        
        // Se é a última URL, não continuar
        if (i === urlsToTry.length - 1) {
          break;
        }
        // Continuar para próxima URL
        continue;
      }
    }
    
    // Se nenhuma URL funcionou
    if (!response || !response.ok) {
      console.error('❌ Todas as URLs falharam. Último erro:', lastError);
      
      const errorDetails = [];
      if (lastError?.url) {
        errorDetails.push(`Última tentativa: ${lastError.url}`);
      }
      if (lastError?.status) {
        errorDetails.push(`Status: ${lastError.status}`);
      }
      if (lastError?.message) {
        errorDetails.push(`Mensagem: ${lastError.message.substring(0, 100)}`);
      }
      
      return res.status(200).json({
        message: `Erro de conexão com o n8n.\n\nTentei ambas as URLs (produção e teste) mas nenhuma funcionou.\n\n${errorDetails.join('\n')}\n\nVerifique:\n1. Se o workflow está ATIVO no n8n\n2. Se o método HTTP do webhook é POST (não GET)\n3. Se está usando a URL correta (Production ou Test)\n4. Se o webhook está configurado corretamente`,
        links: [],
        documents: []
      });
    }

    // Obtener respuesta
    const data = await response.text();
    const urlType = usedUrl?.includes('webhook-test') ? 'TEST' : 'PRODUCTION';
    console.log(`✅ Status do n8n (${urlType}):`, response.status);
    console.log(`✅ URL usada (${urlType}):`, usedUrl);
    console.log('✅ Resposta do n8n:', data.substring(0, 200));

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

