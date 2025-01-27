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
        const url = document.getElementById('clipUrl').value.trim();
        const submitBtn = document.getElementById('submitBtn');
        const status = document.getElementById('status');
        const result = document.getElementById('result');

        if (!url) {
            this.showStatus('Please enter a Twitch URL', true);
            return;
        }

        submitBtn.disabled = true;
        this.showStatus('Fetching content info...');
        result.innerHTML = '';

        try {
            // First, determine what type of content it is
            const contentType = this.getContentType(url);
            let contentInfo;

            switch(contentType) {
                case 'channel':
                    contentInfo = await this.getChannelInfo(url);
                    break;
                case 'clip':
                    contentInfo = await this.getClipInfo(url);
                    break;
                case 'video':
                    contentInfo = await this.getVideoInfo(url);
                    break;
                default:
                    throw new Error('Unsupported URL type');
            }

            this.displayContentInfo(contentInfo);
            this.showStatus('');
        } catch (error) {
            this.showStatus(error.message, true);
        } finally {
            submitBtn.disabled = false;
        }
    }

    getContentType(url) {
        if (url.includes('/clip/')) return 'clip';
        if (url.includes('clips.twitch.tv')) return 'clip';
        if (url.includes('/videos/')) return 'video';
        return 'channel';
    }

    async getChannelInfo(url) {
        const channelName = url.split('/').pop();
        
        const query = {
            operationName: 'StreamMetadata',
            variables: {
                channelLogin: channelName
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '1c719a40e481453e5c48d9bb585d971b8b372f8ebb105b17076722264dfa5b3e'
                }
            }
        };

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Client-Id': this.CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        if (!response.ok) throw new Error('Failed to fetch channel info');

        const data = await response.json();
        if (!data.data?.user) {
            throw new Error('Channel not found');
        }

        return {
            type: 'channel',
            title: data.data.user.displayName,
            thumbnail: data.data.user.profileImageURL,
            broadcaster: data.data.user.displayName,
            url: url
        };
    }

    async getVideoInfo(url) {
        const videoId = url.split('/videos/')[1];
        
        const query = {
            operationName: 'VideoMetadata',
            variables: {
                videoID: videoId
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '226edb3e692509f727fd56821f5653c05740242c82b0388883e0c0e75dcbf687'
                }
            }
        };

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Client-Id': this.CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        if (!response.ok) throw new Error('Failed to fetch video info');

        const data = await response.json();
        if (!data.data?.video) {
            throw new Error('Video not found');
        }

        return {
            type: 'video',
            title: data.data.video.title,
            thumbnail: data.data.video.thumbnailURL,
            broadcaster: data.data.video.owner.displayName,
            url: url
        };
    }

    async getClipInfo(url) {
        const clipId = this.extractClipId(url);
        
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

        const response = await fetch(this.GQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Client-Id': this.CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const data = await response.json();
        if (!data.data?.clip) {
            throw new Error('Content not found');
        }

        return {
            type: 'clip',
            title: data.data.clip.title,
            thumbnail: data.data.clip.thumbnailURL,
            broadcaster: data.data.clip.broadcaster.displayName,
            url: url,
            downloadUrl: this.getClipDownloadUrl(data.data.clip)
        };
    }

    getClipDownloadUrl(clip) {
        const quality = clip.videoQualities[0];
        const token = clip.playbackAccessToken;
        return `${quality.sourceURL}?sig=${token.signature}&token=${encodeURIComponent(token.value)}`;
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
        
        return url.split('/').pop();
    }

    displayContentInfo(contentInfo) {
        const result = document.getElementById('result');
        result.innerHTML = `
            <div class="clip-container">
                <div class="clip-info">
                    <img src="${contentInfo.thumbnail}" alt="${contentInfo.title}" class="clip-thumbnail">
                    <div class="clip-details">
                        <h3>${contentInfo.title}</h3>
                        <p>Channel: ${contentInfo.broadcaster}</p>
                        ${this.getDownloadButton(contentInfo)}
                    </div>
                </div>
            </div>
        `;
    }

    getDownloadButton(contentInfo) {
        switch(contentInfo.type) {
            case 'clip':
                return `<button onclick="downloader.downloadContent('${contentInfo.downloadUrl}', '${contentInfo.title}')" class="download-button">Download Clip</button>`;
            case 'channel':
            case 'video':
                return `<p class="error">Direct download not available for this content type.</p>`;
            default:
                return '';
        }
    }

    async downloadContent(url, title) {
        try {
            this.showStatus('Starting download...');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to download content');
            
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
