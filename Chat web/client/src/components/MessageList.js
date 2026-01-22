import React from 'react';
import Message from './Message';
import './MessageList.css';

const MessageList = ({ messages, isLoading, messagesEndRef }) => {
  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <h2>¡Hola! Bienvenido al Chat</h2>
          <p>Escribe un mensaje para comenzar la conversación.</p>
          <p className="hint">Puedes recibir documentos y enlaces útiles.</p>
        </div>
      )}
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="loading-message">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;

