// Very lightweight chatbot widget integrated into the Finly frontend
(function(){
  // Avoid duplication if widget already exists
  if (document.getElementById('finly-chat-widget')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'finly-chat-widget';
  wrapper.style.position = 'fixed';
  wrapper.style.bottom = '20px';
  wrapper.style.right = '20px';
  wrapper.style.width = '320px';
  wrapper.style.height = '420px';
  wrapper.style.background = '#fff';
  wrapper.style.borderRadius = '12px';
  wrapper.style.boxShadow = '0 8px 28px rgba(0,0,0,.15)';
  wrapper.style.overflow = 'hidden';
  wrapper.style.zIndex = '9999';
  wrapper.innerHTML = `
    <div style="padding:8px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:6px;">
      <img src="/assets/chatbot-logo.svg" alt="Finly logo" width="18" height="18" onerror="this.style.display='none'"/>
      <strong style="font-size:14px;">Finly Assistant</strong>
      <button id="finly-chat-close" style="margin-left:auto;border:0;background:transparent;cursor:pointer">✕</button>
    </div>
    <div id="finly-chat-messages" style="height:72%; overflow:auto; padding:8px; background:#f7f7fb;">
    </div>
    <div style="display:flex; gap:6px; padding:8px;">
      <input id="finly-chat-input" placeholder="Ask Finly..." style="flex:1; padding:6px 8px; border:1px solid #ddd; border-radius:6px;" />
      <button id="finly-chat-send" style="padding:6px 12px; border-radius:6px; border:none; background:#2563eb; color:white; cursor:pointer">Send</button>
    </div>
  `;
  document.body.appendChild(wrapper);

  const closeBtn = document.getElementById('finly-chat-close');
  const input = document.getElementById('finly-chat-input');
  const messages = document.getElementById('finly-chat-messages');
  const send = document.getElementById('finly-chat-send');
  const base = '/api/v1/chat';
  closeBtn?.addEventListener('click', () => {
    wrapper.style.display = 'none';
  });
  send?.addEventListener('click', async () => {
    const text = String(input.value || '').trim();
    if (!text) return;
    input.value = '';
    // display user message
    const userNode = document.createElement('div'); userNode.textContent = `You: ${text}`; userNode.style.textAlign='right';
    messages.appendChild(userNode);
    // call Finly backend chat proxy (existing /api/v1/chat)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, workspace: 'user', section: 'dashboard' }),
        credentials: 'include'
      });
      const payload = await res.json();
      const reply = payload?.data?.reply ?? payload?.reply ?? '';
      if (reply) {
        const botNode = document.createElement('div'); botNode.textContent = `Assistant: ${reply}`; messages.appendChild(botNode);
      } else {
        const botNode = document.createElement('div'); botNode.textContent = 'Assistant: (no reply)'; messages.appendChild(botNode);
      }
    } catch (e) {
      const errNode = document.createElement('div'); errNode.textContent = 'Assistant: failed to contact server'; messages.appendChild(errNode);
    }
    messages.scrollTop = messages.scrollHeight;
  });
})();
