export class MarkdownRenderer {
    constructor() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                gfm: true,
                breaks: true,
                smartLists: true,
                smartypants: false,
                mangle: false
            });
        }
    }

    render(text) {
        if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
            return text; // Fallback
        }

        const mathBlocks = [];
        const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[\s\S]+?\$)/g;
        
        let textWithPlaceholders = text.replace(mathRegex, (match) => {
            if (match.startsWith('$') && !match.startsWith('$$')) {
                const inner = match.slice(1, -1).trim();
                // Ignore currencies and false-positives
                if (/^[\d.,]+[kKmMbB]?$/.test(inner)) return match;
                if (inner.includes(' ') && !/[\\+\-*/=^_{}<>|]/.test(inner)) return match;
            }
            
            const id = mathBlocks.length;
            mathBlocks.push(match);
            return `KATEXMATHBLOCK${id}KATEXMATHBLOCK`;
        });

        let html = marked.parse(textWithPlaceholders);

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

        return html;
    }

    highlightAndSetupCopy(container) {
        const pres = container.querySelectorAll('pre');
        pres.forEach((pre) => {
            const code = pre.querySelector('code');
            if (code) {
                let langClass = code.className || '';
                if (/(objective-c|objectivec|objc|obj-c)/i.test(langClass)) {
                    code.className = langClass.replace(/language-(objective-c|objectivec|objc|obj-c)/i, 'language-objectivec');
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

            btn.addEventListener('click', async () => {
                const textToCopy = pre.innerText.trim() || (code ? code.innerText.trim() : '');
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(textToCopy);
                    } else {
                        // Fallback for older browsers
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        textarea.setAttribute('readonly', '');
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                    btn.textContent = 'Copied!';
                } catch (err) {
                    console.error('Copy failed:', err);
                    btn.textContent = 'Failed';
                }
                setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
            });

            pre.appendChild(btn);
        });
    }
}
