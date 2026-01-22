const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// URL del webhook de n8n (configurar en .env)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat';

// Almacenar respuestas pendientes por mensajeId
const pendingResponses = new Map();

// Endpoint para enviar mensaje a n8n
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const messageId = Date.now().toString();
    const sessionKey = sessionId || 'default';

    // Enviar mensaje a n8n
    const payload = {
      message: message,
      sessionId: sessionKey,
      messageId: messageId,
      timestamp: new Date().toISOString()
    };

    console.log('Enviando a n8n:', payload);

    try {
      // Enviar a n8n y esperar respuesta
      const n8nResponse = await axios.post(N8N_WEBHOOK_URL, payload, {
        timeout: 30000 // 30 segundos de timeout
      });

      // Si n8n responde directamente, devolver la respuesta
      if (n8nResponse.data) {
        const responseData = n8nResponse.data;
        
        // Detectar enlaces y documentos en la respuesta
        const responseText = responseData.message || responseData.response || JSON.stringify(responseData);
        const links = extractLinks(responseText);
        const documents = extractDocumentReferences(responseText);

        return res.json({
          message: responseText,
          links: links,
          documents: responseData.documents || documents,
          sessionId: sessionKey,
          messageId: messageId
        });
      }

      // Si n8n no responde inmediatamente, indicar que se procesará
      return res.json({
        message: 'Mensaje recibido, procesando...',
        sessionId: sessionKey,
        messageId: messageId,
        pending: true
      });

    } catch (error) {
      console.error('Error al comunicarse con n8n:', error.message);
      
      // Si es timeout, indicar que se procesará después
      if (error.code === 'ECONNABORTED') {
        return res.json({
          message: 'Mensaje enviado, esperando respuesta...',
          sessionId: sessionKey,
          messageId: messageId,
          pending: true
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ 
      error: 'Error al procesar el mensaje',
      details: error.message 
    });
  }
});

// Endpoint para recibir respuestas de n8n (webhook que n8n llamará)
app.post('/api/webhook/n8n-response', (req, res) => {
  try {
    const { messageId, message, links, documents, sessionId } = req.body;

    console.log('Respuesta recibida de n8n:', req.body);

    // Almacenar respuesta para que el cliente la pueda obtener
    if (messageId) {
      pendingResponses.set(messageId, {
        message: message || 'Respuesta recibida',
        links: links || [],
        documents: documents || [],
        sessionId: sessionId,
        timestamp: new Date()
      });
    }

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error en webhook de n8n:', error);
    res.status(500).json({ error: 'Error al procesar respuesta' });
  }
});

// Endpoint para obtener respuesta pendiente
app.get('/api/response/:messageId', (req, res) => {
  const { messageId } = req.params;
  const response = pendingResponses.get(messageId);
  
  if (response) {
    pendingResponses.delete(messageId); // Eliminar después de obtener
    return res.json(response);
  }
  
  res.status(404).json({ error: 'Respuesta no encontrada' });
});

// Endpoint para limpiar respuestas antiguas
app.delete('/api/responses', (req, res) => {
  pendingResponses.clear();
  res.json({ success: true });
});

// Función para extraer enlaces del texto
function extractLinks(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Función para extraer referencias a documentos
function extractDocumentReferences(text) {
  if (!text) return [];
  const docRegex = /(?:documento|archivo|file|descargar|download)[\s:]+([^\s]+\.(pdf|doc|docx|txt|zip|rar))/gi;
  const matches = [];
  let match;
  while ((match = docRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

