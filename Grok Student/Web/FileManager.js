export class FileManager {
    constructor() {
        this.fileInput = document.getElementById('file-input');
        this.previewContainer = document.getElementById('file-preview-container');
        this.previewImg = document.getElementById('preview-img');
        this.previewFile = document.getElementById('preview-file');
        this.removeBtn = document.getElementById('remove-btn');
        this.uploadBtn = document.getElementById('upload-btn');
        this.promptInput = document.getElementById('prompt');

        this.resetState();
        this.init();
    }

    resetState() {
        this.base64 = null;
        this.text = null;
        this.name = null;
        this.type = null;
    }

    init() {
        this.removeBtn.addEventListener('click', () => this.removeFilePreview());
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFile(e.target.files[0]);
            }
        });

        this.promptInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const blob = item.getAsFile();
                    if (blob) {
                        let fileName = blob.name || 'Pasted File';
                        if (fileName === 'image.png' && item.type.startsWith('image/')) fileName = 'Pasted Image';
                        const newFile = new File([blob], fileName, { type: blob.type });
                        this.handleFile(newFile);
                        break;
                    }
                }
            }
        });
    }

    handleFile(file) {
        this.name = file.name;
        this.type = file.type;

        const textExtensions = ['.c', '.cpp', '.h', '.hpp', '.java', '.py', '.rb', '.swift', '.go', '.rs', '.php', '.md', '.csv', '.txt', '.kt', '.sh'];
        const isText = file.type.startsWith('text/') ||
                       file.type === 'application/json' ||
                       file.type === 'application/xml' ||
                       file.type === 'application/javascript' ||
                       textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        const reader = new FileReader();
        reader.onload = (event) => {
            if (isText) {
                this.text = event.target.result;
                this.base64 = null;
                this.showFilePreview(null, this.name, this.type);
            } else {
                this.base64 = event.target.result;
                this.text = null;
                this.showFilePreview(this.base64, this.name, this.type);
            }
        };

        if (isText) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    }

    showFilePreview(src, name, type) {
        if (src && type && type.startsWith('image/')) {
            this.previewImg.src = src;
            this.previewImg.style.display = 'block';
            this.previewFile.style.display = 'none';
        } else {
            this.previewFile.textContent = '📄 ' + (name || 'Document Attached');
            this.previewImg.style.display = 'none';
            this.previewFile.style.display = 'block';
        }
        this.previewContainer.style.display = 'block';
    }

    removeFilePreview() {
        this.resetState();
        this.previewImg.src = '';
        this.previewImg.style.display = 'none';
        this.previewFile.style.display = 'none';
        this.previewContainer.style.display = 'none';
        this.fileInput.value = '';
    }

    hasFile() {
        return this.base64 !== null || this.text !== null;
    }
}
