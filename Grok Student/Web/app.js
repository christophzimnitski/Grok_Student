const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const themeToggle = document.getElementById('theme-toggle');

function applyMathRendering(element) {
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '\\[', right: '\\]', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
            ],
            throwOnError: false
        });
    }
}

function setupKaTeX() {
    if (document.getElementById('katex-css')) return;

    const css = document.createElement('link');
    css.id = 'katex-css';
    css.rel = 'stylesheet';
    css.crossOrigin = 'anonymous';
    css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
        const autoRender = document.createElement('script');
        autoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js';
        autoRender.crossOrigin = 'anonymous';
        autoRender.onload = () => {
            document.querySelectorAll('.message.grok').forEach(applyMathRendering);
        };
        document.head.appendChild(autoRender);
    };
    document.head.appendChild(script);
}

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
setupKaTeX();
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
    promptInput.focus();
});

async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text) return;

    addMessage('user', text);
    promptInput.value = '';
    promptInput.style.height = 'auto';

    const thinkingId = addThinkingBubble();
    const startedAt = Date.now();

    promptInput.disabled = true;
    sendBtn.disabled = true;

    try {
        const response = await fetch('/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: text
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

function addMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    if (sender === 'grok') {
        let html = text;
        let mathBlocks = [];
        let processedText = text;

        // Shield block math
        processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH_${mathBlocks.length - 1}%%%`;
        });

        // Shield inline math, while ignoring normal currency amounts (e.g. $10)
        processedText = processedText.replace(/(^|[^\\])\$((?:\\.|[^$])+?)\$/g, (match, prefix, content) => {
            if (/^\d/.test(content.trim())) {
                return match;
            }
            mathBlocks.push('$' + content + '$');
            return prefix + `%%%MATH_${mathBlocks.length - 1}%%%`;
        });

        // Shield \( ... \) and \[ ... \]
        processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH_${mathBlocks.length - 1}%%%`;
        });
        processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
            mathBlocks.push(match);
            return `%%%MATH_${mathBlocks.length - 1}%%%`;
        });

        try {
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    smartLists: true,
                    smartypants: false,
                    mangle: false
                });
                html = marked.parse(processedText);
            } else {
                html = processedText;
            }
        } catch (e) {
            console.error('Markdown parsing failed:', e);
            html = processedText;
        }

        // Restore math blocks safely
        mathBlocks.forEach((math, i) => {
            let escapedMath = math.replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;");
            html = html.replace(`%%%MATH_${i}%%%`, () => escapedMath);
        });

        msgDiv.innerHTML = html;
        applyMathRendering(msgDiv);

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
        msgDiv.textContent = text;
    }

    chatContainer.appendChild(msgDiv);

    setTimeout(() => {
        msgDiv.classList.add('visible');
    }, 10);

    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

