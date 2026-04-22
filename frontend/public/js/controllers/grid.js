export class GridController {
    constructor() {
        this.currentTileIndex = 0;
        this.allFaces = []; // Store all faces for sorting
        this.maxFaces = 0; // Maximum number of faces (cols * rows)
        this.currentTopFace = null;
        this.currentCapturedFaceSrc = null;
        this.currentMatchImageSrc = null;

        this.expandButton = null;
        this.badgeModal = null;
        this.badgeBackdrop = null;
        this.badgeCloseButton = null;
        this.badgeMessage = null;
        this.badgeCapturedImage = null;
        this.badgeMatchImage = null;
        this.badgeDisclaimer = null;

        this.currentVectorCount = null;
        this.currentSearchMs = null;

        this.initializeBadgeModal();
    }

    initializeBadgeModal() {
        this.expandButton = document.getElementById('infobox-expand-btn');
        this.badgeModal = document.getElementById('badge-modal');
        this.badgeBackdrop = document.getElementById('badge-modal-backdrop');
        this.badgeCloseButton = document.getElementById('badge-modal-close');
        this.badgeMessage = document.getElementById('badge-message');
        this.badgeCapturedImage = document.getElementById('badge-captured-image');
        this.badgeMatchImage = document.getElementById('badge-match-image');
        this.badgeDisclaimer = document.getElementById('badge-disclaimer');

        if (this.expandButton) {
            this.expandButton.disabled = true;
            this.expandButton.addEventListener('click', () => this.openBadgeModal());
        }

        if (this.badgeBackdrop) {
            this.badgeBackdrop.addEventListener('click', () => this.closeBadgeModal());
        }

        if (this.badgeCloseButton) {
            this.badgeCloseButton.addEventListener('click', () => this.closeBadgeModal());
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.badgeModal?.classList.contains('is-open')) {
                this.closeBadgeModal();
            }
        });
    }

    openBadgeModal() {
        if (!this.badgeModal || !this.currentTopFace || !this.badgeMessage) {
            return;
        }

        const similarity = Math.max(0, Math.min(100, (this.currentTopFace.score || 0) * 100));
        const celebrityName = this.currentTopFace?.metadata?.name || 'Unknown';

        this.badgeMessage.innerHTML = `You are <span class="badge-percent">${similarity.toFixed(1)}%</span> similar to <span class="badge-name">${celebrityName}</span>!`;

        this.refreshBadgeDisclaimer();

        if (this.badgeCapturedImage) {
            if (this.currentCapturedFaceSrc) {
                this.badgeCapturedImage.src = this.currentCapturedFaceSrc;
                this.badgeCapturedImage.style.display = 'block';
            } else {
                this.badgeCapturedImage.removeAttribute('src');
                this.badgeCapturedImage.style.display = 'none';
            }
        }

        if (this.badgeMatchImage) {
            if (this.currentMatchImageSrc) {
                this.badgeMatchImage.src = this.currentMatchImageSrc;
                this.badgeMatchImage.style.display = 'block';
            } else {
                this.badgeMatchImage.removeAttribute('src');
                this.badgeMatchImage.style.display = 'none';
            }
        }

        this.badgeModal.classList.add('is-open');
        this.badgeModal.setAttribute('aria-hidden', 'false');
    }

    closeBadgeModal() {
        if (!this.badgeModal) {
            return;
        }

        this.badgeModal.classList.remove('is-open');
        this.badgeModal.setAttribute('aria-hidden', 'true');
    }

    setBadgeStats(vectorCount, searchMs) {
        this.currentVectorCount = Number.isFinite(vectorCount) ? vectorCount : null;
        this.currentSearchMs = Number.isFinite(searchMs) ? searchMs : null;
        this.refreshBadgeDisclaimer();
    }

    refreshBadgeDisclaimer() {
        if (!this.badgeDisclaimer) {
            return;
        }

        const hasVectorCount = Number.isFinite(this.currentVectorCount);
        const hasSearchMs = Number.isFinite(this.currentSearchMs);

        const vectorText = hasVectorCount ? this.currentVectorCount.toLocaleString() : 'x';
        const msText = hasSearchMs ? this.currentSearchMs.toFixed(1) : 'y';

        this.badgeDisclaimer.textContent = `As searched with Elasticsearch using vector search on ${vectorText} vectors in ${msText} milliseconds.`;
    }

    generateGrid() {
        const gridContainer = document.getElementById('gridContainer');
        gridContainer.innerHTML = '';
        
        const aspectRatio = window.innerWidth / window.innerHeight;
        
        const gridSquares = 40; 

        let cols, rows;
        if (aspectRatio > 1) {
            cols = Math.ceil(Math.sqrt(gridSquares * aspectRatio));
            rows = Math.ceil(gridSquares / cols);
        } else {
            rows = Math.ceil(Math.sqrt(gridSquares / aspectRatio));
            cols = Math.ceil(gridSquares / rows);
        }
        
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.display = 'grid';
        
        const totalItems = cols * rows;
        this.maxFaces = totalItems; // Store the maximum number of faces
        
        for (let i = 0; i < totalItems; i++) {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.style.backgroundColor = `hsl(${(i * 137.5) % 360}, 20%, 95%)`;
            
            const scoreLabel = document.createElement('div');
            scoreLabel.className = 'score-label';
            scoreLabel.textContent = '';
            
            gridItem.appendChild(scoreLabel);
            gridContainer.appendChild(gridItem);
        }
    }

    updateBackgroundTiles(matchingFaces) {
        const gridItems = document.querySelectorAll('.grid-item');

        console.info('Updating', gridItems.length, 'background tiles with matching faces', matchingFaces);
        
        if (matchingFaces.length === 0) {
            this.addEmptyTile(gridItems);
            return;
        }
        
        // Fade out current items, then fade in sorted faces
        const fadeOutPromises = [];
        Array.from(gridItems).reverse().forEach((tile, index) => {
            const promise = new Promise(resolve => {
                setTimeout(() => {
                    tile.classList.add('fadeOut');
                    
                    setTimeout(() => {
                        tile.style.backgroundImage = '';
                        tile.style.backgroundSize = '';
                        tile.style.backgroundRepeat = '';
                        tile.style.backgroundPosition = '';
                        
                        const scoreLabel = tile.querySelector('.score-label');
                        if (scoreLabel) {
                            scoreLabel.textContent = '';
                        }
                        
                        tile.classList.remove('fadeOut');
                        resolve();
                    }, 300);
                }, index * 20);
            });
            fadeOutPromises.push(promise);
        });
        
        // After fade out completes, update allFaces and fade in
        Promise.all(fadeOutPromises).then(() => {
            this.allFaces = [...matchingFaces].sort((a, b) => (b.score || 0) - (a.score || 0));
            
            this.allFaces.forEach((face, index) => {
                if (index >= gridItems.length) return;
                
                setTimeout(() => {
                    const currentTile = gridItems[index];
                    this.displayFaceOnTile(currentTile, face);
                }, index * 20);
            });
            
            this.currentTileIndex = this.allFaces.length % gridItems.length;
        });
    }
    
    displayFaceOnTile(tile, face) {
        if (!tile) return;
        
        let imageSource;
        if (face.metadata.image_path.startsWith('/uploads')) {
            imageSource = `/local${face.metadata.image_path}`;
        } else {
            imageSource = `/faces/${face.metadata.image_path}`;
        }

        if (!imageSource) return;
        
        tile.classList.add('fadeIn');
        
        tile.style.backgroundImage = `url(${imageSource})`;
        tile.style.backgroundSize = 'contain';
        tile.style.backgroundRepeat = 'no-repeat';
        tile.style.backgroundPosition = 'center';
        
        const scoreLabel = tile.querySelector('.score-label');
        if (scoreLabel && face.score !== undefined) {
            scoreLabel.textContent = `${face.metadata.name}:${face.score.toFixed(2)} (${face.index.split('-')[1].split('-')[0]})`;
        } else if (scoreLabel) {
            scoreLabel.textContent = '--';
        }
        
        setTimeout(() => {
            tile.classList.remove('fadeIn');
        }, 300);
    }

    addEmptyTile(gridItems) {
        const currentTile = gridItems[this.currentTileIndex];
        
        if (currentTile) {
            currentTile.classList.add('flipping');

            let animationduration = Math.random() * 0.5 + 0.5;
            currentTile.style.animationDuration = `${animationduration}s`;
            
            setTimeout(() => {
                currentTile.style.backgroundImage = '';
                currentTile.style.backgroundSize = '';
                currentTile.style.backgroundRepeat = '';
                currentTile.style.backgroundPosition = '';
                
                const scoreLabel = currentTile.querySelector('.score-label');
                if (scoreLabel) {
                    scoreLabel.textContent = '';
                }
                
            }, 300);
            
            setTimeout(() => {
                currentTile.classList.remove('flipping');
            }, 600);
            
            this.currentTileIndex = (this.currentTileIndex + 1) % gridItems.length;
        }
    }
    
    clearAllTiles() {
        const gridItems = document.querySelectorAll('.grid-item');
        gridItems.forEach(item => {
            item.style.backgroundImage = '';
            item.style.backgroundSize = '';
            item.style.backgroundRepeat = '';
            item.style.backgroundPosition = '';
            
            const scoreLabel = item.querySelector('.score-label');
            if (scoreLabel) {
                scoreLabel.textContent = '';
            }
        });
        this.currentTileIndex = 0;
    }
    
    sortAndDisplayFaces() {
        this.clearAllTiles();
        
        if (this.allFaces.length === 0) {
            return;
        }
        
        const sortedFaces = [...this.allFaces].sort((a, b) => (b.score || 0) - (a.score || 0));
        const gridItems = document.querySelectorAll('.grid-item');
        
        sortedFaces.forEach((face, index) => {
            if (index >= gridItems.length) return;
            
            const currentTile = gridItems[index];
            
            let imageSource;
            if (face.metadata.image_path.startsWith('/uploads')) {
                imageSource = `/local${face.metadata.image_path}`;
            } else {
                imageSource = `/faces/${face.metadata.image_path}`;
            }

            if (imageSource && currentTile) {
                currentTile.style.backgroundImage = `url(${imageSource})`;
                currentTile.style.backgroundSize = 'contain';
                currentTile.style.backgroundRepeat = 'no-repeat';
                currentTile.style.backgroundPosition = 'center';
                
                const scoreLabel = currentTile.querySelector('.score-label');
                if (scoreLabel && face.score !== undefined) {
                    scoreLabel.textContent = `${face.metadata.name}:${face.score.toFixed(2)} (${face.index.split('-')[1].split('-')[0]})`;
                } else if (scoreLabel) {
                    scoreLabel.textContent = '--';
                }
            }
        });
        
        this.currentTileIndex = sortedFaces.length % gridItems.length;
    }

    getCapturedFaceCrop(faceAnalysis) {
        const activeCanvas = window.controllers?.userMedia?.currentMediaSource?.getCanvas?.();
        const bbox = faceAnalysis?.faces?.[0]?.bbox;

        if (!activeCanvas || !bbox || bbox.length < 4) {
            return null;
        }

        const [x1, y1, x2, y2] = bbox;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const faceWidth = Math.abs(x2 - x1);
        const faceHeight = Math.abs(y2 - y1);

        const paddingX = Math.floor(faceWidth * 0.15);
        const paddingY = Math.floor(faceHeight * 0.2);

        const cropX = Math.max(0, Math.floor(minX - paddingX));
        const cropY = Math.max(0, Math.floor(minY - paddingY));
        const maxX = Math.min(activeCanvas.width, Math.ceil(minX + faceWidth + paddingX));
        const maxY = Math.min(activeCanvas.height, Math.ceil(minY + faceHeight + paddingY));

        const cropWidth = maxX - cropX;
        const cropHeight = maxY - cropY;

        if (cropWidth <= 1 || cropHeight <= 1) {
            return null;
        }

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;

        const cropContext = cropCanvas.getContext('2d');
        if (!cropContext) {
            return null;
        }

        cropContext.drawImage(
            activeCanvas,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        return cropCanvas.toDataURL('image/jpeg', 0.85);
    }

    createInfoboxImageSlot(imgSrc, altText) {
        const slot = document.createElement('div');
        slot.style.display = 'flex';
        slot.style.flexDirection = 'column';
        slot.style.gap = '4px';
        slot.style.flex = '1 1 0';
        slot.style.minWidth = '0';

        const imgWrapper = document.createElement('div');
        imgWrapper.style.borderRadius = '6px';
        imgWrapper.style.overflow = 'hidden';
        imgWrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        imgWrapper.style.width = '100%';
        imgWrapper.style.aspectRatio = '1 / 1';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = altText;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';

        imgWrapper.appendChild(img);
        slot.appendChild(imgWrapper);

        return slot;
    }

    updateInfoboxImage(topFace, faceAnalysis = null) {
        const infoboxImage = document.getElementById('infobox-image');
        if (!infoboxImage) return;
        
        // Clear existing content
        infoboxImage.innerHTML = '';
        this.currentTopFace = null;
        this.currentCapturedFaceSrc = null;
        this.currentMatchImageSrc = null;
        
        if (!topFace || !topFace.metadata || !topFace.metadata.image_path) {
            if (this.expandButton) {
                this.expandButton.disabled = true;
            }
            return;
        }
        
        // Determine image source
        let imageSource;
        if (topFace.metadata.image_path.startsWith('/uploads')) {
            imageSource = `/local${topFace.metadata.image_path}`;
        } else {
            imageSource = `/faces/${topFace.metadata.image_path}`;
        }

        this.currentTopFace = topFace;
        this.currentMatchImageSrc = imageSource;
        if (this.expandButton) {
            this.expandButton.disabled = false;
        }
        
        infoboxImage.style.width = '300px';
        infoboxImage.style.height = '140px';
        infoboxImage.style.display = 'flex';
        infoboxImage.style.alignItems = 'stretch';
        infoboxImage.style.justifyContent = 'stretch';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.width = '100%';

        const capturedFaceSrc = this.getCapturedFaceCrop(faceAnalysis);
        if (capturedFaceSrc) {
            this.currentCapturedFaceSrc = capturedFaceSrc;
            container.appendChild(this.createInfoboxImageSlot(capturedFaceSrc, 'Captured face'));
        }

        container.appendChild(
            this.createInfoboxImageSlot(
                imageSource,
                topFace.metadata.name || 'Face match'
            )
        );

        infoboxImage.appendChild(container);
    }

    clearGrid() {
        const gridItems = document.querySelectorAll('.grid-item');
        
        Array.from(gridItems).forEach((tile, index) => {
            setTimeout(() => {
                tile.classList.add('fadeOut');
                
                setTimeout(() => {
                    tile.style.backgroundImage = '';
                    tile.style.backgroundSize = '';
                    tile.style.backgroundRepeat = '';
                    tile.style.backgroundPosition = '';
                    
                    const scoreLabel = tile.querySelector('.score-label');
                    if (scoreLabel) {
                        scoreLabel.textContent = '';
                    }
                    
                    tile.classList.remove('fadeOut');
                }, 300);
            }, index * 10);
        });
        
        // Clear stored faces
        this.allFaces = [];
        this.currentTileIndex = 0;
        
        // Clear infobox image
        const infoboxImage = document.getElementById('infobox-image');
        if (infoboxImage) {
            infoboxImage.innerHTML = '';
        }

        this.currentTopFace = null;
        this.currentCapturedFaceSrc = null;
        this.currentMatchImageSrc = null;
        this.currentVectorCount = null;
        this.currentSearchMs = null;
        if (this.expandButton) {
            this.expandButton.disabled = true;
        }
        this.refreshBadgeDisclaimer();
        this.closeBadgeModal();
    }
}