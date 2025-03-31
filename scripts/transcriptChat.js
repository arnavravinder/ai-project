// Ensure Vue is accessible, or import specific functions if needed elsewhere
// const { nextTick } = Vue; // Might be needed if Vue isn't global

export function createTranscriptChatController(mainAppInterface) { // Receive interface
    let currentTranscriptId = null;
    let currentTranscriptText = null;
    let messages = []; // Store messages locally for this instance
    let isLoading = false;
    // Note: Modal instance management is now primarily in script.js
    // We just need the DOM elements here.

    const modalChatMessagesDiv = document.getElementById('modal-chat-messages');
    const modalChatInput = document.getElementById('modal-chat-input');
    const modalSendButton = document.getElementById('modal-send-button');
    const modalTitleSpan = document.getElementById('modal-transcript-id');

    // Access functions from interface
    const callGeminiAPI = mainAppInterface.callGeminiAPI;

    const formatMarkdown = (text) => {
        if (!text) return '';
        let formattedText = text;
        // Refined Markdown replacements
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
        formattedText = formattedText.replace(/```([\s\S]*?)```/gs, (match, code) => `<pre class="code-block"><code>${code.trim()}</code></pre>`);
        formattedText = formattedText.replace(/^\s*[-*]\s+(.*)/gm, '<li class="mb-1">$1</li>');
        // Wrap consecutive LIs in ULs
        formattedText = formattedText.replace(/((?:<li.*?>.*?<\/li>\s*)+)/gs, '<ul class="list-unstyled ps-3 mt-2">$1</ul>');
        // Wrap single LIs
        formattedText = formattedText.replace(/(?<!<\/ul>\s*)<li class="mb-1">(.*?)<\/li>(?!\s*<li)/gs, '<ul class="list-unstyled ps-3 mt-2"><li class="mb-1">$1</li></ul>');
        formattedText = formattedText.replace(/\n/g, '<br>');
        return formattedText;
    };


    const renderMessages = () => {
        if (!modalChatMessagesDiv) {
             console.error("Modal chat message container not found");
             return;
        }
        modalChatMessagesDiv.innerHTML = ''; // Clear previous messages
        if (messages.length === 0) {
             // Optionally show a default message if empty after reset/init
             modalChatMessagesDiv.innerHTML = `<div class="text-center text-muted p-3">Chat session started.</div>`;
             return;
        }

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
                 messageWrapper.appendChild(avatar);
                 messageWrapper.appendChild(content);
            } else {
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                // Apply formatting for bot messages, display user text directly
                textDiv.innerHTML = message.sender === 'bot' ? formatMarkdown(message.text) : escapeHtml(message.text); // Escape user HTML
                content.appendChild(textDiv);
                messageWrapper.appendChild(avatar);
                messageWrapper.appendChild(content);
            }
            modalChatMessagesDiv.appendChild(messageWrapper);
        });
        scrollToBottom(); // Scroll after rendering
    };

     // Helper to prevent basic XSS from user input if displayed with v-html (though we switched to textContent)
     function escapeHtml(unsafe) {
         if (!unsafe) return '';
         return unsafe
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
     }


    const addMessage = (sender, text, type = 'text') => {
        // Add to local array and trigger re-render
        messages.push({ sender, text, type, id: Date.now() + Math.random() });
        renderMessages();
    };

    const addTypingIndicator = () => {
        // Ensure only one typing indicator exists
        if (!messages.some(m => m.id === 'typing-indicator')) {
            messages.push({ sender: 'bot', type: 'typing', id: 'typing-indicator' });
            renderMessages();
        }
    }

    const removeTypingIndicator = () => {
         messages = messages.filter(m => m.id !== 'typing-indicator');
         renderMessages(); // Re-render after removing
    }

    const scrollToBottom = () => {
        // Use a slight delay to ensure DOM is updated after renderMessages
        setTimeout(() => {
            if (modalChatMessagesDiv) {
                modalChatMessagesDiv.scrollTop = modalChatMessagesDiv.scrollHeight;
            }
        }, 50); // 50ms delay often sufficient
    };

    const sendMessage = async () => {
        if (!modalChatInput || !modalSendButton) {
            console.error("Modal chat input/button elements not found");
            return;
        }
        const messageText = modalChatInput.value.trim();
        if (!messageText || isLoading || !currentTranscriptText) return;

        addMessage('user', messageText);
        modalChatInput.value = ''; // Clear input
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

        Answer the user's question based *only* on the provided transcript content. If the information isn't present, state that clearly. Do not make assumptions or use external knowledge. Be concise and professional. Format using basic markdown (bold, italics, lists).`;

        try {
             const botResponse = await callGeminiAPI(prompt); // Use interface function
             removeTypingIndicator();
             addMessage('bot', botResponse); // Add message, render will format
        } catch (error) {
            removeTypingIndicator();
            addMessage('bot', `Sorry, an error occurred: ${error.message}`);
            console.error("Error sending modal message:", error);
        } finally {
            isLoading = false;
            // Re-enable input only if elements still exist
            if (modalSendButton) modalSendButton.disabled = false;
            if (modalChatInput) {
                 modalChatInput.disabled = false;
                 modalChatInput.focus(); // Refocus input
            }
        }
    };

    const startChat = (transcriptId, transcriptText) => {
        console.log(`Starting chat for transcript: ${transcriptId}`);
        currentTranscriptId = transcriptId;
        currentTranscriptText = transcriptText;
        messages = []; // Reset messages for new chat

        if(modalTitleSpan) modalTitleSpan.textContent = transcriptId || 'N/A';
        if(modalChatInput) modalChatInput.value = ''; // Clear input
        if(modalSendButton) modalSendButton.disabled = false; // Enable button
        if(modalChatInput) modalChatInput.disabled = false; // Enable input
        isLoading = false;

        // Add initial message and render
        addMessage('bot', `Chatting about transcript ${transcriptId}. Ask me anything specific to this conversation.`);
        // Initial render call in case addMessage didn't trigger scroll correctly
        renderMessages();

        // Slight delay before focus might help
        setTimeout(() => {
            if (modalChatInput) modalChatInput.focus();
        }, 100);
    };

    const resetChat = () => {
        console.log("Resetting modal chat state");
        currentTranscriptId = null;
        currentTranscriptText = null;
        messages = [];
        isLoading = false;
         if(modalChatMessagesDiv) modalChatMessagesDiv.innerHTML = '<div class="text-center text-muted p-3">Chat session ended.</div>'; // Show reset message
         if(modalChatInput) modalChatInput.value = '';
         if(modalTitleSpan) modalTitleSpan.textContent = 'N/A';
         if(modalSendButton) modalSendButton.disabled = true;
         if(modalChatInput) modalChatInput.disabled = true;
    };

    // Initial setup: Add event listeners if elements exist
    // This ensures listeners are added only once when the controller is created
    if (modalSendButton) {
        modalSendButton.addEventListener('click', sendMessage);
    } else {
        console.warn("Modal send button not found on init");
    }
    if (modalChatInput) {
        modalChatInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' && !isLoading) { // Prevent sending while loading
                sendMessage();
            }
        });
    } else {
        console.warn("Modal chat input not found on init");
    }

    // Public API for the controller
    return {
        startChat,
        resetChat
    };
}
