import React from 'react';
import './Message.css';

const Message = ({ message }) => {
  const isUser = message.sender === 'user';
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderLinks = (links) => {
    if (!links || links.length === 0) return null;
    
    return (
      <div className="message-links">
        <strong>Enlaces:</strong>
        {links.map((link, index) => (
          <a
            key={index}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="message-link"
          >
            🔗 {link}
          </a>
        ))}
      </div>
    );
  };

  const renderDocuments = (documents) => {
    if (!documents || documents.length === 0) return null;
    
    return (
      <div className="message-documents">
        <strong>Documentos:</strong>
        {documents.map((doc, index) => (
          <div key={index} className="message-document">
            📄 {doc}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-content">
        <div className="message-text">{message.text}</div>
        {renderLinks(message.links)}
        {renderDocuments(message.documents)}
        <div className="message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Message;

