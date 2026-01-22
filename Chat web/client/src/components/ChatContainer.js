import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatContainer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ChatContainer = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: text,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: text,
        sessionId: sessionId
      });

      // Si la respuesta está pendiente, hacer polling
      if (response.data.pending && response.data.messageId) {
        pollForResponse(response.data.messageId);
      } else {
        const assistantMessage = {
          id: Date.now() + 1,
          text: response.data.message,
          sender: 'assistant',
          timestamp: new Date(),
          links: response.data.links || [],
          documents: response.data.documents || []
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        sender: 'assistant',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const pollForResponse = async (messageId, attempts = 0) => {
    const maxAttempts = 30; // 30 intentos = 30 segundos máximo
    const pollInterval = 1000; // 1 segundo

    if (attempts >= maxAttempts) {
      const timeoutMessage = {
        id: Date.now() + 1,
        text: 'Tiempo de espera agotado. Por favor, intenta de nuevo.',
        sender: 'assistant',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, timeoutMessage]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/response/${messageId}`);
      
      const assistantMessage = {
        id: Date.now() + 1,
        text: response.data.message,
        sender: 'assistant',
        timestamp: new Date(),
        links: response.data.links || [],
        documents: response.data.documents || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    } catch (error) {
      // Si no hay respuesta aún, intentar de nuevo
      if (error.response?.status === 404) {
        setTimeout(() => pollForResponse(messageId, attempts + 1), pollInterval);
      } else {
        console.error('Error al obtener respuesta:', error);
        setIsLoading(false);
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
    axios.delete(`${API_URL}/responses`).catch(console.error);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>💬 Chat Web</h1>
        <button onClick={clearChat} className="clear-button">
          Limpiar Chat
        </button>
      </div>
      <MessageList 
        messages={messages} 
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
      />
      <MessageInput onSendMessage={sendMessage} disabled={isLoading} />
    </div>
  );
};

export default ChatContainer;

