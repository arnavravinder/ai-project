export function analyticsComponent(mainAppInterface) { // Receive interface
    const { createApp, ref, onMounted, computed, watch, nextTick } = Vue; // Add watch, nextTick

    return createApp({
        setup() {
            const allTranscripts = ref([]);
            const filteredTranscripts = ref([]);
            const loading = ref(true); // Controls overall loading state
            const error = ref(null);
            const filters = ref({
                species: 'all',
                lifeStage: 'all',
                category: 'all',
                searchTerm: ''
            });

            // Individual loading/error states for each analysis
            const analysisResults = ref({
                keyQuestions: { loading: false, error: null, content: '', id: 'kq' },
                foodVsPharmacy: { loading: false, error: null, content: '', id: 'fvp' },
                excitementFactors: { loading: false, error: null, content: '', id: 'ef' },
                effectivePitches: { loading: false, error: null, content: '', id: 'ep' },
                lifeStageInsights: { loading: false, error: null, content: '', id: 'lsi' },
                clinicOpportunities: { loading: false, error: null, content: '', id: 'co' }
            });

            // Access functions/refs from interface
            const db = mainAppInterface.getFirebaseDb();
            const callGeminiAPI = mainAppInterface.callGeminiAPI;
            const showTranscriptChatModal = mainAppInterface.showTranscriptChatModal;

            const loadDataAndAnalyze = async () => {
                loading.value = true; // Show main loader
                error.value = null;
                if (!db) {
                    error.value = "Database connection not available.";
                    loading.value = false;
                    allTranscripts.value = []; // Reset data
                    applyFilters(); // Ensure filtered is also empty
                    return;
                }
                try {
                    const snapshot = await db.ref('transcripts').orderByChild('timestamp').once('value'); // Order by timestamp if available
                    const data = snapshot.val();
                    if (data) {
                         // Process newest first if ordered by timestamp descending (Firebase default is ascending)
                         const keys = Object.keys(data).reverse(); // Reverse keys if ordered ascending
                         allTranscripts.value = keys.map(key => ({
                            id: key,
                            emailId: data[key].emailId || 'N/A',
                            petType: data[key].petType || 'unknown',
                            lifeStage: data[key].lifeStage || 'unknown',
                            customerCategory: data[key].customerCategory || 'unknown',
                            text: data[key].text || '',
                            timestamp: data[key].timestamp || '', // Keep timestamp if available
                            clinicPitched: typeof data[key].clinicPitched === 'boolean' ? data[key].clinicPitched : false,
                         }));
                         applyFilters(); // Apply filters, which triggers analysis
                    } else {
                        allTranscripts.value = [];
                        filteredTranscripts.value = [];
                        resetAnalysisStates('No transcript data found in the database.');
                    }
                } catch (err) {
                    console.error("Error fetching analytics data:", err);
                    error.value = "Failed to load transcript data.";
                    allTranscripts.value = [];
                    filteredTranscripts.value = [];
                     resetAnalysisStates(`Error loading data: ${err.message}`);
                } finally {
                    loading.value = false; // Hide main loader
                }
            };

            const applyFilters = () => {
                 // This function now just filters data. Analysis is triggered by the watcher.
                 if (!Array.isArray(allTranscripts.value)) {
                     filteredTranscripts.value = [];
                     return;
                 }
                 filteredTranscripts.value = allTranscripts.value.filter(item => {
                    // Ensure item and properties exist before lowercasing
                    const textLower = item.text ? item.text.toLowerCase() : '';
                    const idLower = item.id ? item.id.toLowerCase() : '';
                    const emailLower = item.emailId ? item.emailId.toLowerCase() : '';
                    const searchTermLower = filters.value.searchTerm ? filters.value.searchTerm.toLowerCase() : '';

                    const speciesMatch = filters.value.species === 'all' || (item.petType && item.petType.toLowerCase() === filters.value.species);
                    const lifeStageMatch = filters.value.lifeStage === 'all' || (item.lifeStage && item.lifeStage.toLowerCase() === filters.value.lifeStage);
                    const categoryMatch = filters.value.category === 'all' || (item.customerCategory && item.customerCategory.toLowerCase() === filters.value.category);
                    const searchTermMatch = searchTermLower === '' || textLower.includes(searchTermLower) || idLower.includes(searchTermLower) || emailLower.includes(searchTermLower);

                    return speciesMatch && lifeStageMatch && categoryMatch && searchTermMatch;
                 });
                 console.log(`Filters applied. ${filteredTranscripts.value.length} transcripts remaining.`);
                 // runAllAnalyses(); // Removed - watcher handles this
            };

             const resetAnalysisStates = (message = 'Analysis reset.') => {
                 Object.keys(analysisResults.value).forEach(key => {
                     analysisResults.value[key] = { ...analysisResults.value[key], loading: false, error: null, content: message };
                 });
             }

            const runAnalysis = async (analysisKey, promptGenerator) => {
                 // Use nextTick to ensure filteredTranscripts has updated from watcher
                 await nextTick();

                 const currentFilteredData = filteredTranscripts.value; // Use the latest filtered data

                 if (!Array.isArray(currentFilteredData) || currentFilteredData.length === 0) {
                    analysisResults.value[analysisKey] = { ...analysisResults.value[analysisKey], loading: false, error: null, content: 'No data matches the current filters for this analysis.' };
                    return;
                 }

                 analysisResults.value[analysisKey] = { ...analysisResults.value[analysisKey], loading: true, error: null, content: '' };
                 try {
                    const prompt = promptGenerator(currentFilteredData); // Pass current filtered data
                    if (!prompt) {
                         analysisResults.value[analysisKey] = { ...analysisResults.value[analysisKey], loading: false, error: null, content: 'Not enough specific data for this analysis based on current filters.' };
                         return;
                    }

                    const result = await callGeminiAPI(prompt); // Use interface function

                    // Refined Markdown formatting for display
                    const formattedResult = result
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')     // Italics
                        .replace(/`([^`]+)`/g, '<code>$1</code>')   // Inline code
                        .replace(/```([\s\S]*?)```/gs, (match, code) => `<pre class="code-block"><code>${code.trim()}</code></pre>`) // Code blocks
                        .replace(/^\s*[-*]\s+(.*)/gm, '<li class="mb-1">$1</li>') // Handle both - and * lists
                        // Wrap consecutive LIs in ULs more reliably
                        .replace(/((?:<li.*?>.*?<\/li>\s*)+)/gs, '<ul class="list-unstyled ps-3 mt-2">$1</ul>')
                        // Ensure single LIs are also wrapped if they appear alone after regex
                        .replace(/(?<!<\/ul>\s*)<li class="mb-1">(.*?)<\/li>(?!\s*<li)/gs, '<ul class="list-unstyled ps-3 mt-2"><li class="mb-1">$1</li></ul>')
                        .replace(/\n/g, '<br>'); // Newlines


                    analysisResults.value[analysisKey] = { ...analysisResults.value[analysisKey], loading: false, error: null, content: formattedResult || "Analysis complete, but no specific content was returned." };
                 } catch (err) {
                    console.error(`Error running analysis ${analysisKey}:`, err);
                    analysisResults.value[analysisKey] = { ...analysisResults.value[analysisKey], loading: false, error: `Analysis failed: ${err.message}`, content: '' };
                 }
            };

            const runAllAnalyses = () => {
                 console.log("Running all analyses...");
                 runAnalysis('keyQuestions', generateKeyQuestionsPrompt);
                 runAnalysis('foodVsPharmacy', generateFoodVsPharmacyPrompt);
                 runAnalysis('excitementFactors', generateExcitementFactorsPrompt);
                 runAnalysis('effectivePitches', generateEffectivePitchesPrompt);
                 runAnalysis('lifeStageInsights', generateLifeStageInsightsPrompt);
                 runAnalysis('clinicOpportunities', generateClinicOpportunitiesPrompt);
            };

            // --- Prompt Generation Functions ---
            // (Keep these concise and focused)
             const formatTranscriptsForPrompt = (transcripts, maxLength = 15000, includeContent = true) => {
                 let combinedText = "";
                 // Sort by timestamp if available, newest first (assuming ascending order from Firebase)
                 const sortedTranscripts = transcripts.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

                 for (const t of sortedTranscripts) {
                     // Include less metadata in prompt unless specifically needed by the analysis
                     const entryHeader = `Transcript ID: ${t.id} (Species: ${t.petType}, Stage: ${t.lifeStage}, Category: ${t.customerCategory}, Pitched: ${t.clinicPitched})\n`;
                     const entryContent = includeContent ? `Content:\n${(t.text || '').substring(0, 500)}...\n---\n` : '---\n'; // Limit content length per transcript
                     const fullEntry = entryHeader + entryContent;

                     if (combinedText.length + fullEntry.length > maxLength) break;
                     combinedText += fullEntry;
                 }
                 return combinedText || "[No relevant transcripts found matching criteria]";
            }


            const generateKeyQuestionsPrompt = (transcripts) => {
                const transcriptText = formatTranscriptsForPrompt(transcripts, 15000, true); // Include content
                return `Analyze the core concerns and questions expressed by pet parents in the following transcripts. Summarize the top 5-7 recurring themes or key questions asked.\n\nRelevant Transcripts:\n${transcriptText}`;
            };

             const generateFoodVsPharmacyPrompt = (transcripts) => {
                 const foodCustomers = transcripts.filter(t => t.customerCategory === 'food');
                 const pharmacyCustomers = transcripts.filter(t => t.customerCategory === 'pharmacy');

                 if (foodCustomers.length < 1 || pharmacyCustomers.length < 1) return null; // Allow comparison even with one each

                 const foodText = formatTranscriptsForPrompt(foodCustomers, 7000, true);
                 const pharmacyText = formatTranscriptsForPrompt(pharmacyCustomers, 7000, true);

                 return `Compare conversation topics and customer concerns for 'Food' vs 'Pharmacy' customers. Highlight any distinct differences in the types of questions asked or issues raised based on these samples:\n\nFood Customers Summary:\n${foodText}\nPharmacy Customers Summary:\n${pharmacyText}`;
            };

             const generateExcitementFactorsPrompt = (transcripts) => {
                 const transcriptText = formatTranscriptsForPrompt(transcripts, 15000, true);
                 return `Identify parts of the conversations in these transcripts that seem to elicit positive reactions or excitement from pet parents (e.g., related to products, advice, results). List 3-5 key factors or topics.\n\nRelevant Transcripts:\n${transcriptText}`;
            };

             const generateEffectivePitchesPrompt = (transcripts) => {
                 const pitchedTranscripts = transcripts.filter(t => t.clinicPitched);
                 if (pitchedTranscripts.length === 0) return "No transcripts with clinic pitches found in the filtered data.";

                 const transcriptText = formatTranscriptsForPrompt(pitchedTranscripts, 15000, true);
                 return `Based *only* on the conversational context where a vet pitch/recommendation was made in these transcripts, what types of pitches seem most relevant or potentially effective for different pet life stages (puppy/kitten, adult, senior) and species (dog, cat)? Provide specific examples if evident in the text.\n\nTranscripts with Pitches:\n${transcriptText}`;
            };

             const generateLifeStageInsightsPrompt = (transcripts) => {
                 const transcriptText = formatTranscriptsForPrompt(transcripts, 15000, true);
                 return `Summarize the key insights and common concerns observed for different pet life stages (puppy/kitten, adult, senior) based *solely* on the content of these transcripts.\n\nRelevant Transcripts:\n${transcriptText}`;
            };

             const generateClinicOpportunitiesPrompt = (transcripts) => {
                const pitchedCount = transcripts.filter(t => t.clinicPitched === true).length;
                const notPitchedCount = transcripts.filter(t => t.clinicPitched === false).length;
                const nonPitchedTranscripts = transcripts.filter(t => !t.clinicPitched);

                // Basic keyword check for potential missed - this is rudimentary
                const potentialMissedKeywords = ['sick', 'problem', 'concern', 'issue', 'pain', 'emergency', 'urgent', 'symptom', 'diagnosis'];
                const potentialMissedCount = nonPitchedTranscripts.filter(t => potentialMissedKeywords.some(kw => (t.text || '').toLowerCase().includes(kw))).length;

                const summary = `Analysis Summary (Filtered Data):\n- Total: ${transcripts.length}\n- Clinic Pitched: ${pitchedCount}\n- Clinic Not Pitched: ${notPitchedCount}\n- Potential Missed (Keyword based): ~${potentialMissedCount}\n\n`;

                const transcriptText = formatTranscriptsForPrompt(nonPitchedTranscripts, 10000, true); // Focus on non-pitched

                return summary + `Analyze the transcripts where the clinic was *not* pitched. What common situations or discussion points represent potential missed opportunities for recommending a clinic visit, based on the conversation?\n\nTranscripts (Clinic Not Pitched):\n${transcriptText}`;
            };


            const openTranscriptChat = (transcript) => {
                // Use interface function
                 if (transcript && transcript.id && transcript.text) {
                     showTranscriptChatModal(transcript.id, transcript.text);
                 } else {
                     console.error("Invalid transcript data passed to openTranscriptChat", transcript);
                 }
            };


            // Watch the filtered transcripts ref. When it changes, run analyses.
            watch(filteredTranscripts, (newValue, oldValue) => {
                 // Avoid running on initial load if loadDataAndAnalyze already triggers it
                 // Check if it's truly a change in content, not just reference
                 if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
                    console.log("Filtered transcripts changed, re-running analyses...");
                    runAllAnalyses();
                 }
            }, { deep: true }); // Use deep watch if necessary, but maybe not needed if just array ref changes

            onMounted(() => {
                 loadDataAndAnalyze(); // Initial load
            });

            return {
                filteredTranscripts,
                loading,
                error,
                filters, // Needs to be returned for v-model
                analysisResults,
                // applyFilters, // Expose if manual refresh button is needed
                openTranscriptChat,
                loadDataAndAnalyze // Expose for potential refresh
            };
        },
        template: `
            <div class="card analytics-card h-100">
              <div class="card-header">
                 <i class="fas fa-chart-pie"></i>
                 <h3 class="h5 mb-0">Transcript Analytics</h3> {/* Use mb-0 on h3 */}
              </div>
              <!-- Ensure analytics-body allows scrolling -->
              <div class="analytics-body">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading Analytics...</span>
                    </div>
                     <p class="mt-2 text-muted">Loading transcripts and preparing analyses...</p>
                </div>
                <div v-else-if="error" class="alert alert-danger" role="alert">
                  {{ error }}
                </div>
                <div v-else>
                    <!-- Filters -->
                    <div class="filter-section">
                        <div class="row g-2 align-items-end"> {/* Reduced gutter */}
                            <div class="col-md-3 col-6">
                                <label for="filterSpecies" class="form-label mb-1">Species</label>
                                <select id="filterSpecies" class="form-select form-select-sm" v-model="filters.species">
                                <option value="all">All</option>
                                <option value="dog">Dog</option>
                                <option value="cat">Cat</option>
                                <option value="unknown">Unknown</option>
                                </select>
                            </div>
                            <div class="col-md-3 col-6">
                                <label for="filterLifeStage" class="form-label mb-1">Life Stage</label>
                                <select id="filterLifeStage" class="form-select form-select-sm" v-model="filters.lifeStage">
                                <option value="all">All</option>
                                <option value="puppy">Puppy/Kitten</option>
                                <option value="adult">Adult</option>
                                <option value="senior">Senior</option>
                                <option value="unknown">Unknown</option>
                                </select>
                            </div>
                            <div class="col-md-3 col-6">
                                <label for="filterCategory" class="form-label mb-1">Category</label>
                                <select id="filterCategory" class="form-select form-select-sm" v-model="filters.category">
                                <option value="all">All</option>
                                <option value="food">Food</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="both">Both</option>
                                 <option value="unknown">Unknown</option>
                                </select>
                            </div>
                             <div class="col-md-3 col-6">
                                <label for="filterSearchTerm" class="form-label mb-1">Search</label>
                                <input type="text" id="filterSearchTerm" class="form-control form-control-sm" v-model="filters.searchTerm" placeholder="ID, Email, Keyword...">
                            </div>
                        </div>
                    </div>

                     <!-- Transcript Table -->
                    <div class="analysis-section">
                        <h4 class="d-flex justify-content-between align-items-center">
                             <span>Filtered Transcripts ({{ filteredTranscripts.length }})</span>
                             <!-- Optional Refresh Button -->
                             <!-- <button @click="loadDataAndAnalyze" class="btn btn-sm btn-outline-secondary"><i class="fas fa-sync"></i> Refresh</button> -->
                         </h4>
                        <div class="transcript-table-container">
                             <table class="table table-sm table-hover align-middle"> {/* Added align-middle */}
                                 <thead>
                                     <tr>
                                         <th>ID / Email</th>
                                         <th>Species</th>
                                         <th>Stage</th> {/* Shortened */}
                                         <th>Category</th>
                                         <th>Pitched</th> {/* Shortened */}
                                         <th class="text-center">Actions</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     <tr v-if="filteredTranscripts.length === 0">
                                         <td colspan="6" class="text-center text-muted py-3 fst-italic">No transcripts match the current filters.</td>
                                     </tr>
                                     <tr v-for="transcript in filteredTranscripts" :key="transcript.id">
                                         <td class="text-truncate" :title="transcript.id + ' | ' + transcript.emailId" style="max-width: 150px; font-size: 0.75rem;">
                                             <span class="d-block text-primary-emphasis fw-medium">{{ transcript.id }}</span>
                                             <span class="d-block text-muted">{{ transcript.emailId }}</span>
                                         </td>
                                         <td class="text-capitalize">{{ transcript.petType }}</td>
                                         <td class="text-capitalize">{{ transcript.lifeStage }}</td>
                                         <td class="text-capitalize">{{ transcript.customerCategory }}</td>
                                         <td class="text-center">
                                             <span :class="transcript.clinicPitched ? 'text-success-emphasis' : 'text-danger-emphasis'" :title="transcript.clinicPitched ? 'Yes' : 'No'">
                                                <i :class="['fas', transcript.clinicPitched ? 'fa-check-circle' : 'fa-times-circle']"></i>
                                             </span>
                                         </td>
                                         <td class="text-center">
                                             <button class="btn btn-sm btn-outline-custom py-1 px-2" @click="openTranscriptChat(transcript)" title="Chat with this transcript">
                                                 <i class="fas fa-comments"></i>
                                             </button>
                                         </td>
                                     </tr>
                                 </tbody>
                             </table>
                        </div>
                    </div>


                    <!-- Analysis Sections -->
                    <div class="row g-3"> {/* Reduced gutter */}
                        <div class="col-lg-6 d-flex" v-for="(analysis, key) in analysisResults" :key="analysis.id"> {/* Use unique ID */}
                            <div class="analysis-section w-100 h-100"> {/* Use w-100, h-100 */}
                                <h4 class="text-capitalize">{{ key.replace(/([A-Z])/g, ' $1').trim() }}</h4>
                                <div class="analysis-content">
                                     <div v-if="analysis.loading" class="analysis-loader text-muted">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                                        <span>Analyzing...</span>
                                     </div>
                                     <div v-else-if="analysis.error" class="alert alert-warning alert-sm py-1 px-2 mb-0"> <!-- Compact error -->
                                        <i class="fas fa-exclamation-triangle me-1"></i> Error: {{ analysis.error }}
                                     </div>
                                     <!-- Use v-html cautiously, ensure API responses are trusted -->
                                     <div v-else v-html="analysis.content || '<p class=\\'fst-italic text-muted\\'>No analysis results yet.</p>'"></div>
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
