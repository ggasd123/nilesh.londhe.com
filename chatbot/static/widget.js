/**
 * LV Nilesh Chat Widget
 * Embed this script on your website to add the chatbot
 */

(function() {
  // Configuration
  const CONFIG = {
    apiBaseUrl: '', // Will be set to current origin
    welcomeMessage: "Hi! I'm an AI trained on LV Nilesh's tweets. Ask me anything!"
  };

  // Create widget elements
  function createWidget() {
    // Container
    const container = document.createElement('div');
    container.id = 'lvnilesh-chat-widget';

    // Chat button
    const button = document.createElement('button');
    button.className = 'lvnilesh-chat-button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    `;

    // Chat window
    const windowEl = document.createElement('div');
    windowEl.className = 'lvnilesh-chat-window';
    windowEl.innerHTML = `
      <div class="lvnilesh-chat-header">
        <h3>LV Nilesh Bot</h3>
        <button class="lvnilesh-chat-close">&times;</button>
      </div>
      <div class="lvnilesh-chat-messages"></div>
      <div class="lvnilesh-chat-input-container">
        <input type="text" class="lvnilesh-chat-input" placeholder="Ask me anything...">
        <button class="lvnilesh-chat-send">Send</button>
      </div>
    `;

    container.appendChild(button);
    container.appendChild(windowEl);
    document.body.appendChild(container);

    // Add CSS
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `${CONFIG.apiBaseUrl}/widget.css`;
    document.head.appendChild(style);

    return { container, button, windowEl };
  }

  // Initialize widget
  function initWidget() {
    const { button, windowEl } = createWidget();
    const closeBtn = windowEl.querySelector('.lvnilesh-chat-close');
    const input = windowEl.querySelector('.lvnilesh-chat-input');
    const sendBtn = windowEl.querySelector('.lvnilesh-chat-send');
    const messages = windowEl.querySelector('.lvnilesh-chat-messages');

    // State
    let isOpen = false;

    // Toggle chat window
    function toggleChat() {
      isOpen = !isOpen;
      windowEl.classList.toggle('active', isOpen);
      if (isOpen && messages.children.length === 0) {
        addBotMessage(CONFIG.welcomeMessage);
      }
      if (isOpen) {
        input.focus();
      }
    }

    // Add message to chat
    function addUserMessage(text) {
      const msg = document.createElement('div');
      msg.className = 'lvnilesh-chat-message user';
      msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    function addBotMessage(text, sources = []) {
      const msg = document.createElement('div');
      msg.className = 'lvnilesh-chat-message bot';
      
      const textEl = document.createElement('div');
      textEl.textContent = text;
      msg.appendChild(textEl);

      if (sources.length > 0) {
        const sourcesEl = document.createElement('div');
        sourcesEl.className = 'sources';
        sourcesEl.innerHTML = '<strong>Based on:</strong><br>' + 
          sources.map(s => `• ${s.text.substring(0, 50)}... (${s.date.substring(0, 10)})`).join('<br>');
        msg.appendChild(sourcesEl);
      }

      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
      const typing = document.createElement('div');
      typing.className = 'lvnilesh-chat-message bot lvnilesh-chat-typing';
      typing.id = 'typing-indicator';
      typing.innerHTML = '<span></span><span></span><span></span>';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      return typing;
    }

    function hideTyping() {
      const typing = document.getElementById('typing-indicator');
      if (typing) typing.remove();
    }

    // Send message
    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      sendBtn.disabled = true;
      addUserMessage(text);

      const typing = showTyping();

      try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });

        hideTyping();

        if (!response.ok) {
          throw new Error('API error');
        }

        const data = await response.json();
        addBotMessage(data.response, data.sources || []);

      } catch (error) {
        hideTyping();
        addBotMessage("Sorry, I'm having trouble connecting right now. Please try again later.");
      }

      sendBtn.disabled = false;
      input.focus();
    }

    // Event listeners
    button.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Set API base URL to current origin
    CONFIG.apiBaseUrl = window.location.origin;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
