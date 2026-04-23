// Base MediaSource class (Strategy pattern)
export class MediaSource {
    constructor(controller) {
        this.controller = controller;
        this.canvas = null;
        this.ctx = null;
        this.detectionCanvas = null;
        this.detectionCtx = null;
        this.lastDetections = null;
        
        this.watermarkImage = new Image();
        this.watermarkImage.crossOrigin = 'anonymous';
        this.watermarkImage.src = '/assets/logo-elastic-glyph-color.png';

        this.statusDiv = document.getElementById('status');
    }

    initialize(videoHeight) {
        throw new Error('initialize() must be implemented');
    }

    show() {
        if (this.canvas) {
            this.canvas.style.display = 'block';
        }
        if (this.detectionCanvas) {
            this.detectionCanvas.style.display = 'block';
        }
    }

    hide() {
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
        if (this.detectionCanvas) {
            this.detectionCanvas.style.display = 'none';
        }
    }

    createDetectionCanvas() {
        // Create overlay canvas for face detection boxes
        if (this.detectionCanvas) {
            this.detectionCanvas.remove();
        }
        
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCanvas.className = 'detection-canvas';
        this.detectionCanvas.style.position = 'absolute';
        this.detectionCanvas.style.top = '0';
        this.detectionCanvas.style.left = '0';
        this.detectionCanvas.style.pointerEvents = 'none';
        this.detectionCanvas.style.zIndex = '1001';
        
        const container = document.querySelector('.user-media-container');
        container.appendChild(this.detectionCanvas);
        
        // Match size to canvas
        this.detectionCanvas.width = this.canvas.width;
        this.detectionCanvas.height = this.canvas.height;
        this.detectionCanvas.style.width = this.canvas.style.width;
        this.detectionCanvas.style.height = this.canvas.style.height;
        
        this.detectionCtx = this.detectionCanvas.getContext('2d');
    }

    drawWatermark() {
        if (!this.watermarkImage || !this.watermarkImage.complete) {
            return;
        }

        const watermarkSize = 25;
        const padding = 10;

        this.ctx.save();
        this.ctx.globalAlpha = 0.4;
        this.ctx.drawImage(
            this.watermarkImage,
            padding, padding, watermarkSize, watermarkSize
        );
        this.ctx.restore();
    }

    drawFaceDetections(detections, sourceX, sourceY, sourceWidth, sourceHeight) {
        throw new Error('drawFaceDetections() must be implemented');
    }

    updateStatus(message, className) {
        if (this.statusDiv) {
            this.statusDiv.textContent = message;
        }
    }

    showStatus() {
        this.statusDiv.style.visibility = 'visible';
    }

    hideStatus() {
        this.statusDiv.style.visibility = 'hidden';
    }


    async start() {
        throw new Error('start() must be implemented');
    }

    stop() {
        throw new Error('stop() must be implemented');
    }

    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }

    getImageData() {
        if (!this.canvas) return null;
        return this.canvas.toDataURL('image/jpeg', 0.9);
    }

    update() {
        throw new Error('update() must be implemented');
    }
}
