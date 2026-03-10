const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const themeToggle = document.getElementById('theme-toggle');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('file-preview-container');
const previewImg = document.getElementById('preview-img');
const previewFile = document.getElementById('preview-file');
const removeBtn = document.getElementById('remove-btn');

function setupBranding() {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    // Use the static asset from the Web folder
    link.href = '/logo.png';
}

// Setup Marked options (KaTeX handled during message rendering now to prevent conflicts)
if (typeof marked !== 'undefined') {
    marked.setOptions({
        gfm: true,
        breaks: true,
        smartLists: true,
        smartypants: false,
        mangle: false
    });
}

// Theme handling
const themes = ['auto', 'light', 'dark'];
let currentThemeIndex = 0;
let currentTheme = themes[currentThemeIndex];

function setTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    themeToggle.textContent = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
}

function updateHljsTheme() {
    const light = document.getElementById('hljs-light');
    const dark = document.getElementById('hljs-dark');
    if (!light || !dark) return;

    const isDark = document.body.dataset.theme === 'dark' ||
                   (document.body.dataset.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    light.media = isDark ? 'not all' : 'all';
    dark.media = isDark ? 'all' : 'not all';
}

// Initial setup
setTheme(currentTheme);
updateHljsTheme();
setupBranding();

// Update on theme toggle
themeToggle.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    currentTheme = themes[currentThemeIndex];
    setTheme(currentTheme);
    updateHljsTheme();
});

// Handle system dark mode change in 'auto'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.body.dataset.theme === 'auto') {
        updateHljsTheme();
    }
});

// Debug logging (set DEBUG = true if needed)
const DEBUG = false;
const debugLog = (...args) => { if (DEBUG) console.log('[DEBUG]', ...args); };

const THINKING_MIN_MS = 400;
const WELCOME_MESSAGE = "Hello! I’m Grok Student. Ask me anything.";

addMessage('grok', WELCOME_MESSAGE);

// Auto-grow textarea
promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${promptInput.scrollHeight}px`;
});

let currentFileBase64 = null;
let currentFileText = null;
let currentFileName = null;
let currentFileType = null;

function showFilePreview(src, name, type) {
    if (src && type && type.startsWith('image/')) {
        previewImg.src = src;
        previewImg.style.display = 'block';
        previewFile.style.display = 'none';
    } else {
        previewFile.textContent = '📄 ' + (name || 'Document Attached');
        previewImg.style.display = 'none';
        previewFile.style.display = 'block';
    }
    previewContainer.style.display = 'block';
}

function removeFilePreview() {
    currentFileBase64 = null;
    currentFileText = null;
    currentFileName = null;
    currentFileType = null;
    previewImg.src = '';
    previewImg.style.display = 'none';
    previewFile.style.display = 'none';
    previewContainer.style.display = 'none';
    fileInput.value = '';
}

removeBtn.onclick = removeFilePreview;

function handleFile(file) {
    currentFileName = file.name;
    currentFileType = file.type;

    // Detect if this is a textual file (code, csv, logs, etc)
    const isText = file.type.startsWith('text/') || 
                   file.type === 'application/json' || 
                   file.type === 'application/xml' ||
                   file.type === 'application/javascript' ||
                   ['.c', '.cpp', '.h', '.hpp', '.java', '.py', '.rb', '.swift', '.go', '.rs', '.php', '.md', '.csv', '.txt', '.kt', '.sh'].some(ext => file.name.toLowerCase().endsWith(ext));

    if (isText) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentFileText = event.target.result;
            currentFileBase64 = null;
            showFilePreview(null, currentFileName, currentFileType);
        };
        reader.readAsText(file);
    } else {
        // Binary files (PDF, images, Office docs)
        const reader = new FileReader();
        reader.onload = (event) => {
            currentFileBase64 = event.target.result;
            currentFileText = null;
            showFilePreview(currentFileBase64, currentFileName, currentFileType);
        };
        reader.readAsDataURL(file);
    }
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

uploadBtn.addEventListener('click', () => fileInput.click());

// Handle pasting files
promptInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            if (blob) {
                let fileName = blob.name || 'Pasted File';
                if (fileName === 'image.png' && item.type.startsWith('image/')) fileName = 'Pasted Image';
                
                // Reconstruct with fallback naming
                const newFile = new File([blob], fileName, { type: blob.type });
                handleFile(newFile);
                break; // Just handle the first pasted file
            }
        }
    }
});

// Send on Enter without Shift
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

clearBtn.addEventListener('click', async () => {
    try {
        await fetch('/clear', { method: 'POST' });
    } catch (err) {
        console.warn('Clear request failed, but clearing UI anyway', err);
    }
    chatContainer.innerHTML = '';
    addMessage('grok', WELCOME_MESSAGE);
    promptInput.value = '';
    promptInput.style.height = 'auto';
    removeFilePreview();
    promptInput.focus();
});

async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text && !currentFileBase64 && !currentFileText) return;

    let finalPayloadText = text;
    // For text/code files, inject the contents natively into the prompt to preserve context
    if (currentFileText) {
        finalPayloadText += `\n\n--- Attached File: ${currentFileName} ---\n${currentFileText}`;
    }

    const payload = {
        text: finalPayloadText,
        file_data: currentFileBase64
    };

    addMessage('user', text, currentFileBase64, currentFileName, currentFileType, currentFileText !== null);
    
    promptInput.value = '';
    promptInput.style.height = 'auto';
    removeFilePreview();

    const thinkingId = addThinkingBubble();
    const startedAt = Date.now();

    promptInput.disabled = true;
    sendBtn.disabled = true;
    uploadBtn.disabled = true;

    try {
        const response = await fetch('/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const reply = await response.text();

        if (!reply || reply.trim().length === 0) {
            throw new Error('Empty response from server');
        }

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, THINKING_MIN_MS - elapsed);

        setTimeout(() => {
            removeThinkingBubble(thinkingId);
            addMessage('grok', reply);

            setTimeout(() => {
                promptInput.disabled = false;
                sendBtn.disabled = false;
                uploadBtn.disabled = false;
                promptInput.focus();
            }, 150);
        }, remaining);

    } catch (err) {
        console.error('Fetch error:', err);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, THINKING_MIN_MS - elapsed);

        setTimeout(() => {
            removeThinkingBubble(thinkingId);
            addMessage('grok', 'Sorry, something went wrong. Please try again.');

            setTimeout(() => {
                promptInput.disabled = false;
                sendBtn.disabled = false;
                uploadBtn.disabled = false;
                promptInput.focus();
            }, 150);
        }, remaining);
    }
}

function addThinkingBubble() {
    const id = 'thinking-' + Date.now();
    const bubble = document.createElement('div');
    bubble.id = id;
    bubble.className = 'message grok thinking';
    bubble.innerHTML = 'Grok Student is thinking<span class="typing-dots"></span>';

    chatContainer.appendChild(bubble);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    return id;
}

function removeThinkingBubble(id) {
    document.getElementById(id)?.remove();
}

function addMessage(sender, text, fileSrc = null, fileName = null, fileType = null, isTextFile = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    if (sender === 'grok') {
        let html = text;
        try {
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                const mathBlocks = [];
                // Match block math ($$ or \[ \]) and inline math ($ or \()
                const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[\s\S]+?\$)/g;
                
                // 1. Swap math out for a safe placeholder string
                let textWithPlaceholders = text.replace(mathRegex, (match) => {
                    // Smart detection to ignore currencies and false-positives for inline math
                    if (match.startsWith('$') && !match.startsWith('$$')) {
                        const inner = match.slice(1, -1).trim();
                        
                        // Rule A: Pure numbers/currency (e.g., $10, $1,000.50, $5k, $10M)
                        if (/^[\d.,]+[kKmMbB]?$/.test(inner)) return match;
                        
                        // Rule B: False positive between two currencies (e.g., "$10 and the cost is $20")
                        // If it has spaces but NO math symbols (\, +, -, *, /, =, ^, _, etc.), it's normal text.
                        if (inner.includes(' ') && !/[\\+\-*/=^_{}<>|]/.test(inner)) return match;
                    }
                    
                    const id = mathBlocks.length;
                    mathBlocks.push(match);
                    return `KATEXMATHBLOCK${id}KATEXMATHBLOCK`;
                });

                // 2. Parse markdown safely without interfering with math characters
                html = marked.parse(textWithPlaceholders);

                // 3. Render and restore the math
                html = html.replace(/KATEXMATHBLOCK(\d+)KATEXMATHBLOCK/g, (match, id) => {
                    const originalMath = mathBlocks[id];
                    const isBlock = originalMath.startsWith('$$') || originalMath.startsWith('\\[');
                    const pureMath = originalMath.replace(/(^\$\$?|^\\\[|^\\\(|\$\$?$|\\\]$|\\\)$)/g, '');
                    
                    if (typeof katex !== 'undefined') {
                        try {
                            return katex.renderToString(pureMath, { 
                                displayMode: isBlock, 
                                throwOnError: false 
                            });
                        } catch(e) {
                            console.error('KaTeX rendering error:', e);
                        }
                    }
                    return originalMath;
                });
            }
        } catch (e) {
            console.error('Markdown parsing failed:', e);
        }

        msgDiv.innerHTML = html;

        setTimeout(() => {
            const pres = msgDiv.querySelectorAll('pre');
            debugLog('Found <pre> blocks:', pres.length);

            pres.forEach((pre) => {
                const code = pre.querySelector('code');
                if (code) {
                    let langClass = code.className || '';
                    if (langClass.includes('objective-c') ||
                        langClass.includes('objectivec') ||
                        langClass.includes('objc') ||
                        langClass.includes('obj-c')) {
                        code.className = langClass.replace(
                            /language-(objective-c|objectivec|objc|obj-c)/i,
                            'language-objectivec'
                        );
                        debugLog('Normalized Objective-C to:', code.className);
                    }

                    if (typeof hljs !== 'undefined') {
                        hljs.highlightElement(code);
                    }
                }

                if (pre.querySelector('.copy-btn')) return;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'copy-btn';
                btn.textContent = 'Copy';

                btn.addEventListener('click', () => {
                    const textToCopy = pre.innerText.trim() || (code ? code.innerText.trim() : '');
                    try {
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        textarea.setAttribute('readonly', '');
                        textarea.style.position = 'fixed';
                        textarea.style.left = '-9999px';
                        textarea.style.top = '-9999px';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textarea);

                        if (!successful) throw new Error('Copy failed');

                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
                    } catch (err) {
                        console.error('Copy failed:', err);
                        btn.textContent = 'Failed';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
                    }
                });

                pre.appendChild(btn);
            });

            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }, 50);

    } else {
        if (fileSrc || isTextFile) {
            if (fileType && fileType.startsWith('image/') && fileSrc) {
                const img = document.createElement('img');
                img.src = fileSrc;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '300px';
                img.style.borderRadius = '8px';
                img.style.display = 'block';
                if (text) {
                    img.style.marginBottom = '10px';
                }
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

    chatContainer.appendChild(msgDiv);

    setTimeout(() => {
        msgDiv.classList.add('visible');
    }, 10);

    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

