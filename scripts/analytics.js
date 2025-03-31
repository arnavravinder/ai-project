export function analyticsComponent(mainApp) {
    const { createApp, ref, onMounted, computed } = Vue;

    return createApp({
        setup() {
            const allTranscripts = ref([]);
            const filteredTranscripts = ref([]);
            const loading = ref(true);
            const error = ref(null);
            const filters = ref({
                species: 'all',
                lifeStage: 'all',
                category: 'all',
                searchTerm: ''
            });

            const analysisResults = ref({
                keyQuestions: { loading: false, error: null, content: '' },
                foodVsPharmacy: { loading: false, error: null, content: '' },
                excitementFactors: { loading: false, error: null, content: '' },
                effectivePitches: { loading: false, error: null, content: '' },
                lifeStageInsights: { loading: false, error: null, content: '' },
                clinicOpportunities: { loading: false, error: null, content: '' }
            });

            const loadDataAndAnalyze = async () => {
                loading.value = true;
                error.value = null;
                if (!mainApp.db) {
                    error.value = "Database connection not available.";
                    loading.value = false;
                    return;
                }
                try {
                    const snapshot = await mainApp.db.ref('transcripts').once('value');
                    const data = snapshot.val();
                    if (data) {
                         allTranscripts.value = Object.entries(data).map(([key, value]) => ({
                            id: key, // Use Firebase key as ID
                            emailId: value.emailId || 'N/A', // Assume emailId might exist
                             ...value, // Spread the rest of the transcript data
                            // Ensure expected fields exist, provide defaults if necessary
                             petType: value.petType || 'unknown',
                             lifeStage: value.lifeStage || 'unknown',
                             customerCategory: value.customerCategory || 'unknown',
                             text: value.text || '',
                             clinicPitched: typeof value.clinicPitched === 'boolean' ? value.clinicPitched : false,
                         }));
                         applyFilters(); // Apply initial filters (which includes search term)
                         runAllAnalyses(); // Trigger analyses after data load
                    } else {
                        allTranscripts.value = [];
                        filteredTranscripts.value = [];
                         // Reset analyses if no data
                         Object.keys(analysisResults.value).forEach(key => {
                             analysisResults.value[key] = { loading: false, error: null, content: 'No transcript data found.' };
                         });
                    }
                } catch (err) {
                    console.error("Error fetching analytics data:", err);
                    error.value = "Failed to load transcript data.";
                    allTranscripts.value = [];
                    filteredTranscripts.value = [];
                } finally {
                    loading.value = false;
                }
            };

            const applyFilters = () => {
                 if (!allTranscripts.value) return;
                 filteredTranscripts.value = allTranscripts.value.filter(item => {
                    const speciesMatch = filters.value.species === 'all' || (item.petType && item.petType.toLowerCase() === filters.value.species);
                    const lifeStageMatch = filters.value.lifeStage === 'all' || (item.lifeStage && item.lifeStage.toLowerCase() === filters.value.lifeStage);
                    const categoryMatch = filters.value.category === 'all' || (item.customerCategory && item.customerCategory.toLowerCase() === filters.value.category);
                    const searchTermMatch = filters.value.searchTerm === '' || (item.text && item.text.toLowerCase().includes(filters.value.searchTerm.toLowerCase())) || (item.id && item.id.toLowerCase().includes(filters.value.searchTerm.toLowerCase())) || (item.emailId && item.emailId.toLowerCase().includes(filters.value.searchTerm.toLowerCase()));

                    return speciesMatch && lifeStageMatch && categoryMatch && searchTermMatch;
                 });
                 runAllAnalyses(); // Re-run analyses when filters change
            };

            const runAnalysis = async (analysisKey, promptGenerator) => {
                if (!filteredTranscripts.value || filteredTranscripts.value.length === 0) {
                    analysisResults.value[analysisKey] = { loading: false, error: null, content: 'No data matches the current filters.' };
                    return;
                }

                analysisResults.value[analysisKey] = { loading: true, error: null, content: '' };
                try {
                    const prompt = promptGenerator(filteredTranscripts.value);
                    if (!prompt) {
                         analysisResults.value[analysisKey] = { loading: false, error: null, content: 'Not enough specific data for this analysis.' };
                         return;
                    }
                    const result = await mainApp.callGeminiAPI(prompt);
                    // Basic Markdown formatting for display
                    const formattedResult = result
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/^- (.*$)/gm, '<li class="mb-1">$1</li>') // Basic list item
                        .replace(/(\<li.*\>.*?\<\/li\>)/gs, '<ul class="list-unstyled ps-3 mt-2">$1</ul>') // Wrap lists
                        .replace(/\n/g, '<br>'); // Newlines

                    analysisResults.value[analysisKey] = { loading: false, error: null, content: formattedResult };
                } catch (err) {
                    console.error(`Error running analysis ${analysisKey}:`, err);
                    analysisResults.value[analysisKey] = { loading: false, error: `Analysis failed: ${err.message}`, content: '' };
                }
            };

            const runAllAnalyses = () => {
                 runAnalysis('keyQuestions', generateKeyQuestionsPrompt);
                 runAnalysis('foodVsPharmacy', generateFoodVsPharmacyPrompt);
                 runAnalysis('excitementFactors', generateExcitementFactorsPrompt);
                 runAnalysis('effectivePitches', generateEffectivePitchesPrompt);
                 runAnalysis('lifeStageInsights', generateLifeStageInsightsPrompt);
                 runAnalysis('clinicOpportunities', generateClinicOpportunitiesPrompt);
            };

            // --- Prompt Generation Functions ---

            const formatTranscriptsForPrompt = (transcripts, maxLength = 15000) => {
                 let combinedText = "";
                 for (const t of transcripts) {
                     const entry = `Transcript ID: ${t.id}\nEmail: ${t.emailId}\nSpecies: ${t.petType}\nLife Stage: ${t.lifeStage}\nCategory: ${t.customerCategory}\nPitched Clinic: ${t.clinicPitched}\nContent:\n${t.text}\n---\n`;
                     if (combinedText.length + entry.length > maxLength) break; // Avoid exceeding prompt limits
                     combinedText += entry;
                 }
                 return combinedText || "No relevant transcripts found.";
            }

            const generateKeyQuestionsPrompt = (transcripts) => {
                const transcriptText = formatTranscriptsForPrompt(transcripts);
                return `Based on the following customer-vet transcripts, identify and list the top 5-7 key questions or recurring topics customers are asking about. Focus on the core concerns expressed by the pet parents.\n\nTranscripts:\n${transcriptText}`;
            };

             const generateFoodVsPharmacyPrompt = (transcripts) => {
                 const foodCustomers = transcripts.filter(t => t.customerCategory === 'food');
                 const pharmacyCustomers = transcripts.filter(t => t.customerCategory === 'pharmacy');

                 if (foodCustomers.length < 2 || pharmacyCustomers.length < 2) return null; // Need enough data for comparison

                 const foodText = formatTranscriptsForPrompt(foodCustomers, 7000);
                 const pharmacyText = formatTranscriptsForPrompt(pharmacyCustomers, 7000);

                 return `Compare the conversation topics and customer concerns for 'Food' customers versus 'Pharmacy' customers based on these transcripts. Are there notable differences in what they discuss or ask about?\n\nFood Customer Transcripts:\n${foodText}\n\nPharmacy Customer Transcripts:\n${pharmacyText}`;
            };

             const generateExcitementFactorsPrompt = (transcripts) => {
                 const transcriptText = formatTranscriptsForPrompt(transcripts);
                 return `Analyze the following transcripts. What specific parts of the conversation, topics, products, or advice seem to generate the most positive reactions or excitement from the pet parents? Identify 3-5 key factors.\n\nTranscripts:\n${transcriptText}`;
            };

             const generateEffectivePitchesPrompt = (transcripts) => {
                 const transcriptText = formatTranscriptsForPrompt(transcripts);
                 return `Examine the transcripts for instances where a vet pitch or recommendation (e.g., for a clinic visit, specific product, service) was made. Based *only* on the conversational context within these transcripts, identify which types of pitches seem most relevant or potentially effective for different pet life stages (puppy/kitten, adult, senior) and species (dog, cat). Provide examples if possible.\n\nTranscripts:\n${transcriptText}`;
            };

             const generateLifeStageInsightsPrompt = (transcripts) => {
                 const transcriptText = formatTranscriptsForPrompt(transcripts);
                 return `Provide key insights and common concerns observed for different pet life stages (puppy/kitten, adult, senior) based *solely* on the content of these transcripts. Summarize the main points for each relevant life stage found in the data.\n\nTranscripts:\n${transcriptText}`;
            };

             const generateClinicOpportunitiesPrompt = (transcripts) => {
                const pitchedCount = transcripts.filter(t => t.clinicPitched === true).length;
                const notPitchedCount = transcripts.filter(t => t.clinicPitched === false).length;
                const potentialMissed = transcripts.filter(t => t.clinicPitched === false && (t.text.toLowerCase().includes('sick') || t.text.toLowerCase().includes('problem') || t.text.toLowerCase().includes('concern') || t.text.toLowerCase().includes('issue') || t.text.toLowerCase().includes('vet visit') || t.text.toLowerCase().includes('check-up'))).length;

                const transcriptText = formatTranscriptsForPrompt(transcripts.filter(t => t.clinicPitched === false), 10000); // Focus prompt on non-pitched

                const summary = `Analysis Summary:\n- Total Filtered Transcripts: ${transcripts.length}\n- Clinic Pitched: ${pitchedCount}\n- Clinic Not Pitched: ${notPitchedCount}\n- Potential Missed Opportunities (based on keywords in non-pitched): ${potentialMissed}\n\n`;

                return summary + `Now, analyze the transcripts where the clinic was *not* pitched. What are common reasons or contexts where a clinic visit might have been relevant but wasn't suggested? Identify patterns or types of situations representing potential missed opportunities based on the conversation flow.\n\nTranscripts (Clinic Not Pitched):\n${transcriptText}`;
            };


            const openTranscriptChat = (transcript) => {
                 mainApp.showTranscriptChatModal(transcript.id, transcript.text);
            };


            onMounted(() => {
                 loadDataAndAnalyze();
            });

            // Watch filters for changes and re-apply
            Vue.watch(filters, applyFilters, { deep: true });


            return {
                filteredTranscripts,
                loading,
                error,
                filters,
                analysisResults,
                applyFilters, // Expose for potential manual refresh?
                openTranscriptChat
            };
        },
        template: `
            <div class="card analytics-card h-100">
              <div class="card-header">
                 <i class="fas fa-chart-pie"></i>
                 <h3 class="h5">Transcript Analytics</h3>
              </div>
              <div class="analytics-body">
                <div v-if="loading && !error" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading Analytics...</span>
                    </div>
                     <p class="mt-2 text-muted">Loading transcripts and running analyses...</p>
                </div>
                <div v-else-if="error" class="alert alert-danger" role="alert">
                  {{ error }}
                </div>
                <div v-else>
                    <!-- Filters -->
                    <div class="filter-section">
                        <div class="row g-3 align-items-end">
                            <div class="col-md-3">
                                <label for="filterSpecies" class="form-label">Species</label>
                                <select id="filterSpecies" class="form-select form-select-sm" v-model="filters.species">
                                <option value="all">All</option>
                                <option value="dog">Dog</option>
                                <option value="cat">Cat</option>
                                <option value="unknown">Unknown</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label for="filterLifeStage" class="form-label">Life Stage</label>
                                <select id="filterLifeStage" class="form-select form-select-sm" v-model="filters.lifeStage">
                                <option value="all">All</option>
                                <option value="puppy">Puppy/Kitten</option>
                                <option value="adult">Adult</option>
                                <option value="senior">Senior</option>
                                <option value="unknown">Unknown</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label for="filterCategory" class="form-label">Customer Category</label>
                                <select id="filterCategory" class="form-select form-select-sm" v-model="filters.category">
                                <option value="all">All</option>
                                <option value="food">Food</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="both">Both</option>
                                 <option value="unknown">Unknown</option>
                                </select>
                            </div>
                             <div class="col-md-3">
                                <label for="filterSearchTerm" class="form-label">Search Transcripts</label>
                                <input type="text" id="filterSearchTerm" class="form-control form-control-sm" v-model="filters.searchTerm" placeholder="ID, Email, or Keyword...">
                            </div>
                        </div>
                    </div>

                     <!-- Transcript Table -->
                    <div class="analysis-section">
                        <h4>Filtered Transcripts ({{ filteredTranscripts.length }})</h4>
                        <div class="transcript-table-container">
                             <table class="table table-sm table-hover">
                                 <thead>
                                     <tr>
                                         <th>ID/Email</th>
                                         <th>Species</th>
                                         <th>Life Stage</th>
                                         <th>Category</th>
                                         <th>Clinic Pitched</th>
                                         <th>Actions</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     <tr v-if="filteredTranscripts.length === 0">
                                         <td colspan="6" class="text-center text-muted py-3">No transcripts match the current filters.</td>
                                     </tr>
                                     <tr v-for="transcript in filteredTranscripts" :key="transcript.id">
                                         <td class="text-truncate" :title="transcript.id + ' | ' + transcript.emailId" style="max-width: 150px;">
                                             <small>{{ transcript.id }}</small><br><small>{{ transcript.emailId }}</small>
                                         </td>
                                         <td>{{ transcript.petType }}</td>
                                         <td>{{ transcript.lifeStage }}</td>
                                         <td>{{ transcript.customerCategory }}</td>
                                         <td>
                                             <span :class="transcript.clinicPitched ? 'text-success' : 'text-danger'">
                                                <i :class="['fas', transcript.clinicPitched ? 'fa-check-circle' : 'fa-times-circle']"></i>
                                             </span>
                                         </td>
                                         <td>
                                             <button class="btn btn-sm btn-outline-custom" @click="openTranscriptChat(transcript)" title="Chat with this transcript">
                                                 <i class="fas fa-comments"></i>
                                             </button>
                                         </td>
                                     </tr>
                                 </tbody>
                             </table>
                        </div>
                    </div>


                    <!-- Analysis Sections -->
                    <div class="row g-4">
                        <div class="col-lg-6" v-for="(analysis, key) in analysisResults" :key="key">
                            <div class="analysis-section h-100">
                                <h4 class="text-capitalize">{{ key.replace(/([A-Z])/g, ' $1').trim() }}</h4>
                                <div class="analysis-content">
                                     <div v-if="analysis.loading" class="analysis-loader text-muted">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                                        <span>Analyzing...</span>
                                     </div>
                                     <div v-else-if="analysis.error" class="alert alert-warning alert-sm py-2 px-3">Error: {{ analysis.error }}</div>
                                     <div v-else v-html="analysis.content || 'No analysis results yet.'"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
              </div>
            </div>
        `
    });
}