export function createTranscriptChatController() {
    let currentTranscriptId = null;
    let currentTranscriptText = null;
    let messages = [];
    let isLoading = false;
    let chatModalInstance = null; // Reference to the modal instance

    const modalChatMessagesDiv = document.getElementById('modal-chat-messages');
    const modalChatInput = document.getElementById('modal-chat-input');
    const modalSendButton = document.getElementById('modal-send-button');
    const modalTitleSpan = document.getElementById('modal-transcript-id');

    const formatMarkdown = (text) => {
         if (!text) return '';
         let formattedText = text;
         formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
         formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
         formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
         formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
         formattedText = formattedText.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
         formattedText = formattedText.replace(/(\<li.*\>.*?\<\/li\>)/gs, '<ul class="list-unstyled ps-3 mt-2">$1</ul>');
         formattedText = formattedText.replace(/\n/g, '<br>');
         return formattedText;
    };

    const renderMessages = () => {
        if (!modalChatMessagesDiv) return;
        modalChatMessagesDiv.innerHTML = '';
        messages.forEach(message => {
            const messageWrapper = document.createElement('div');
            messageWrapper.className = `message ${message.sender === 'user' ? 'user-message' : ''}`;

            const avatar = document.createElement('div');
            avatar.className = `avatar ${message.sender === 'user' ? 'user-avatar' : 'bot-avatar'}`;
            avatar.innerHTML = `<i class="fas ${message.sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>`;

            const content = document.createElement('div');
            content.className = 'message-content';

            if (message.type === 'typing') {
                 content.classList.add('typing-indicator');
                 content.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
                 messageWrapper.appendChild(avatar); // Avatar needed for typing indicator too
                 messageWrapper.appendChild(content);
            } else {
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                textDiv.innerHTML = message.sender === 'bot' ? formatMarkdown(message.text) : message.text; // Apply formatting here
                content.appendChild(textDiv);
                messageWrapper.appendChild(avatar);
                messageWrapper.appendChild(content);
            }
            modalChatMessagesDiv.appendChild(messageWrapper);
        });
        scrollToBottom();
    };

    const addMessage = (sender, text, type = 'text') => {
        messages.push({ sender, text, type, id: Date.now() + Math.random() });
        renderMessages();
    };

    const addTypingIndicator = () => {
        messages.push({ sender: 'bot', type: 'typing', id: 'typing-indicator' });
        renderMessages();
    }

    const removeTypingIndicator = () => {
         messages = messages.filter(m => m.id !== 'typing-indicator');
         renderMessages(); // Re-render after removing
    }

    const scrollToBottom = () => {
         Vue.nextTick(() => {
            if (modalChatMessagesDiv) {
                modalChatMessagesDiv.scrollTop = modalChatMessagesDiv.scrollHeight;
            }
         });
    };

    const sendMessage = async () => {
        const messageText = modalChatInput.value.trim();
        if (!messageText || isLoading || !currentTranscriptText) return;

        addMessage('user', messageText);
        modalChatInput.value = '';
        isLoading = true;
        modalSendButton.disabled = true;
        modalChatInput.disabled = true;
        addTypingIndicator();

        const prompt = `You are SupertailsAI, analyzing a specific customer service transcript.
        Transcript ID: ${currentTranscriptId}
        Transcript Content:
        ---
        ${currentTranscriptText}
        ---
        User's Question: ${messageText}

        Answer the user's question based *only* on the provided transcript content. If the information isn't present, state that clearly. Do not make assumptions or use external knowledge. Be concise and professional.`;

        try {
             // Use the globally available app instance method
             const botResponse = await window.app.callGeminiAPI(prompt);
             removeTypingIndicator();
             addMessage('bot', botResponse);
        } catch (error) {
            removeTypingIndicator();
            addMessage('bot', `Sorry, an error occurred: ${error.message}`);
            console.error("Error sending modal message:", error);
        } finally {
            isLoading = false;
            modalSendButton.disabled = false;
            modalChatInput.disabled = false;
             Vue.nextTick(() => modalChatInput.focus()); // Refocus input
        }
    };

    const startChat = (transcriptId, transcriptText) => {
        currentTranscriptId = transcriptId;
        currentTranscriptText = transcriptText;
        messages = []; // Clear previous messages
        if(modalTitleSpan) modalTitleSpan.textContent = transcriptId;
        addMessage('bot', `Chatting about transcript ${transcriptId}. Ask me anything specific to this conversation.`);
        if(modalChatInput) modalChatInput.value = '';
        if(modalSendButton) modalSendButton.disabled = false;
         if(modalChatInput) modalChatInput.disabled = false;
         isLoading = false;
         Vue.nextTick(() => modalChatInput.focus()); // Focus input when modal opens
    };

    const resetChat = () => {
        currentTranscriptId = null;
        currentTranscriptText = null;
        messages = [];
        isLoading = false;
         if(modalChatMessagesDiv) modalChatMessagesDiv.innerHTML = '';
         if(modalChatInput) modalChatInput.value = '';
         if(modalTitleSpan) modalTitleSpan.textContent = '';
         if(modalSendButton) modalSendButton.disabled = true;
         if(modalChatInput) modalChatInput.disabled = true;
    };

    // Event Listeners
    if (modalSendButton) {
        modalSendButton.addEventListener('click', sendMessage);
    }
    if (modalChatInput) {
        modalChatInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    }


    // Public API for the controller
    return {
        startChat,
        resetChat
        // No need to expose sendMessage directly as it's triggered by UI events
    };
}
