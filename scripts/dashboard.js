export function dashboardComponent(mainAppInterface) { // Receive interface
    const { createApp, ref, onMounted, computed } = Vue;

    return createApp({
        setup() {
            const transcriptCount = ref(0);
            const loading = ref(true);
            const error = ref(null);

            // Access db via interface
            const db = mainAppInterface.getFirebaseDb(); // Use the getter

            const fetchDashboardData = async () => {
                loading.value = true;
                error.value = null;
                if (!db) { // Check if db is available
                    error.value = "Database connection not available.";
                    loading.value = false;
                    transcriptCount.value = 0; // Ensure count is 0 on error
                    return;
                }
                try {
                    // Use the actual db reference
                    const snapshot = await db.ref('transcripts').once('value');
                    const data = snapshot.val();
                    transcriptCount.value = data ? Object.keys(data).length : 0;
                } catch (err) {
                    console.error("Error fetching dashboard data:", err);
                    error.value = "Failed to load dashboard data.";
                    transcriptCount.value = 0; // Reset count on error
                } finally {
                    loading.value = false;
                }
            };

            const goToChat = () => {
                // Call changeView from the parent app if needed, or handle directly
                 if (typeof mainAppInterface.changeView === 'function') {
                    mainAppInterface.changeView('chat');
                 } else {
                    console.warn("changeView function not passed to dashboard component");
                 }
            };

            const goToAnalytics = () => {
                 if (typeof mainAppInterface.changeView === 'function') {
                    mainAppInterface.changeView('analytics');
                 } else {
                     console.warn("changeView function not passed to dashboard component");
                 }
            };

            onMounted(() => {
                fetchDashboardData();
            });

            return {
                transcriptCount,
                loading,
                error,
                goToChat,
                goToAnalytics
            };
        },
        template: `
            <div class="card dashboard-card" data-aos="fade-up">
              <div class="card-header">
                <i class="fas fa-tachometer-alt"></i>
                <h2>Dashboard Overview</h2>
              </div>
              <div class="card-body">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2 text-muted">Loading dashboard data...</p>
                </div>
                 <div v-else-if="error" class="alert alert-danger" role="alert">
                  {{ error }}
                </div>
                <div v-else class="row g-4 align-items-stretch"> {/* Use align-items-stretch */}
                  <div class="col-md-6 d-flex"> {/* Added d-flex */}
                    <div class="metric-card w-100 h-100"> {/* Use w-100 */}
                      <div class="metric-icon"><i class="fas fa-file-alt"></i></div>
                      <div class="metric-value">{{ transcriptCount }}</div>
                      <div class="metric-label">Total Transcripts Analyzed</div>
                    </div>
                  </div>
                  <div class="col-md-6 d-flex"> {/* Added d-flex */}
                     <div class="metric-card w-100 h-100 d-flex flex-column justify-content-center"> {/* Use w-100 */}
                       <div class="metric-icon"><i class="fas fa-lightbulb"></i></div>
                       <div class="metric-value">Insights</div>
                       <div class="metric-label">Explore aggregated data and trends</div>
                       <button @click="goToAnalytics" class="btn btn-sm btn-outline-custom mt-3 mx-auto" style="max-width: 150px;">View Analytics</button> {/* Centered button */}
                     </div>
                  </div>
                   <div class="col-12 cta-section">
                     <hr class="my-4" style="border-color: rgba(255,255,255,0.1);">
                     <h5>Ready to Analyze?</h5>
                     <p>Upload a new transcript or dive into the analytics.</p>
                     <button @click="goToChat" class="btn btn-primary-custom me-2">
                       <i class="fas fa-upload me-1"></i> Upload & Chat
                     </button>
                     <button @click="goToAnalytics" class="btn btn-outline-custom">
                       <i class="fas fa-chart-pie me-1"></i> View Analytics
                     </button>
                   </div>
                </div>
              </div>
            </div>
        `
    });
}
