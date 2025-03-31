const analyticsApp = Vue.createApp({
    data() {
        return {
            analyticsData: [],
            filteredData: [],
            loading: true,
            generatingInsights: false, // Flag for UI button state
            isInsightProcessing: false, // Flag for actual sequential processing
            filters: { species: 'all', lifeStage: 'all', category: 'all', uniqueId: '' },
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
            // Rate Limiting for Insights
            insightQueue: [],
            insightApiDelay: 5500, // Delay between insight requests
            lastInsightRequestTime: 0,
        };
    },

    computed: {
        totalPages() { return Math.ceil(this.filteredData.length / this.itemsPerPage); },
        paginatedData() { const start = (this.currentPage - 1) * this.itemsPerPage; const end = start + this.itemsPerPage; return this.filteredData.slice(start, end); },
        paginationRange() {
            const range = []; const delta = 2; const left = this.currentPage - delta; const right = this.currentPage + delta + 1; let l;
            for (let i = 1; i <= this.totalPages; i++) { if (i === 1 || i === this.totalPages || (i >= left && i < right)) range.push(i); }
            const rangeWithDots = []; for (let i of range) { if (l) { if (i - l === 2) rangeWithDots.push(l + 1); else if (i - l !== 1) rangeWithDots.push('...'); } rangeWithDots.push(i); l = i; } return rangeWithDots;
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
            initializeFirebase().then(db => { if (db && db.ref) { db.ref('transcripts').off('value'); console.log("Firebase listener detached."); this.dbListenerAttached = false; }}).catch(e => console.error("Error getting DB to detach listener:", e));
         }
    },

    methods: {
        setupEventListeners() {},
        initializeCharts() { this.initPetDistributionChart(); },
        refreshCharts() { this.$nextTick(() => { this.updatePetDistributionChart(); }); },
        initPetDistributionChart() {
            const ctx = document.getElementById('petDistributionChartCanvas'); if (!ctx) { console.warn("Canvas not found for pet distribution chart"); return; }
            if (this.petDistributionChartInstance) this.petDistributionChartInstance.destroy();
            try {
                this.petDistributionChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels: ['Dogs', 'Cats', 'Other/Unknown'], datasets: [{ data: [0, 0, 0], backgroundColor: [ 'rgba(100, 181, 246, 0.8)', 'rgba(140, 82, 255, 0.8)', 'rgba(108, 117, 125, 0.8)' ], borderColor: [ 'rgba(100, 181, 246, 1)', 'rgba(140, 82, 255, 1)', 'rgba(108, 117, 125, 1)' ], borderWidth: 1 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: 'var(--text-muted)', font: { size: 10 }, boxWidth: 10, padding: 10 } }, tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#fff', bodyColor: '#fff', padding: 8 } }, cutout: '60%' }
                });
                console.log("Pet distribution chart initialized.");
            } catch (error) { console.error("Error initializing pet distribution chart:", error); }
        },
        async fetchAnalyticsData() {
            if (this.loading && this.analyticsData.length > 0) return; this.loading = true; console.log("Attempting to fetch analytics data...");
            try {
                const database = await initializeFirebase(); if (!database || !database.ref) throw new Error("Database instance is not available."); console.log(`Database ready. Using Firebase DB.`);
                if (this.dbListenerAttached) { this.loading = false; this.applyFilters(); return; }
                const transcriptsRef = database.ref('transcripts');
                const onValueChange = (snapshot) => {
                    const data = snapshot.val();
                    this.analyticsData = data ? Object.entries(data).map(([key, value]) => ({ ...value, firebaseId: key })) : []; console.log("Fetched data:", this.analyticsData.length, "entries");
                    this.applyFilters();
                    this.loading = false;
                    // Don't generate insights automatically here anymore
                };
                const onError = (error) => { console.error("Firebase read error:", error); this.loading = false; this.analyticsData = []; this.filteredData = []; this.updateAnalyticsDisplay(); alert(`Error fetching data: ${error.message}.`); };
                transcriptsRef.on('value', onValueChange, onError); this.dbListenerAttached = true; console.log("Firebase listener attached.");
            } catch (error) { console.error("Error initializing Firebase or attaching listener:", error); this.loading = false; this.analyticsData = []; this.filteredData = []; this.updateAnalyticsDisplay(); alert(`Failed to connect to the database: ${error.message}.`); }
        },
        applyFiltersDebounced() { if (this.debounceTimer) clearTimeout(this.debounceTimer); this.debounceTimer = setTimeout(() => { this.applyFilters(); }, 500); },
        applyFilters() {
            this.currentPage = 1; if (!this.analyticsData || this.analyticsData.length === 0) { this.filteredData = []; this.updateAnalyticsDisplay(); this.resetInsights(); return; }
            this.filteredData = this.analyticsData.filter(item => { const sm = this.filters.species === 'all' || item.petType === this.filters.species || (this.filters.species === 'other' && !['dog', 'cat'].includes(item.petType)); const lsm = this.filters.lifeStage === 'all' || item.lifeStage === this.filters.lifeStage; const cm = this.filters.category === 'all' || item.customerCategory === this.filters.category; const idm = !this.filters.uniqueId || (item.uniqueId && item.uniqueId.toLowerCase().includes(this.filters.uniqueId.toLowerCase())); return sm && lsm && cm && idm; }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
             this.updateAnalyticsDisplay(); this.resetInsights(); // Reset insights on filter change
        },
        resetInsights() { Object.keys(this.insights).forEach(key => this.insights[key] = '<p class=text-muted>Click Refresh Insights...</p>'); this.insightQueue = []; this.isInsightProcessing = false; this.generatingInsights = false; }, // Clear queue on reset
        updateAnalyticsDisplay() { this.updateBasicStats(); this.updateKnowledgeChart(); this.updatePetDistributionChart(); },
        updateBasicStats() { const dc=this.filteredData.filter(i=>i.petType==='dog').length; const cc=this.filteredData.filter(i=>i.petType==='cat').length; const pc=this.filteredData.filter(i=>i.clinicPitched).length; this.stats={total:this.filteredData.length,dogs:dc,cats:cc,clinicPitches:pc}; },
        updateKnowledgeChart() { const t=this.filteredData.length; if(t===0){this.knowledgeLevels={high:0,medium:0,low:0};return;} const h=this.filteredData.filter(i=>i.knowledgeLevel==='high').length; const m=this.filteredData.filter(i=>i.knowledgeLevel==='medium').length; const l=this.filteredData.filter(i=>i.knowledgeLevel==='low').length; this.knowledgeLevels={high:Math.round((h/t)*100),medium:Math.round((m/t)*100),low:Math.round((l/t)*100)}; },
        updatePetDistributionChart() { if(!this.petDistributionChartInstance){this.initPetDistributionChart();if(!this.petDistributionChartInstance)return;} this.$nextTick(()=>{try{const dc=this.filteredData.filter(i=>i.petType==='dog').length;const cc=this.filteredData.filter(i=>i.petType==='cat').length;const oc=this.filteredData.filter(i=>!['dog','cat'].includes(i.petType)).length;if(this.petDistributionChartInstance.data.datasets[0]){this.petDistributionChartInstance.data.datasets[0].data=[dc,cc,oc];this.petDistributionChartInstance.update();}else{console.warn("Pet dist chart dataset missing.");}}catch(e){console.error("Error updating pet dist chart:",e);}}); },
        changePage(page) { if (page >= 1 && page <= this.totalPages) this.currentPage = page; },
        selectTranscript(firebaseId) { this.selectedTranscriptId = firebaseId; },
        viewTranscriptDetail(transcript) { this.detailTranscript = transcript; if (this.detailModalInstance) this.detailModalInstance.show(); },
        openChatFromDetail() { if (this.detailTranscript?.firebaseId) { this.selectedTranscriptId = this.detailTranscript.firebaseId; if (this.detailModalInstance) this.detailModalInstance.hide(); this.prepareChatModal(); }},
        prepareChatModal() { if (!this.selectedTranscriptId) return; this.chatTargetTranscript = this.analyticsData.find(t => t.firebaseId === this.selectedTranscriptId); if (this.chatTargetTranscript && this.chatModalInstance) { this.transcriptChatHistory = [{type: 'bot', text: `Starting chat about transcript for ${this.chatTargetTranscript.uniqueId || this.chatTargetTranscript.petName || 'this pet'}. Ask me anything specific to this conversation.`}]; this.transcriptChatInput = ''; this.chatLoading = false; this.chatModalInstance.show(); this.scrollTranscriptChatToBottom(); } else { alert("Error: Could not load transcript data for chat."); }},
        resetChatModal() { this.transcriptChatHistory = []; this.transcriptChatInput = ''; this.chatLoading = false; this.chatTargetTranscript = null; },
        addTranscriptChatMessage(type, text) { this.transcriptChatHistory.push({ type, text }); this.scrollTranscriptChatToBottom(); },
        addTranscriptChatTypingIndicator() { this.chatLoading = true; this.scrollTranscriptChatToBottom(); },
        removeTranscriptChatTypingIndicator() { this.chatLoading = false; },
        scrollTranscriptChatToBottom() { this.$nextTick(() => { const el = document.getElementById('transcriptChatMessages'); if (el) setTimeout(() => el.scrollTop = el.scrollHeight, 50); }); },
        async sendTranscriptChatMessage() {
            const userMessage = this.transcriptChatInput.trim(); if (!userMessage || this.chatLoading || !this.chatTargetTranscript) return;
            this.addTranscriptChatMessage('user', userMessage); this.transcriptChatInput = ''; this.addTranscriptChatTypingIndicator();
            const prompt = `Analyze THIS SuperTails transcript:\n---\n${this.chatTargetTranscript.text}\n---\nUser Question: ${userMessage}\n\nAnswer based ONLY on this transcript. If the info isn't present, say so.`;
            try {
                const resp = await fetch(this.geminiApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})}); if(!resp.ok)throw new Error(`API Error: ${resp.statusText}`); const d=await resp.json(); let botResp="Sorry, couldn't process based on transcript."; if(d?.data?.candidates?.[0]?.content?.parts?.[0]?.text)botResp=d.data.candidates[0].content.parts[0].text; else if(d?.text)botResp=d.text; else if(typeof d==='string')botResp=d; this.addTranscriptChatMessage('bot',botResp);
            } catch(e){ console.error("Transcript Chat Gemini Error:",e); this.addTranscriptChatMessage('bot',`Sorry, error occurred: ${e.message}`); } finally { this.removeTranscriptChatTypingIndicator(); }
        },
        generateAllInsights() {
            if (this.isInsightProcessing || this.filteredData.length === 0) { if (this.filteredData.length === 0) { this.resetInsights(); } return; }
            console.log("Queueing insights generation..."); this.generatingInsights = true; this.isInsightProcessing = false; this.insightQueue = []; this.lastInsightRequestTime = 0;
            const prompts = [
                { key: 'commonQuestions', name: 'Common Questions', prompt: this.getInsightPromptCommonQuestions() }, { key: 'customerDifferences', name: 'Food vs Pharma', prompt: this.getInsightPromptCustomerDifferences() }, { key: 'excitementFactors', name: 'Excitement Factors', prompt: this.getInsightPromptExcitementFactors() },
                { key: 'effectivePitches', name: 'Effective Pitches', prompt: this.getInsightPromptEffectivePitches() }, { key: 'lifeStageInsights', name: 'Life Stage Insights', prompt: this.getInsightPromptLifeStageInsights() }, { key: 'clinicOpportunities', name: 'Clinic Opportunities', prompt: this.getInsightPromptClinicOpportunities() },
            ];
            Object.keys(this.insights).forEach(key => this.insights[key] = '<div class="text-center text-muted p-2"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>');
            prompts.forEach(({ key, name, prompt }) => { if (prompt) { this.insightQueue.push({ key, name, prompt }); } else { this.insights[key] = "<p class='text-muted'>Not enough data for this insight.</p>"; }});
            this.processInsightQueue();
        },
        async processInsightQueue() {
            if (this.isInsightProcessing || this.insightQueue.length === 0) { if (this.insightQueue.length === 0) { this.generatingInsights = false; console.log("Insight queue complete."); } return; }
            this.isInsightProcessing = true; this.generatingInsights = true; // Keep main flag true while processing
            const request = this.insightQueue.shift();
            const now = Date.now(); const timeSinceLast = now - this.lastInsightRequestTime; const delayNeeded = Math.max(0, this.insightApiDelay - timeSinceLast);
            if (delayNeeded > 0) { console.log(`Insight Rate Limiting: Wait ${delayNeeded}ms for ${request.key}...`); await new Promise(resolve => setTimeout(resolve, delayNeeded)); }
            console.log(`Generating insight for: ${request.key}`); this.lastInsightRequestTime = Date.now();
            try {
                const resp = await fetch(this.geminiApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:request.prompt})}); if(!resp.ok)throw new Error(`API Error ${resp.status}`); const d=await resp.json(); let txt="Could not generate insight."; if(d?.data?.candidates?.[0]?.content?.parts?.[0]?.text)txt=d.data.candidates[0].content.parts[0].text; else if(d?.text)txt=d.text; else if(typeof d==='string')txt=d; this.insights[request.key]=this.formatMarkdown(txt);
            } catch (e) { console.error(`Error for insight ${request.key}:`,e); this.insights[request.key]=`<p class='text-danger'>Error: ${e.message}</p>`; }
            this.isInsightProcessing = false; setTimeout(() => this.processInsightQueue(), 100); // Process next after a short yield
        },
        getInsightPromptBase() {
             const tc = this.filteredData.length; const ss = Math.min(tc, 25);
             const sd = this.filteredData.slice(0, ss).map(t=>({id:t.uniqueId||`anon_${t.firebaseId?.slice(-4)}`,txt_snip:t.text?t.text.substring(0,250)+(t.text.length>250?'...':''):'[No Text]',pT:t.petType,lS:t.lifeStage,kN:t.knowledgeLevel,cat:t.customerCategory,pch:t.clinicPitched}));
             return `Analyze ${tc} SuperTails transcripts (sample below). Focus ONLY on provided data. Use Markdown (lists, bold).\n\nSample:\n\`\`\`json\n${JSON.stringify(sd,null,1)}\n\`\`\`\n\nFilters: S=${this.filters.species}, St=${this.filters.lifeStage}, C=${this.filters.category}, ID=${this.filters.uniqueId||'N/A'}\n\nBased ONLY on these SuperTails transcripts, answer:\n`;
        },
        getInsightPromptCommonQuestions() { if(this.filteredData.length===0)return null; return this.getInsightPromptBase()+"1. Top 3-5 key questions/topics customers ask SuperTails staff? Ex?"; },
        getInsightPromptCustomerDifferences() { const fc=this.filteredData.filter(t=>t.customerCategory==='food'||t.customerCategory==='both').length; const pc=this.filteredData.filter(t=>t.customerCategory==='pharmacy'||t.customerCategory==='both').length; if(fc<2||pc<2)return null; return this.getInsightPromptBase()+`2. Differences in topics/questions between food vs pharmacy customers at SuperTails? Compare themes.`; },
        getInsightPromptExcitementFactors() { if(this.filteredData.length===0)return null; return this.getInsightPromptBase()+"3. What language (positive words, questions) indicates pet parent excitement during SuperTails interactions? 2-3 factors."; },
        getInsightPromptEffectivePitches() { if(this.filteredData.length===0)return null; return this.getInsightPromptBase()+"4. What vet clinic pitches (check-ups, treatments, SuperTails wellness plans) are *mentioned* or seem relevant for different life stages/species in these transcripts?"; },
        getInsightPromptLifeStageInsights() { if(this.filteredData.length===0)return null; return this.getInsightPromptBase()+"5. Key insights/concerns specific to life stages (puppy/kitten, adult, senior) based *only* on these SuperTails transcripts?"; },
        getInsightPromptClinicOpportunities() { if(this.filteredData.length===0)return null; const pc=this.filteredData.filter(t=>t.clinicPitched).length; const tc=this.filteredData.length; return this.getInsightPromptBase()+`6. Clinic Pitch Analysis: Out of ${tc} transcripts, ${pc} mention a pitch. Based *only* on content (health issues, age, low knowledge), estimate *missed opportunities* for a SuperTails clinic pitch. Explain types.`; },
        handleMultipleFileUpload(event) { const f = event.target.files; if (!f || f.length === 0) return; const fl = document.getElementById('analyticsFileList'); const fb = document.getElementById('analyticsFeedback'); fl.innerHTML = ''; this.showAnalyticsFeedback('info', `Processing ${f.length} file(s)...`); Array.from(f).forEach(file => { const fi = this.createFileListItem(file.name); fl.appendChild(fi); this.processSingleFileForAnalytics(file, fi); }); event.target.value = ''; },
        createFileListItem(fileName) { const i=document.createElement('div');i.className='file-item';i.innerHTML=`<div class="file-item-name"><i class="fas fa-file-alt"></i><span>${fileName}</span></div><span class="file-item-status status-waiting">Waiting...</span>`;return i; },
        updateFileListItemStatus(fi, sc, msg) { const ss=fi.querySelector('.file-item-status');ss.className=`file-item-status ${sc}`;ss.textContent=msg; const ic=fi.querySelector('.file-item-name i'); if(sc==='status-error')ic.className='fas fa-exclamation-circle text-danger'; else if(sc==='status-completed')ic.className='fas fa-check-circle text-success'; else ic.className='fas fa-spinner fa-spin text-info'; },
        showAnalyticsFeedback(type, msg) { const fb=document.getElementById('analyticsFeedback'); if(fb){fb.textContent=msg;fb.className=`file-feedback small mt-1 ${type}`;fb.style.display='block';} },
        async processSingleFileForAnalytics(file, fileItem) { const su=(sc,m)=>this.updateFileListItemStatus(fileItem,sc,m); try { const db=await initializeFirebase(); if(!db||!db.ref)throw new Error("DB not available."); su('status-processing','Processing...'); let txt=''; let uid=`upload_${file.name}_${Date.now()}@anon.com`; if(file.type.startsWith('audio/')){su('status-processing','Transcribing...');txt=await this.transcribeAudioForAnalytics(file);} else if(file.type==='text/plain'){su('status-processing','Reading...');txt=await file.text();} else{su('status-analyzing','Meta...');txt=`[${file.type} Content]`;} if(!txt&&!file.type.startsWith('audio/'))throw new Error("No content."); su('status-analyzing','Analyzing...'); const ad=this.analyzeTranscriptText(txt); const td={text:txt,uniqueId:uid,fileName:file.name,timestamp:new Date().toISOString(),...ad}; su('status-saving','Saving...'); const nr=db.ref('transcripts').push(); await nr.set(td); su('status-completed','Completed'); } catch(e){console.error("File processing error:",file.name,e);su('status-error',`Err: ${e.message.substring(0,25)}..`);} finally { const w=document.querySelectorAll('.status-waiting').length; const p=document.querySelectorAll('.status-processing, .status-analyzing, .status-saving').length; if(w===0&&p===0){const errs=document.querySelectorAll('.status-error').length; if(errs>0)this.showAnalyticsFeedback('warning',`Done with ${errs} error(s).`); else this.showAnalyticsFeedback('success','Uploads processed & saved.');}} },
        async transcribeAudioForAnalytics(file) { const fd=new FormData();fd.append('file',file); const lang=document.getElementById('languageSelect')?.value||'auto';fd.append('language',lang); console.log("Sending lang (Analytics):",lang); const r=await fetch(this.transcribeApiUrl,{method:'POST',body:fd}); if(!r.ok){const et=await r.text();throw new Error(`Transcription API Error: ${et||r.statusText}`);} return await r.text(); },
        formatTimestamp(iso) { if (!iso)return 'N/A'; try{const d=new Date(iso);return d.toLocaleString('en-US',{year:'2-digit',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return 'Invalid';} },
        formatText(txt) { if (!txt)return 'N/A'; return txt.charAt(0).toUpperCase()+txt.slice(1); },
        getPetTypeBadge(t) { switch(t){case 'dog':return 'pet-dog text-dark';case 'cat':return 'pet-cat';case 'other':return 'pet-other';default:return 'pet-unknown';}},
        getKnowledgeBadge(l) { switch(l){case 'high':return 'knowledge-high';case 'medium':return 'knowledge-medium';case 'low':return 'knowledge-low';default:return 'bg-secondary';}},
        formatMarkdown(txt) { if(!txt)return ''; let h=txt; h=h.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>'); h=h.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'); h=h.replace(/\*(.*?)\*/g,'<em>$1</em>'); h=h.replace(/^#+\s+(.*)/gm,'<h6>$1</h6>'); h=h.replace(/^\s*[-*+]\s+(.*)/gm,'<li>$1</li>'); h=h.replace(/((?:<li>.*?<\/li>\s*)+)/g,(m)=>`<ul style="margin-bottom:0.5rem;padding-left:1.2rem;">${m.replace(/<br>\s*<li>/g,'<li>')}</ul>`); h=h.replace(/\n{2,}/g,'<br><br>'); h=h.replace(/\n/g,'<br>'); h=h.replace(/<ul>\s*<\/ul>/g,''); return h; },
        analyzeTranscriptText(t){if(!t||typeof t!=='string')return{};return{petType:this.detectPetType(t),petName:this.extractPetName(t),lifeStage:this.detectLifeStage(t),knowledgeLevel:this.assessKnowledgeLevel(t),keyIssues:this.extractKeyIssues(t),customerCategory:this.detectCustomerCategory(t),clinicPitched:this.detectClinicPitch(t)};},
        detectPetType(t=''){const lt=t.toLowerCase();const dk=['dog','puppy','canine'];const ck=['cat','kitten','feline'];const dc=dk.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);const cc=ck.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);if(dc>cc)return 'dog';if(cc>dc)return 'cat';if(dc>0||cc>0)return 'other';return 'unknown';},
        extractPetName(t=''){const pts=[/my (?:dog|cat|pet)\s(?:is\s)?(?:called|named)\s(\w+)/i,/(\w+)\s(?:is\s)?my (?:dog|cat|pet)/i,/have a (?:dog|cat|pet)\s(?:called|named)\s(\w+)/i,/pet's name is\s(\w+)/i];for(const p of pts){const m=t.match(p);if(m&&m[1])return m[1].charAt(0).toUpperCase()+m[1].slice(1);}const w=t.split(/\s+/);const pk=['dog','cat','pet','puppy','kitten'];for(let i=0;i<w.length;i++){if(/^[A-Z][a-z]{2,}$/.test(w[i])&&!['I','He','She','They','My','The'].includes(w[i])){if(i>0&&pk.includes(w[i-1]?.toLowerCase().replace(/[.,!?]/g,'')))return w[i];if(i<w.length-1&&pk.includes(w[i+1]?.toLowerCase().replace(/[.,!?]/g,'')))return w[i];}}return 'Unknown';},
        detectLifeStage(t=''){const lt=t.toLowerCase();if(/\b(puppy|kitten|young|baby|newborn|\d+\s+months? old|\d+\s+weeks? old)\b/.test(lt))return 'puppy';if(/\b(senior|older|elderly|aging|geriatric|old dog|old cat)\b/.test(lt))return 'senior';if(/\b(adult|\d+\s+years? old|mature)\b/.test(lt))return 'adult';return 'unknown';},
        assessKnowledgeLevel(t=''){const lp=[/don't know/i,/not sure/i,/confused/i,/what should i/i,/how do i/i,/first-time/i];const hp=[/i've researched/i,/i read that/i,/according to/i,/understand that/i,/the vet recommended/i,/i've been (feeding|giving)/i];const lm=lp.filter(p=>p.test(t)).length;const hm=hp.filter(p=>p.test(t)).length;const s=hm-lm;if(s>=1)return 'high';if(s<=-1)return 'low';return 'medium';},
        extractKeyIssues(t=''){const iss=new Set();const cats={diet:['food','feed','diet','eat','nutrition','meal','appetite','kibble','treat'],health:['sick','pain','hurt','vet','medic','symptom','treat','disease','condition','vaccin','pills','arthritis','check-up','ill','vomit','diarrhea'],behavior:['behav','train','aggress','anxiety','scared','bark','bit','chew','house-trained','litter box','destruct'],grooming:['groom','bath','fur','hair','brush','nail','coat','shed','mat']};const lt=t.toLowerCase();for(const[cat,kws]of Object.entries(cats)){if(kws.some(kw=>lt.includes(kw)))iss.add(cat);}return iss.size>0?Array.from(iss).join(', '):'general';},
        detectCustomerCategory(t=''){const lt=t.toLowerCase();const fk=['food','diet','feeding','nutrition','meal','kibble','wet food','dry food','treats'];const pk=['medicine','medication','prescription','tablets','pills','treatment','therapy','arthritis','vaccination','supplement','flea','tick','worm'];const fs=fk.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);const ps=pk.reduce((n,k)=>n+(lt.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length,0);if(fs>0&&ps>0)return 'both';if(fs>ps)return 'food';if(ps>fs)return 'pharmacy';return 'general';},
        detectClinicPitch(t=''){const ck=['vet visit','veterinary clinic','check-up','examination','schedule an appointment','visit the vet','bring (him|her|them|your pet) in','veterinary care','clinic','veterinarian','vet appointment'];return ck.some(k=>t.toLowerCase().match(new RegExp(k.replace(/\s/g,'\\s*'),'i')));},
        forceRefreshData() { console.log("Forcing data refresh..."); this.loading=true; if(this.dbListenerAttached){ initializeFirebase().then(db=>{ if(db&&db.ref){db.ref('transcripts').off('value');this.dbListenerAttached=false;console.log("Listener detached for refresh.");this.fetchAnalyticsData();}else{console.error("DB not available");this.loading=false;} }).catch(e=>{console.error("Error detaching listener:",e);this.loading=false;}); }else{ this.fetchAnalyticsData(); } }
    }
}).mount('#analytics-app');

window.analyticsApp = analyticsApp;