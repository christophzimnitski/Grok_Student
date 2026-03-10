import { CONFIG } from './config.js';
import { ThemeManager } from './ThemeManager.js';
import { FileManager } from './FileManager.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

export class ChatApp {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.promptInput = document.getElementById('prompt');
        this.sendBtn = document.getElementById('send-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.uploadBtn = document.getElementById('upload-btn');

        this.themeManager = new ThemeManager();
        this.fileManager = new FileManager();
        this.markdownRenderer = new MarkdownRenderer();

        this.init();
    }

    init() {
        this.setupBranding();
        this.addMessage('grok', CONFIG.welcomeMessage);

        this.promptInput.addEventListener('input', () => {
            this.promptInput.style.height = 'auto';
            this.promptInput.style.height = `${this.promptInput.scrollHeight}px`;
        });

        this.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.clearBtn.addEventListener('click', async () => {
            try {
                await fetch('/clear', { method: 'POST' });
            } catch (err) {
                console.warn('Clear request failed, but clearing UI anyway', err);
            }
            this.chatContainer.innerHTML = '';
            this.addMessage('grok', CONFIG.welcomeMessage);
            this.promptInput.value = '';
            this.promptInput.style.height = 'auto';
            this.fileManager.removeFilePreview();
            this.promptInput.focus();
        });
    }

    setupBranding() {
        let link = document.querySelector('link[rel="icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = '/logo.png';
    }

    async sendMessage() {
        const text = this.promptInput.value.trim();
        if (!text && !this.fileManager.hasFile()) return;

        let finalPayloadText = text;
        if (this.fileManager.text) {
            finalPayloadText += `\n\n--- Attached File: ${this.fileManager.name} ---\n${this.fileManager.text}`;
        }

        const payload = {
            text: finalPayloadText,
            file_data: this.fileManager.base64
        };

        this.addMessage('user', text, this.fileManager.base64, this.fileManager.name, this.fileManager.type, this.fileManager.text !== null);
        
        this.promptInput.value = '';
        this.promptInput.style.height = 'auto';
        this.fileManager.removeFilePreview();

        const thinkingId = this.addThinkingBubble();
        const startedAt = Date.now();

        this.setInputsDisabled(true);

        try {
            const response = await fetch('/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            
            const reply = await response.text();
            if (!reply || reply.trim().length === 0) throw new Error('Empty response from server');

            this.handleResponse(reply, startedAt, thinkingId);
        } catch (err) {
            console.error('Fetch error:', err);
            this.handleResponse('Sorry, something went wrong. Please try again.', startedAt, thinkingId);
        }
    }

    handleResponse(reply, startedAt, thinkingId) {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, CONFIG.thinkingMinMs - elapsed);

        setTimeout(() => {
            this.removeThinkingBubble(thinkingId);
            this.addMessage('grok', reply);

            setTimeout(() => {
                this.setInputsDisabled(false);
                this.promptInput.focus();
            }, 150);
        }, remaining);
    }

    setInputsDisabled(disabled) {
        this.promptInput.disabled = disabled;
        this.sendBtn.disabled = disabled;
        this.uploadBtn.disabled = disabled;
    }

    addThinkingBubble() {
        const id = 'thinking-' + Date.now();
        const bubble = document.createElement('div');
        bubble.id = id;
        bubble.className = 'message grok thinking';
        bubble.innerHTML = 'Grok Student is thinking<span class="typing-dots"></span>';

        this.chatContainer.appendChild(bubble);
        this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' });
        return id;
    }

    removeThinkingBubble(id) {
        document.getElementById(id)?.remove();
    }

    addMessage(sender, text, fileSrc = null, fileName = null, fileType = null, isTextFile = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;

        if (sender === 'grok') {
            msgDiv.innerHTML = this.markdownRenderer.render(text);

            setTimeout(() => {
                this.markdownRenderer.highlightAndSetupCopy(msgDiv);
                this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' });
            }, 50);
        } else {
            this.renderUserMessage(msgDiv, text, fileSrc, fileName, fileType, isTextFile);
        }

        this.chatContainer.appendChild(msgDiv);

        setTimeout(() => {
            msgDiv.classList.add('visible');
        }, 10);

        this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' });
    }

    renderUserMessage(msgDiv, text, fileSrc, fileName, fileType, isTextFile) {
        if (fileSrc || isTextFile) {
            if (fileType && fileType.startsWith('image/') && fileSrc) {
                const img = document.createElement('img');
                img.src = fileSrc;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '300px';
                img.style.borderRadius = '8px';
                img.style.display = 'block';
                if (text) img.style.marginBottom = '10px';
                msgDiv.appendChild(img);
            } else {
                const docDiv = document.createElement('div');
                docDiv.style.padding = '10px 14px';
                docDiv.style.background = 'rgba(255, 255, 255, 0.2)';
                docDiv.style.borderRadius = '6px';
                docDiv.style.fontFamily = 'monospace';
                docDiv.style.fontSize = '14px';
                docDiv.style.marginBottom = text ? '10px' : '0';
                docDiv.textContent = '📄 ' + (fileName || 'Document');
                msgDiv.appendChild(docDiv);
            }
        }
        
        if (text) {
            const textNode = document.createTextNode(text);
            msgDiv.appendChild(textNode);
        }
    }
}
