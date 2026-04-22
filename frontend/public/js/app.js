import { GridController } from './controllers/grid.js';
import { UserMediaController } from './controllers/usermedia.js';
import { WebSocketController } from './controllers/websocket.js';
import { DragController } from './controllers/drag.js';
import { ScreenshotController } from './controllers/screenshot.js';
import { UploadController } from './controllers/upload.js';
import { SidebarController } from './controllers/sidebar.js';
import { FaceApiController } from './controllers/faceapi.js';



class VectorFacesApp {
    constructor() {
        this.gridController = new GridController();
        this.userMediaController = new UserMediaController();
        this.webSocketController = new WebSocketController();
        this.dragController = new DragController();
        this.screenshotController = new ScreenshotController();
        this.uploadController = new UploadController();
        this.sidebarController = new SidebarController();
        this.faceApiController = new FaceApiController();
        this.backendStats = null;
        this.statsIntervalId = null;
        
        // Expose controllers globally
        window.controllers = {
            grid: this.gridController,
            userMedia: this.userMediaController,
            webSocket: this.webSocketController,
            drag: this.dragController,
            screenshot: this.screenshotController,
            upload: this.uploadController,
            sidebar: this.sidebarController,
            faceApi: this.faceApiController
        };
    }

    async initialize() {
        try {
            

            this.userMediaController.initialize();

            // Get canvas from the current media source for screenshot controller
            const canvas = this.userMediaController.currentMediaSource.getCanvas();
            this.screenshotController.initialize(canvas);
            this.setupCommunication();
            this.gridController.generateGrid();

            this.dragController.initialize();
            this.faceApiController.initialize();
            
            this.webSocketController.connect();

            this.uploadController.initialize();
            this.sidebarController.initialize();
            
            this.setupEventListeners();

            await this.userMediaController.startStream();
            
            // Fetch stats initially and then every minute
            await this.fetchBackendStats();
            this.statsIntervalId = setInterval(() => this.fetchBackendStats(), 60000);
            
            console.log('VectorFaces application initialized successfully');
            
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    }

    setupCommunication() {
        this.webSocketController.setAnalysisCallback((message) => {
            const faceAnalysis = message.face_analysis || null;
            const matchingFaces = message.matching_faces || [];
            const timingStats = message.timing_stats || null;
            
            if (timingStats) {
                console.log('Processing timing:', {
                    faceAnalysis: `${timingStats.face_analysis_ms}ms`,
                    elasticsearch: `${timingStats.elasticsearch_ms || timingStats.elasticsearch_total_ms || 0}ms`,
                    total: `${timingStats.total_processing_ms}ms`
                });
                
                this.updateInfoBox(timingStats, faceAnalysis, matchingFaces);
            }
            
            this.userMediaController.setFaceResults(faceAnalysis);
            this.gridController.updateBackgroundTiles(matchingFaces);
            this.gridController.updateInfoboxImage(matchingFaces[0], faceAnalysis);
        });

        this.userMediaController.setPreviewUpdateCallback(async () => {
            // Face drawing is now handled inside UserMediaController
        });

        const statusCallback = (message, className) => {
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
                statusDiv.textContent = message;
            }
        };

        this.webSocketController.setStatusCallback(statusCallback);
        this.screenshotController.setStatusCallback(statusCallback);
    }

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        window.addEventListener('resize', () => {
            // Update canvas sizes in the current media source
            const videoHeight = this.userMediaController.videoHeight;
            this.userMediaController.cameraMedia.updateCanvasSize(videoHeight);
            this.userMediaController.pictureMedia.updateCanvasSize(videoHeight);
            
            this.gridController.generateGrid();
            
            const canvas = this.userMediaController.currentMediaSource.getCanvas();
            this.screenshotController.updateCanvasReferences(canvas);
        });
        
        // Listen for settings changes
        window.addEventListener('settingsChanged', (event) => {
            const settings = event.detail;
            console.log('Settings changed in app:', settings);
            
            // If sort method changed, re-sort and display all faces
            if (settings.sort) {
                this.gridController.sortAndDisplayFaces(settings.sort);
            }
        });
    }

    async fetchBackendStats() {
        try {
            const response = await fetch('/api/stats');
            if (response.ok) {
                this.backendStats = await response.json();
                console.log('Backend stats fetched:', this.backendStats);
            } else {
                console.error('Failed to fetch backend stats:', response.status);
            }
        } catch (error) {
            console.error('Error fetching backend stats:', error);
        }
    }

    getEnabledVectorCount() {
        if (!this.backendStats || !this.backendStats.elasticsearch || !window.settings?.indices) {
            return 0;
        }

        const elasticsearchStats = this.backendStats.elasticsearch;
        const enabledIndices = window.settings.indices
            .filter(idx => idx.selected)
            .map(idx => idx.name);

        let totalDocs = 0;
        for (const [indexName, stats] of Object.entries(elasticsearchStats)) {
            if (enabledIndices.includes(indexName) && stats._all && stats._all.primaries) {
                const docs = stats._all.primaries.docs || {};
                totalDocs += docs.count || 0;
            }
        }

        return totalDocs;
    }

    updateInfoBox(timingStats, faceAnalysis, matchingFaces) {
        const infoboxContent = document.getElementById('infobox-content');
        if (infoboxContent && timingStats && this.backendStats) {
            const faceTime = timingStats.face_analysis_ms || 0;
            const esTime = timingStats.elasticsearch_ms || timingStats.elasticsearch_total_ms || 0;
            const totalTime = timingStats.total_processing_ms || 0;
            const total_docs = this.getEnabledVectorCount();

            this.gridController.setBadgeStats(total_docs, esTime);
            
            // Find highest score
            let highestScore = 0;
            let highestScoreName = 'N/A';
            
            if (matchingFaces && matchingFaces.length > 0) {
                const topMatch = matchingFaces.reduce((prev, current) => {
                    return (current.score > prev.score) ? current : prev;
                });
                highestScore = topMatch.score;
                highestScoreName = topMatch.metadata.name || 'Unknown';
                
                let html = '';
                
                if (highestScore.toFixed(3) > 0.7) {
                    html += `<h3>Hi, ${highestScoreName}!</h3>`;
                }else{
                    html += `<h3>Hi, ${highestScoreName}...?</h3>`;
                }

                html += `<p><strong>Vector Similarity:</strong> ${highestScore.toFixed(3)}</p>`;
                html += `<p><strong>Embeddings:</strong> ${faceTime.toFixed(1)}ms</p>`;
                
                if (esTime > 0) {
                    html += `<p><strong>Elasticsearch:</strong> ${esTime}ms</p>`;
                }
                
                
                
                html += `<p>Searched <strong> ${total_docs.toLocaleString()}</strong> vectors</p>`;

                /*
                html += '<hr style="border-color: rgba(255,255,255,0.3); margin: 12px 0;">';
                html += '<h4 style="margin-bottom: 8px;">Index Stats</h4>';
                
                const elasticsearchStats = this.backendStats.elasticsearch;
                
                for (const [indexName, stats] of Object.entries(elasticsearchStats)) {
                    if (stats.error) {
                        html += `<p style="font-size: 12px;"><strong>${indexName}:</strong> ${stats.error}</p>`;
                    } else if (stats._all && stats._all.primaries) {
                        const docs = stats._all.primaries.docs || {};
                        const denseVector = stats._all.primaries.dense_vector || {};
                        const docCount = docs.count || 0;
                        const vectorCount = denseVector.value_count || 0;
                        const offHeap = denseVector.off_heap || {};
                        const totalSizeBytes = offHeap.total_size_bytes || 0;
                        const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
                        
                        html += `<p style="font-size: 11px; margin-bottom: 4px;"><strong>${indexName}</strong></p>`;
                        html += `<p style="font-size: 10px; margin-left: 8px; margin-bottom: 2px;">Docs: ${docCount.toLocaleString()}</p>`;
                        html += `<p style="font-size: 10px; margin-left: 8px; margin-bottom: 2px;">Vectors: ${vectorCount.toLocaleString()}</p>`;
                        if (totalSizeBytes > 0) {
                            html += `<p style="font-size: 10px; margin-left: 8px; margin-bottom: 6px;">Off-heap: ${totalSizeMB} MB</p>`;
                        } else {
                            html += `<p style="font-size: 10px; margin-left: 8px; margin-bottom: 6px;">Off-heap: 0 MB</p>`;
                        }
                    }
                }*/
                
                
                infoboxContent.innerHTML = html;
            }else{
                let html = '<h3> Loading... </h3>';
                infoboxContent.innerHTML = html;
            }
        }
    }

    cleanup() {
        this.userMediaController.stopStream();
        this.webSocketController.close();
    }
}

window.addEventListener('load', async () => {
    const app = new VectorFacesApp();
    await app.initialize();
});

export { VectorFacesApp };