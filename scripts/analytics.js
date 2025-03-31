const analyticsApp = Vue.createApp({
    data() {
        return {
            analyticsData: [],
            filteredData: [],
            loading: true,
            generatingInsights: false,
            filters: {
                species: 'all',
                lifeStage: 'all',
                category: 'all',
                uniqueId: '',
            },
            stats: { total: 0, dogs: 0, cats: 0, clinicPitches: 0 },
            knowledgeLevels: { high: 0, medium: 0, low: 0 },
            insights: {
                commonQuestions: '', customerDifferences: '', excitementFactors: '',
                effectivePitches: '', lifeStageInsights: '', clinicOpportunities: ''
            },
            detailTranscript: null,
            selectedTranscriptId: null,
            chatTargetTranscript: null,
            showChatModal: false,
            transcriptChatHistory: [],
            transcriptChatInput: '',
            chatLoading: false,
            debounceTimer: null,
            currentPage: 1,
            itemsPerPage: 10,
            petDistributionChartInstance: null,
            detailModalInstance: null,
            chatModalInstance: null,
            geminiApiUrl: "https://supertails.vercel.app/api/gemini",
            transcribeApiUrl: "https://supertails.vercel.app/api/transcribe",
            dbListenerAttached: false,
        };
    },

    computed: {
        totalPages() {
            return Math.ceil(this.filteredData.length / this.itemsPerPage);
        },
        paginatedData() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.filteredData.slice(start, end);
        },
        paginationRange() {
            const range = [];
            const delta = 2;
            const left = this.currentPage - delta;
            const right = this.currentPage + delta + 1;
            let l;

            for (let i = 1; i <= this.totalPages; i++) {
                if (i === 1 || i === this.totalPages || (i >= left && i < right)) {
                    range.push(i);
                }
            }

            const rangeWithDots = [];
            for (let i of range) {
                if (l) {
                    if (i - l === 2) {
                        rangeWithDots.push(l + 1);
                    } else if (i - l !== 1) {
                        rangeWithDots.push('...');
                    }
                }
                rangeWithDots.push(i);
                l = i;
            }
            return rangeWithDots;
        }
    },

    mounted() {
        this.setupEventListeners();
        this.initializeCharts();
        this.fetchAnalyticsData();

        const detailModalEl = document.getElementById('transcriptDetailModal');
        if (detailModalEl) this.detailModalInstance = new bootstrap.Modal(detailModalEl);

        const chatModalEl = document.getElementById('transcriptChatModal');
        if (chatModalEl) {
            this.chatModalInstance = new bootstrap.Modal(chatModalEl);
            chatModalEl.addEventListener('hidden.bs.modal', this.resetChatModal);
        }
    },

    beforeUnmount() {
        const chatModalEl = document.getElementById('transcriptChatModal');
        if (chatModalEl) chatModalEl.removeEventListener('hidden.bs.modal', this.resetChatModal);

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.petDistributionChartInstance) this.petDistributionChartInstance.destroy();

        if (this.dbListenerAttached) {
            initializeFirebase().then(db => {
                if (db && db.ref) { // Check if db and ref exist
                     db.ref('transcripts').off('value');
                     console.log("Firebase listener detached.");
                     this.dbListenerAttached = false;
                 }
            }).catch(e => console.error("Error getting DB instance to detach listener:", e));
         }
    },


    methods: {
        setupEventListeners() {
        },

        initializeCharts() {
            this.initPetDistributionChart();
        },

        refreshCharts() {
             this.$nextTick(() => {
                 this.updatePetDistributionChart();
             });
        },

        initPetDistributionChart() {
            const ctx = document.getElementById('petDistributionChartCanvas');
            if (!ctx) return;
            if (this.petDistributionChartInstance) this.petDistributionChartInstance.destroy();

            this.petDistributionChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Dogs', 'Cats', 'Other/Unknown'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: [ 'rgba(100, 181, 246, 0.8)', 'rgba(140, 82, 255, 0.8)', 'rgba(108, 117, 125, 0.8)' ],
                        borderColor: [ 'rgba(100, 181, 246, 1)', 'rgba(140, 82, 255, 1)', 'rgba(108, 117, 125, 1)' ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { color: 'var(--text-muted)', font: { size: 10 }, boxWidth: 10, padding: 10 } },
                        tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#fff', bodyColor: '#fff', padding: 8 }
                    },
                     cutout: '60%'
                }
            });
        },

        async fetchAnalyticsData() {
            if (this.loading && this.analyticsData.length > 0) return; // Prevent re-fetch if already loading initial data
            this.loading = true;
            console.log("Attempting to fetch analytics data...");

            try {
                const database = await initializeFirebase();
                if (!database || !database.ref) {
                    throw new Error("Database instance is not available after initialization.");
                }
                console.log(`Database ready. Using Firebase DB.`);

                if (this.dbListenerAttached) {
                    console.log("Listener already attached, skipping re-attachment.");
                    this.loading = false;
                    this.applyFilters(); // Ensure display updates with current data
                    return;
                }

                const transcriptsRef = database.ref('transcripts');
                const onValueChange = (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        console.log("Fetched data:", Object.keys(data).length, "entries");
                        this.analyticsData = Object.entries(data).map(([key, value]) => ({
                            ...value,
                            firebaseId: key
                        }));
                         this.applyFilters();
                    } else {
                        console.log("No data found in Firebase.");
                        this.analyticsData = [];
                        this.filteredData = [];
                    }
                    this.$nextTick(() => {
                        this.updateAnalyticsDisplay();
                        if (!this.generatingInsights && this.filteredData.length > 0) {
                             this.generateAllInsights(); // Auto-generate insights on first load/significant update
                        }
                    });
                    this.loading = false;
                };

                const onError = (error) => {
                     console.error("Firebase read error:", error);
                     this.loading = false;
                     this.analyticsData = [];
                     this.filteredData = [];
                     this.updateAnalyticsDisplay();
                     alert(`Error fetching data: ${error.message}. The analytics view may be incomplete.`);
                };

                transcriptsRef.on('value', onValueChange, onError);
                this.dbListenerAttached = true;
                console.log("Firebase listener attached.");

            } catch (error) {
                console.error("Error initializing Firebase or attaching listener:", error);
                this.loading = false;
                this.analyticsData = [];
                this.filteredData = [];
                this.updateAnalyticsDisplay();
                alert(`Failed to connect to the database: ${error.message}. Analytics will not load.`);
            }
        },

        applyFiltersDebounced() {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.applyFilters();
            }, 300);
        },

        applyFilters() {
            this.currentPage = 1;
             if (!this.analyticsData || this.analyticsData.length === 0) {
                 this.filteredData = [];
                  this.updateAnalyticsDisplay(); // Update stats etc. even if empty
                 return;
             }
            this.filteredData = this.analyticsData.filter(item => {
                const speciesMatch = this.filters.species === 'all' || item.petType === this.filters.species || (this.filters.species === 'other' && item.petType !== 'dog' && item.petType !== 'cat');
                const lifeStageMatch = this.filters.lifeStage === 'all' || item.lifeStage === this.filters.lifeStage;
                const categoryMatch = this.filters.category === 'all' || item.customerCategory === this.filters.category;
                const idMatch = !this.filters.uniqueId || (item.uniqueId && item.uniqueId.toLowerCase().includes(this.filters.uniqueId.toLowerCase()));
                return speciesMatch && lifeStageMatch && categoryMatch && idMatch;
            }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

             this.updateAnalyticsDisplay();
             // Optionally regenerate insights on filter change if desired
             // this.generateAllInsights();
        },

         updateAnalyticsDisplay() {
             this.updateBasicStats();
             this.updateKnowledgeChart();
             this.updatePetDistributionChart();
         },


        updateBasicStats() {
            const dogCount = this.filteredData.filter(item => item.petType === 'dog').length;
            const catCount = this.filteredData.filter(item => item.petType === 'cat').length;
            const pitchCount = this.filteredData.filter(item => item.clinicPitched).length;
            this.stats = { total: this.filteredData.length, dogs: dogCount, cats: catCount, clinicPitches: pitchCount };
        },

        updateKnowledgeChart() {
            const total = this.filteredData.length;
            if (total === 0) {
                 this.knowledgeLevels = { high: 0, medium: 0, low: 0 };
                 return;
            }
            const highKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'high').length;
            const mediumKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'medium').length;
            const lowKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'low').length;
            this.knowledgeLevels = {
                high: Math.round((highKnowledge / total) * 100),
                medium: Math.round((mediumKnowledge / total) * 100),
                low: Math.round((lowKnowledge / total) * 100)
            };
        },

        updatePetDistributionChart() {
            if (!this.petDistributionChartInstance) return;
            const dogCount = this.filteredData.filter(item => item.petType === 'dog').length;
            const catCount = this.filteredData.filter(item => item.petType === 'cat').length;
            const otherCount = this.filteredData.filter(item => item.petType !== 'dog' && item.petType !== 'cat').length;
            this.petDistributionChartInstance.data.datasets[0].data = [dogCount, catCount, otherCount];
            this.petDistributionChartInstance.update();
        },

        changePage(page) {
            if (page >= 1 && page <= this.totalPages) {
                this.currentPage = page;
            }
        },

        selectTranscript(firebaseId) {
            this.selectedTranscriptId = firebaseId;
        },

        viewTranscriptDetail(transcript) {
            this.detailTranscript = transcript;
             if (this.detailModalInstance) this.detailModalInstance.show();
        },

        openChatFromDetail() {
             if (this.detailTranscript && this.detailTranscript.firebaseId) {
                 this.selectedTranscriptId = this.detailTranscript.firebaseId;
                 if (this.detailModalInstance) this.detailModalInstance.hide();
                 this.prepareChatModal();
             }
        },

        prepareChatModal() {
             if (!this.selectedTranscriptId) return;
             this.chatTargetTranscript = this.analyticsData.find(t => t.firebaseId === this.selectedTranscriptId);
             if (this.chatTargetTranscript && this.chatModalInstance) {
                 this.transcriptChatHistory = [{type: 'bot', text: `Starting chat about transcript for ${this.chatTargetTranscript.uniqueId || this.chatTargetTranscript.petName || 'this pet'}. Ask me anything specific to this conversation.`}];
                 this.transcriptChatInput = '';
                 this.chatLoading = false;
                 this.chatModalInstance.show();
                 this.scrollTranscriptChatToBottom();
             } else {
                 console.error("Could not find selected transcript data for chat:", this.selectedTranscriptId);
                 alert("Error: Could not load transcript data for chat.");
             }
        },

        resetChatModal() {
            this.transcriptChatHistory = [];
            this.transcriptChatInput = '';
            this.chatLoading = false;
            this.chatTargetTranscript = null;
        },

         addTranscriptChatMessage(type, text) {
            this.transcriptChatHistory.push({ type, text });
            this.scrollTranscriptChatToBottom();
        },

         addTranscriptChatTypingIndicator() {
            this.chatLoading = true;
            this.scrollTranscriptChatToBottom();
        },

        removeTranscriptChatTypingIndicator() {
            this.chatLoading = false;
        },

         scrollTranscriptChatToBottom() {
             this.$nextTick(() => {
                 const chatMessages = document.getElementById('transcriptChatMessages');
                 if (chatMessages) {
                     chatMessages.scrollTop = chatMessages.scrollHeight;
                 }
             });
         },

        async sendTranscriptChatMessage() {
            const userMessage = this.transcriptChatInput.trim();
            if (!userMessage || this.chatLoading || !this.chatTargetTranscript) return;

            this.addTranscriptChatMessage('user', userMessage);
            this.transcriptChatInput = '';
            this.addTranscriptChatTypingIndicator();

            const prompt = `You are analyzing ONE specific transcript.
Transcript Content:
---
${this.chatTargetTranscript.text}
---
User Question: ${userMessage}

IMPORTANT: Answer the question based *ONLY* on the information found in THIS transcript. Do not use external knowledge. If the information isn't present, say so clearly. Keep answers concise and directly related to the question asked about this specific transcript.`;

            try {
                const response = await fetch(this.geminiApiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt })
                });
                 if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                const data = await response.json();
                let botResponse = "Sorry, I couldn't process that specific request based on the transcript.";

                if (data?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    botResponse = data.data.candidates[0].content.parts[0].text;
                } else if (data?.text) {
                    botResponse = data.text;
                } else if (typeof data === 'string') {
                    botResponse = data;
                }

                this.removeTranscriptChatTypingIndicator();
                this.addTranscriptChatMessage('bot', botResponse);

            } catch (error) {
                console.error("Transcript Chat Gemini Error:", error);
                this.removeTranscriptChatTypingIndicator();
                this.addTranscriptChatMessage('bot', `Sorry, an error occurred: ${error.message}`);
            }
        },


        async generateAllInsights() {
            if (this.generatingInsights || this.filteredData.length === 0) return;
            this.generatingInsights = true;

            const insightPrompts = [
                { key: 'commonQuestions', prompt: this.getInsightPromptCommonQuestions() },
                { key: 'customerDifferences', prompt: this.getInsightPromptCustomerDifferences() },
                { key: 'excitementFactors', prompt: this.getInsightPromptExcitementFactors() },
                { key: 'effectivePitches', prompt: this.getInsightPromptEffectivePitches() },
                { key: 'lifeStageInsights', prompt: this.getInsightPromptLifeStageInsights() },
                { key: 'clinicOpportunities', prompt: this.getInsightPromptClinicOpportunities() },
            ];

            Object.keys(this.insights).forEach(key => this.insights[key] = '<div class="text-center text-muted p-2"><div class="spinner-border spinner-border-sm text-secondary" role="status"><span class="visually-hidden">Loading...</span></div></div>');


            const insightPromises = insightPrompts.map(async ({ key, prompt }) => {
                if (!prompt) {
                    this.insights[key] = "<p class='text-muted'>Not enough data with current filters for this insight.</p>";
                    return;
                };
                try {
                    const response = await fetch(this.geminiApiUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt })
                    });
                    if (!response.ok) throw new Error(`API Error ${response.status}`);
                    const data = await response.json();

                    let resultText = "Could not generate insight.";
                     if (data?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        resultText = data.data.candidates[0].content.parts[0].text;
                    } else if (data?.text) {
                        resultText = data.text;
                    } else if (typeof data === 'string') {
                        resultText = data;
                    }
                    this.insights[key] = this.formatMarkdown(resultText);
                } catch (error) {
                    console.error(`Error generating insight for ${key}:`, error);
                    this.insights[key] = `<p class='text-danger'>Error generating insight: ${error.message}</p>`;
                }
            });

            await Promise.all(insightPromises);
            this.generatingInsights = false;
        },

        getInsightPromptBase() {
             const transcriptCount = this.filteredData.length;
             const sampleSize = Math.min(transcriptCount, 25);
             const sampledData = this.filteredData.slice(0, sampleSize).map(t => ({
                id: t.uniqueId || `anon_${t.firebaseId.slice(-4)}`,
                text_snippet: t.text ? t.text.substring(0, 250) + (t.text.length > 250 ? '...' : '') : '[No Text]',
                petType: t.petType,
                lifeStage: t.lifeStage,
                knowledge: t.knowledgeLevel,
                category: t.customerCategory,
                pitched: t.clinicPitched
             }));

            return `Analyze the following ${transcriptCount} customer transcripts (showing up to ${sampleSize} samples). Focus ONLY on the provided data. Summarize findings clearly using Markdown (use lists, bolding).

Sampled Transcripts Overview:
\`\`\`json
${JSON.stringify(sampledData, null, 1)}
\`\`\`

Filter Criteria Applied: Species=${this.filters.species}, Stage=${this.filters.lifeStage}, Category=${this.filters.category}, ID=${this.filters.uniqueId || 'N/A'}

Based *only* on trends within these transcripts, answer:\n`;
        },

        getInsightPromptCommonQuestions() {
            if (this.filteredData.length === 0) return null;
            return this.getInsightPromptBase() + "1. What are the top 3-5 key questions or topics customers are asking vets or companions about? Provide brief examples if possible.";
        },

        getInsightPromptCustomerDifferences() {
             const foodCount = this.filteredData.filter(t => t.customerCategory === 'food' || t.customerCategory === 'both').length;
             const pharmaCount = this.filteredData.filter(t => t.customerCategory === 'pharmacy' || t.customerCategory === 'both').length;
             if (foodCount < 2 || pharmaCount < 2) return null;

            return this.getInsightPromptBase() + `2. Are the conversation topics/questions notably different between customers interested in food vs. pharmacy? Compare their common themes based on the transcripts.`;
        },

         getInsightPromptExcitementFactors() {
             if (this.filteredData.length === 0) return null;
            return this.getInsightPromptBase() + "3. Based on language used (e.g., positive words like 'great', 'love', 'excited'; questions about specific features), what seems to excite pet parents the most during these interactions? Identify 2-3 key factors.";
        },

        getInsightPromptEffectivePitches() {
             if (this.filteredData.length === 0) return null;
            return this.getInsightPromptBase() + "4. What types of vet clinic pitches (e.g., check-ups, specific treatments, wellness plans) are *mentioned* or seem potentially relevant/effective for different pet life stages (puppy/kitten, adult, senior) or species (dog, cat) within these transcripts? Focus on what's *mentioned* or implied contextually.";
        },

         getInsightPromptLifeStageInsights() {
             if (this.filteredData.length === 0) return null;
            return this.getInsightPromptBase() + "5. What are the key insights or common concerns specific to different life stages (puppy/kitten, adult, senior) based *only* on these transcripts?";
        },

         getInsightPromptClinicOpportunities() {
            if (this.filteredData.length === 0) return null;
            const pitchedCount = this.filteredData.filter(t => t.clinicPitched).length;
            const totalCount = this.filteredData.length;
            return this.getInsightPromptBase() + `6. Clinic Pitch Analysis: Out of ${totalCount} transcripts, ${pitchedCount} explicitly mention a clinic pitch. Based *only* on the content (e.g., health issues discussed, senior/puppy status, low owner knowledge), estimate how many transcripts represent potential *missed opportunities* where a clinic pitch might have been relevant but wasn't mentioned. Explain the types of missed opportunities identified.`;
        },


        handleMultipleFileUpload(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            const fileListEl = document.getElementById('analyticsFileList');
            const feedbackEl = document.getElementById('analyticsFeedback');
            fileListEl.innerHTML = '';
            this.showAnalyticsFeedback('info', `Processing ${files.length} file(s)...`);

            Array.from(files).forEach(file => {
                const fileItem = this.createFileListItem(file.name);
                fileListEl.appendChild(fileItem);
                this.processSingleFileForAnalytics(file, fileItem);
            });
             event.target.value = '';
        },

        createFileListItem(fileName) {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-name">
                    <i class="fas fa-file-alt"></i>
                    <span>${fileName}</span>
                </div>
                <span class="file-item-status status-waiting">Waiting...</span>
            `;
            return item;
        },

        updateFileListItemStatus(fileItem, statusClass, message) {
            const statusSpan = fileItem.querySelector('.file-item-status');
            statusSpan.className = `file-item-status ${statusClass}`;
            statusSpan.textContent = message;
             const icon = fileItem.querySelector('.file-item-name i');
             if (statusClass === 'status-error') icon.className = 'fas fa-exclamation-circle text-danger';
             else if (statusClass === 'status-completed') icon.className = 'fas fa-check-circle text-success';
             else icon.className = 'fas fa-spinner fa-spin text-info';
        },

        showAnalyticsFeedback(type, message) {
            const feedbackEl = document.getElementById('analyticsFeedback');
            if(feedbackEl) {
                feedbackEl.textContent = message;
                feedbackEl.className = `file-feedback small mt-1 ${type}`;
                feedbackEl.style.display = 'block';
            }
        },

        async processSingleFileForAnalytics(file, fileItem) {
            const statusUpdater = (statusClass, message) => this.updateFileListItemStatus(fileItem, statusClass, message);

            try {
                 const database = await initializeFirebase();
                 if (!database || !database.ref) throw new Error("Database not available for saving.");

                statusUpdater('status-processing', 'Processing...');
                let transcriptText = '';
                let uniqueId = `upload_${file.name}_${Date.now()}@anon.com`;

                if (file.type.startsWith('audio/')) {
                    statusUpdater('status-processing', 'Transcribing...');
                    transcriptText = await this.transcribeAudioForAnalytics(file);
                } else if (file.type === 'text/plain') {
                    statusUpdater('status-processing', 'Reading...');
                    transcriptText = await file.text();
                } else {
                     statusUpdater('status-analyzing', 'Analyzing Metadata...');
                     transcriptText = `[${file.type} - Content not extracted in browser]`;
                }

                if (!transcriptText && !file.type.startsWith('audio/')) {
                     throw new Error("Could not read text content.");
                }

                statusUpdater('status-analyzing', 'Analyzing...');
                const analysisData = this.analyzeTranscriptText(transcriptText);

                const transcriptData = {
                    text: transcriptText,
                    uniqueId: uniqueId,
                    fileName: file.name,
                    timestamp: new Date().toISOString(),
                    ...analysisData
                };

                statusUpdater('status-saving', 'Saving...');

                const newTranscriptRef = database.ref('transcripts').push();
                await newTranscriptRef.set(transcriptData);

                statusUpdater('status-completed', 'Completed');
                 // Data will be updated by the Firebase listener, no manual push needed here

            } catch (error) {
                console.error("Error processing file:", file.name, error);
                statusUpdater('status-error', `Error: ${error.message.substring(0, 30)}..`);
            } finally {
                 const waiting = document.querySelectorAll('.status-waiting').length;
                 const processing = document.querySelectorAll('.status-processing, .status-analyzing, .status-saving').length;
                 if (waiting === 0 && processing === 0) {
                     const errors = document.querySelectorAll('.status-error').length;
                     if(errors > 0) this.showAnalyticsFeedback('warning', `Processing complete with ${errors} error(s).`);
                     else this.showAnalyticsFeedback('success', 'All files processed.');
                 }
            }
        },

         async transcribeAudioForAnalytics(file) {
            const formData = new FormData();
            formData.append('file', file);
            // --- FIX: Read selected language value correctly ---
             const selectedLanguage = document.getElementById('languageSelect')?.value || 'auto'; // Use main language select or default
             formData.append('language', selectedLanguage);
             console.log("Sending language to transcribe API (Analytics Upload):", selectedLanguage);
             // --- END FIX ---

            const response = await fetch(this.transcribeApiUrl, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Transcription API Error: ${errorText || response.statusText}`);
            }
            return await response.text();
        },


        formatTimestamp(isoString) {
            if (!isoString) return 'N/A';
            try {
                 const date = new Date(isoString);
                 return date.toLocaleString('en-US', { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            } catch { return 'Invalid Date'; }
        },

        formatText(text) {
            if (!text) return 'N/A';
            return text.charAt(0).toUpperCase() + text.slice(1);
        },

         getPetTypeBadge(type) {
            switch(type) {
                case 'dog': return 'pet-dog text-dark';
                case 'cat': return 'pet-cat';
                case 'other': return 'pet-other';
                default: return 'bg-secondary';
            }
        },

         getKnowledgeBadge(level) {
             switch(level) {
                 case 'high': return 'knowledge-high';
                 case 'medium': return 'knowledge-medium';
                 case 'low': return 'knowledge-low';
                 default: return 'bg-secondary';
             }
        },

        formatMarkdown(text) {
            if (!text) return '';
            let html = text;
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            html = html.replace(/^#+\s+(.*)/gm, '<h6>$1</h6>');
            html = html.replace(/^\s*[-*+]\s+(.*)/gm, '<li>$1</li>');
            html = html.replace(/((<li>.*<\/li>\s*)+)/g, (match) => `<ul style="margin-bottom: 0.5rem; padding-left: 1.2rem;">${match}</ul>`);
            html = html.replace(/\n{2,}/g, '<br><br>'); // Paragraph breaks
            html = html.replace(/\n/g, '<br>'); // Single line breaks
            // Clean up potential empty list wrappers
            html = html.replace(/<ul>\s*<\/ul>/g, '');
            return html;
        },

         analyzeTranscriptText(text) {
            if (!text || typeof text !== 'string') return {};
            return {
                petType: this.detectPetType(text),
                petName: this.extractPetName(text),
                lifeStage: this.detectLifeStage(text),
                knowledgeLevel: this.assessKnowledgeLevel(text),
                keyIssues: this.extractKeyIssues(text),
                customerCategory: this.detectCustomerCategory(text),
                clinicPitched: this.detectClinicPitch(text)
            };
        },

         detectPetType(text) {
          const lowerText = text.toLowerCase();
          const dogKeywords = ['dog', 'puppy', 'canine', 'doggie', 'pooch'];
          const catKeywords = ['cat', 'kitten', 'feline', 'kitty'];
          const dogCount = dogKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
          const catCount = catKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
          if (dogCount > catCount) return 'dog';
          if (catCount > dogCount) return 'cat';
          if (dogCount > 0 || catCount > 0) return 'other';
          return 'unknown';
        },

        extractPetName(text) {
           const patterns = [ /my (?:dog|cat|pet)\s(?:is\s)?(?:called|named)\s(\w+)/i, /(\w+)\s(?:is\s)?my (?:dog|cat|pet)/i, /have a (?:dog|cat|pet)\s(?:called|named)\s(\w+)/i, /pet's name is\s(\w+)/i ];
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match && match[1]) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
            }
            const words = text.split(/\s+/);
            const petKeywords = ['dog', 'cat', 'pet', 'puppy', 'kitten'];
            for (let i = 0; i < words.length; i++) {
                 if (/^[A-Z][a-z]{2,}$/.test(words[i]) && !['I', 'He', 'She', 'They', 'My', 'The'].includes(words[i])) {
                    if (i > 0 && petKeywords.includes(words[i-1].toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
                    if (i < words.length - 1 && petKeywords.includes(words[i+1].toLowerCase().replace(/[.,!?]/g, ''))) return words[i];
                }
            }
           return 'Unknown';
        },

        detectLifeStage(text) {
          const lowerText = text.toLowerCase();
          if (/\b(puppy|kitten|young|baby|newborn|\d+\s+months? old|\d+\s+weeks? old)\b/.test(lowerText)) return 'puppy';
          if (/\b(senior|older|elderly|aging|geriatric|old dog|old cat)\b/.test(lowerText)) return 'senior';
          if (/\b(adult|\d+\s+years? old|mature)\b/.test(lowerText)) return 'adult';
          return 'unknown';
        },

         assessKnowledgeLevel(text) {
            const lowPatterns = [/don't know/i, /not sure/i, /confused/i, /what should i/i, /how do i/i, /first-time/i];
            const highPatterns = [/i've researched/i, /i read that/i, /according to/i, /understand that/i, /the vet recommended/i, /i've been (feeding|giving)/i];
            const lowMatches = lowPatterns.filter(p => p.test(text)).length;
            const highMatches = highPatterns.filter(p => p.test(text)).length;
            const score = highMatches - lowMatches;
            if (score >= 1) return 'high';
            if (score <= -1) return 'low';
            return 'medium';
        },

         extractKeyIssues(text) {
            const issues = new Set();
            const categories = {
                diet: ['food', 'feed', 'diet', 'eating', 'nutrition', 'meal', 'appetite', 'kibble', 'treats'],
                health: ['sick', 'pain', 'hurt', 'vet', 'medicine', 'symptom', 'treatment', 'disease', 'condition', 'vaccination', 'pills', 'arthritis', 'check-up', 'ill', 'vomit', 'diarrhea'],
                behavior: ['behavior', 'training', 'aggressive', 'anxiety', 'scared', 'barking', 'biting', 'chewing', 'house-trained', 'litter box', 'destructive'],
                grooming: ['groom', 'bath', 'fur', 'hair', 'brush', 'nail', 'coat', 'shedding', 'matting']
            };
            const lowerText = text.toLowerCase();
            for (const [category, keywords] of Object.entries(categories)) {
                if (keywords.some(kw => lowerText.includes(kw))) {
                    issues.add(category);
                }
            }
            return issues.size > 0 ? Array.from(issues).join(', ') : 'general';
        },

        detectCustomerCategory(text) {
            const lowerText = text.toLowerCase();
            const foodKeywords = ['food', 'diet', 'feeding', 'nutrition', 'meal', 'kibble', 'wet food', 'dry food', 'treats'];
            const pharmacyKeywords = ['medicine', 'medication', 'prescription', 'tablets', 'pills', 'treatment', 'therapy', 'arthritis', 'vaccination', 'supplement', 'flea', 'tick', 'worm'];
            const foodScore = foodKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
            const pharmacyScore = pharmacyKeywords.reduce((n, k) => n + (lowerText.match(new RegExp(`\\b${k}\\b`, 'g')) || []).length, 0);
            if (foodScore > 0 && pharmacyScore > 0) return 'both';
            if (foodScore > pharmacyScore) return 'food';
            if (pharmacyScore > foodScore) return 'pharmacy';
            return 'general';
        },

        detectClinicPitch(text) {
            const clinicKeywords = ['vet visit', 'veterinary clinic', 'check-up', 'examination', 'schedule an appointment', 'visit the vet', 'bring (him|her|them|your pet) in', 'veterinary care', 'clinic', 'veterinarian', 'vet appointment'];
             return clinicKeywords.some(keyword => text.toLowerCase().match(new RegExp(keyword.replace(/\s/g, '\\s*'), 'i')));
        },

         forceRefreshData() {
             console.log("Forcing data refresh...");
             this.loading = true; // Indicate loading during refresh
             if (this.dbListenerAttached) {
                 initializeFirebase().then(db => {
                     if (db && db.ref) {
                         db.ref('transcripts').off('value');
                         this.dbListenerAttached = false;
                         console.log("Listener detached for refresh.");
                         // Re-fetch immediately after detaching
                         this.fetchAnalyticsData();
                     } else {
                         console.error("DB not available to detach listener for refresh.");
                         this.loading = false;
                     }
                 }).catch(e => {
                     console.error("Error getting DB instance to detach listener for refresh:", e);
                     this.loading = false;
                 });
             } else {
                 // If listener wasn't attached (e.g., initial load failed), just try fetching again
                 this.fetchAnalyticsData();
             }
         }

    }
}).mount('#analytics-app');

window.analyticsApp = analyticsApp;