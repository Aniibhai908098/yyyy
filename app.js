class TwitchDownloader {
    constructor() {
        this.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        this.GQL_ENDPOINT = 'https://gql.twitch.tv/gql';
        this.setupEventListeners();
    }

    setupEventListeners() {
        const submitBtn = document.getElementById('submitBtn');
        const clipUrl = document.getElementById('clipUrl');

        submitBtn.addEventListener('click', () => this.handleSubmit());
        clipUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSubmit();
        });
    }

    async handleSubmit() {
        const clipUrl = document.getElementById('clipUrl').value.trim();
        const submitBtn = document.getElementById('submitBtn');
        const status = document.getElementById('status');
        const result = document.getElementById('result');

        if (!clipUrl) {
            this.showStatus('Please enter a Twitch clip URL', true);
            return;
        }

        // Validate URL format first
        if (!this.isValidClipUrl(clipUrl)) {
            this.showStatus('Please enter a valid Twitch clip URL. Example: https://clips.twitch.tv/ClipName or https://www.twitch.tv/channel/clip/ClipName', true);
            return;
        }

        submitBtn.disabled = true;
        this.showStatus('Fetching clip info...');
        result.innerHTML = '';

        try {
            const clipInfo = await this.getClipInfo(clipUrl);
            this.displayClipInfo(clipInfo);
            this.showStatus('');
        } catch (error) {
            this.showStatus(error.message, true);
        } finally {
            submitBtn.disabled = false;
        }
    }

    isValidClipUrl(url) {
        // Add more specific URL validation
        const clipPatterns = [
            /^https?:\/\/clips\.twitch\.tv\/\w+/,
            /^https?:\/\/(?:www\.)?twitch\.tv\/\w+\/clip\/\w+/
        ];

        return clipPatterns.some(pattern => pattern.test(url));
    }

    async getClipInfo(url) {
        const clipId = this.extractClipId(url);
        if (!clipId) {
            throw new Error('This appears to be a channel URL. Please provide a clip URL instead.\nExample: https://clips.twitch.tv/ClipName');
        }

        const query = {
            operationName: 'VideoAccessToken_Clip',
            variables: { slug: clipId },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11'
                }
            }
        };

        try {
            const response = await fetch(this.GQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Client-Id': this.CLIENT_ID,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(query)
            });

            if (!response.ok) throw new Error('Failed to fetch clip info');

            const data = await response.json();
            if (!data.data?.clip) throw new Error('Clip not found. Make sure you\'re using a clip URL, not a channel URL.');

            return this.processClipData(data.data.clip);
        } catch (error) {
            throw new Error('Error fetching clip. Make sure you\'re using a clip URL, not a channel URL.');
        }
    }

    extractClipId(url) {
        const patterns = [
            /clips\.twitch\.tv\/(\w+)/,
            /twitch\.tv\/\w+\/clip\/(\w+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    processClipData(clip) {
        if (!clip.videoQualities || clip.videoQualities.length === 0) {
            throw new Error('No video qualities found for this clip');
        }

        const quality = clip.videoQualities[0]; // Get highest quality
        const token = clip.playbackAccessToken;
        const downloadUrl = `${quality.sourceURL}?sig=${token.signature}&token=${encodeURIComponent(token.value)}`;

        return {
            title: clip.title || 'Twitch Clip',
            broadcaster: clip.broadcaster?.displayName || 'Unknown',
            thumbnail: clip.thumbnailURL,
            downloadUrl: downloadUrl
        };
    }

    displayClipInfo(clipInfo) {
        const result = document.getElementById('result');
        result.innerHTML = `
            <div class="clip-container">
                <div class="clip-info">
                    <img src="${clipInfo.thumbnail}" alt="${clipInfo.title}" class="clip-thumbnail">
                    <div class="clip-details">
                        <h3>${clipInfo.title}</h3>
                        <p>Channel: ${clipInfo.broadcaster}</p>
                        <button onclick="downloader.downloadClip('${clipInfo.downloadUrl}', '${clipInfo.title}')" class="download-button">
                            Download Clip
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async downloadClip(url, title) {
        try {
            this.showStatus('Starting download...');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to download clip');
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            this.showStatus('Download started!');
        } catch (error) {
            this.showStatus('Download failed. Please try again.', true);
        }
    }

    showStatus(message, isError = false) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = isError ? 'error' : '';
    }
}

// Initialize the downloader
const downloader = new TwitchDownloader();
