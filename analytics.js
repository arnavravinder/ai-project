let analyticsData = null;
let questionChart = null;
let filteredData = [];
let analyticsApp = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeAnalytics();
});

function initializeAnalytics() {
  analyticsApp = Vue.createApp({
    data() {
      return {
        analyticsData: [],
        filteredData: [],
        loading: true,
        filters: {
          species: 'all',
          lifeStage: 'all',
          category: 'all'
        },
        stats: {
          total: 0,
          dogs: 0,
          cats: 0,
          clinicPitches: 0
        },
        knowledgeLevels: {
          high: 0,
          medium: 0,
          low: 0
        },
        activeInsightTab: 'commonQuestions'
      };
    },
    
    mounted() {
      this.setupEventListeners();
      this.initializeCharts();
      this.fetchAnalyticsData();
    },
    
    methods: {
      setupEventListeners() {
        const filterSelects = [
          document.getElementById('filterSpecies'),
          document.getElementById('filterLifeStage'),
          document.getElementById('filterCategory')
        ];
        
        filterSelects.forEach(select => {
          if (select) {
            select.addEventListener('change', () => {
              this.filters = {
                species: document.getElementById('filterSpecies').value,
                lifeStage: document.getElementById('filterLifeStage').value,
                category: document.getElementById('filterCategory').value
              };
              this.applyFilters();
            });
          }
        });
        
        const analyticsFileInput = document.getElementById('analyticsFileInput');
        const analyticsDropArea = document.getElementById('analyticsDropArea');
        
        if (analyticsFileInput) {
          analyticsFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
              this.handleMultipleFileUpload(e.target.files);
            }
          });
        }
        
        if (analyticsDropArea) {
          this.setupDropArea(analyticsDropArea);
        }
        
        const insightTabs = document.querySelectorAll('.insight-tab');
        insightTabs.forEach(tab => {
          tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            this.activeInsightTab = tabName;
            
            insightTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const panels = document.querySelectorAll('.insight-panel');
            panels.forEach(panel => {
              if (panel.id === tabName) {
                panel.classList.add('active');
              } else {
                panel.classList.remove('active');
              }
            });
          });
        });
      },
      
      setupDropArea(dropArea) {
        dropArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropArea.style.borderColor = 'var(--primary)';
          dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
        });
        
        dropArea.addEventListener('dragleave', (e) => {
          e.preventDefault();
          dropArea.style.borderColor = 'var(--primary-light)';
          dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
        });
        
        dropArea.addEventListener('drop', (e) => {
          e.preventDefault();
          dropArea.style.borderColor = 'var(--primary-light)';
          dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.handleMultipleFileUpload(e.dataTransfer.files);
          }
        });
      },
      
      initializeCharts() {
        this.initKeyQuestionsChart();
      },
      
      initKeyQuestionsChart() {
        const ctx = document.getElementById('keyQuestionsChart');
        if (!ctx) return;
        
        questionChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Vet Questions', 'Diet Questions', 'Behavior Questions', 'Health Questions', 'Grooming Questions'],
            datasets: [{
              label: 'Frequency',
              data: [0, 0, 0, 0, 0],
              backgroundColor: [
                'rgba(140, 82, 255, 0.7)',
                'rgba(64, 185, 255, 0.7)',
                'rgba(76, 175, 80, 0.7)',
                'rgba(255, 193, 7, 0.7)',
                'rgba(244, 67, 54, 0.7)'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: 'rgba(20, 20, 30, 0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                  color: 'rgba(255, 255, 255, 0.7)'
                }
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  color: 'rgba(255, 255, 255, 0.7)'
                }
              }
            }
          }
        });
      },
      
      fetchAnalyticsData() {
        this.loading = true;
        
        if (!db) {
          console.error("Firebase database not initialized");
          this.loading = false;
          return;
        }
        
        const transcriptsRef = db.ref('transcripts');
        transcriptsRef.on('value', (snapshot) => {
          const data = snapshot.val();
          
          if (data) {
            this.analyticsData = Object.values(data);
            this.filteredData = [...this.analyticsData];
            this.updateAnalytics();
          } else {
            this.analyticsData = [];
            this.filteredData = [];
          }
          
          this.loading = false;
        });
      },
      
      handleMultipleFileUpload(files) {
        const fileList = document.getElementById('analyticsFileList');
        if (!fileList) return;
        
        fileList.innerHTML = '';
        
        let pendingFiles = files.length;
        const analyticsFeedback = document.getElementById('analyticsFeedback');
        
        if (analyticsFeedback) {
          analyticsFeedback.textContent = `Processing ${pendingFiles} files...`;
          analyticsFeedback.className = 'file-feedback info';
          analyticsFeedback.style.display = 'block';
        }
        
        Array.from(files).forEach(file => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          
          const fileItemName = document.createElement('div');
          fileItemName.className = 'file-item-name';
          
          const icon = document.createElement('i');
          icon.className = file.name.endsWith('.mp3') ? 'fas fa-music' : 'fas fa-file-alt';
          fileItemName.appendChild(icon);
          
          const fileName = document.createElement('span');
          fileName.textContent = file.name;
          fileItemName.appendChild(fileName);
          
          const statusSpan = document.createElement('span');
          statusSpan.className = 'file-item-status';
          statusSpan.textContent = 'Waiting...';
          
          fileItem.appendChild(fileItemName);
          fileItem.appendChild(statusSpan);
          fileList.appendChild(fileItem);
          
          const processDone = () => {
            pendingFiles--;
            if (pendingFiles === 0) {
              if (analyticsFeedback) {
                analyticsFeedback.textContent = `All files processed successfully!`;
                analyticsFeedback.className = 'file-feedback success';
              }
            }
          };
          
          if (file.name.endsWith('.mp3')) {
            this.processAudioFileForAnalytics(file, fileItem, processDone);
          } else {
            this.processTextFileForAnalytics(file, fileItem, processDone);
          }
        });
      },
      
      processAudioFileForAnalytics(file, fileItem, callback) {
        const statusSpan = fileItem.querySelector('.file-item-status');
        statusSpan.textContent = 'Transcribing audio...';
        
        const formData = new FormData();
        formData.append('file', file);
        
        const languageSelect = document.getElementById('languageSelect');
        const languageValue = languageSelect ? languageSelect.value : 'auto';
        formData.append('language', languageValue);
        
        fetch("https://supertails.vercel.app/api/transcribe", {
          method: 'POST',
          body: formData
        })
          .then(response => {
            if (!response.ok) {
              throw new Error("Transcription API returned an error");
            }
            return response.text();
          })
          .then(transcriptText => {
            statusSpan.textContent = 'Analyzing transcript...';
            this.analyzeTranscriptForAnalytics(transcriptText, file.name, fileItem, callback);
          })
          .catch(error => {
            statusSpan.textContent = 'Error';
            statusSpan.style.color = 'var(--danger)';
            callback();
          });
      },
      
      processTextFileForAnalytics(file, fileItem, callback) {
        const statusSpan = fileItem.querySelector('.file-item-status');
        statusSpan.textContent = 'Reading file...';
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const content = e.target.result;
          statusSpan.textContent = 'Analyzing transcript...';
          this.analyzeTranscriptForAnalytics(content, file.name, fileItem, callback);
        };
        
        reader.onerror = () => {
          statusSpan.textContent = 'Error';
          statusSpan.style.color = 'var(--danger)';
          callback();
        };
        
        reader.readAsText(file);
      },
      
      analyzeTranscriptForAnalytics(transcriptText, fileName, fileItem, callback) {
        const statusSpan = fileItem.querySelector('.file-item-status');
        
        // Simple transcript analysis
        const petType = this.detectPetType(transcriptText);
        const petName = this.extractPetName(transcriptText);
        const lifeStage = this.detectLifeStage(transcriptText);
        const knowledgeLevel = this.assessKnowledgeLevel(transcriptText);
        const keyIssues = this.extractKeyIssues(transcriptText);
        const customerCategory = this.detectCustomerCategory(transcriptText);
        const clinicPitched = this.detectClinicPitch(transcriptText);
        
        const transcriptData = {
          text: transcriptText,
          petType,
          petName,
          lifeStage,
          knowledgeLevel,
          keyIssues,
          customerCategory,
          clinicPitched,
          fileName,
          timestamp: new Date().toISOString()
        };
        
        statusSpan.textContent = 'Saving...';
        
        if (db) {
          const transcriptsRef = db.ref('transcripts');
          const newTranscriptRef = transcriptsRef.push();
          
          newTranscriptRef.set(transcriptData)
            .then(() => {
              statusSpan.textContent = 'Completed';
              statusSpan.style.color = 'var(--success)';
              callback();
            })
            .catch(error => {
              statusSpan.textContent = 'Error';
              statusSpan.style.color = 'var(--danger)';
              callback();
            });
        } else {
          statusSpan.textContent = 'No database';
          statusSpan.style.color = 'var(--warning)';
          callback();
        }
      },
      
      applyFilters() {
        if (!this.analyticsData) return;
        
        this.filteredData = this.analyticsData.filter(item => {
          const speciesMatch = this.filters.species === 'all' || item.petType === this.filters.species;
          const lifeStageMatch = this.filters.lifeStage === 'all' || item.lifeStage === this.filters.lifeStage;
          const categoryMatch = this.filters.category === 'all' || item.customerCategory === this.filters.category;
          
          return speciesMatch && lifeStageMatch && categoryMatch;
        });
        
        this.updateAnalytics();
      },
      
      updateAnalytics() {
        if (!this.filteredData || this.filteredData.length === 0) return;
        
        this.updateBasicStats();
        this.updateKnowledgeChart();
        this.updateQuestionsChart();
        this.updateTranscriptsTable();
        this.updateInsights();
      },
      
      updateBasicStats() {
        const dogCount = this.filteredData.filter(item => item.petType === 'dog' || item.petType === 'both').length;
        const catCount = this.filteredData.filter(item => item.petType === 'cat' || item.petType === 'both').length;
        const pitchCount = this.filteredData.filter(item => item.clinicPitched).length;
        
        const totalTranscripts = document.getElementById('totalTranscripts');
        const dogOwners = document.getElementById('dogOwners');
        const catOwners = document.getElementById('catOwners');
        const clinicPitches = document.getElementById('clinicPitches');
        
        if (totalTranscripts) totalTranscripts.textContent = this.filteredData.length;
        if (dogOwners) dogOwners.textContent = dogCount;
        if (catOwners) catOwners.textContent = catCount;
        if (clinicPitches) clinicPitches.textContent = pitchCount;
        
        this.stats = {
          total: this.filteredData.length,
          dogs: dogCount,
          cats: catCount,
          clinicPitches: pitchCount
        };
      },
      
      updateKnowledgeChart() {
        const highKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'high').length;
        const mediumKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'medium').length;
        const lowKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'low').length;
        
        const total = this.filteredData.length;
        
        const highPercent = total > 0 ? Math.round((highKnowledge / total) * 100) : 0;
        const mediumPercent = total > 0 ? Math.round((mediumKnowledge / total) * 100) : 0;
        const lowPercent = total > 0 ? Math.round((lowKnowledge / total) * 100) : 0;
        
        const highBar = document.getElementById('highKnowledgeBar');
        const mediumBar = document.getElementById('mediumKnowledgeBar');
        const lowBar = document.getElementById('lowKnowledgeBar');
        
        const highValue = document.getElementById('highKnowledgeValue');
        const mediumValue = document.getElementById('mediumKnowledgeValue');
        const lowValue = document.getElementById('lowKnowledgeValue');
        
        if (highBar) highBar.style.width = `${highPercent}%`;
        if (mediumBar) mediumBar.style.width = `${mediumPercent}%`;
        if (lowBar) lowBar.style.width = `${lowPercent}%`;
        
        if (highValue) highValue.textContent = `${highPercent}%`;
        if (mediumValue) mediumValue.textContent = `${mediumPercent}%`;
        if (lowValue) lowValue.textContent = `${lowPercent}%`;
        
        this.knowledgeLevels = {
          high: highPercent,
          medium: mediumPercent,
          low: lowPercent
        };
      },
      
      updateQuestionsChart() {
        if (!questionChart) return;
        
        // Calculate question types
        const questionTypes = {
          vet: 0,
          diet: 0,
          behavior: 0,
          health: 0,
          grooming: 0
        };
        
        this.filteredData.forEach(item => {
          const text = item.text.toLowerCase();
          
          if (text.includes('vet') || text.includes('doctor') || text.includes('clinic')) {
            questionTypes.vet++;
          }
          
          if (text.includes('food') || text.includes('eat') || text.includes('diet') || text.includes('feeding')) {
            questionTypes.diet++;
          }
          
          if (text.includes('behavior') || text.includes('training') || text.includes('anxious') || text.includes('aggressive')) {
            questionTypes.behavior++;
          }
          
          if (text.includes('sick') || text.includes('health') || text.includes('pain') || text.includes('hurt')) {
            questionTypes.health++;
          }
          
          if (text.includes('groom') || text.includes('bath') || text.includes('fur') || text.includes('hair')) {
            questionTypes.grooming++;
          }
        });
        
        questionChart.data.datasets[0].data = [
          questionTypes.vet,
          questionTypes.diet,
          questionTypes.behavior,
          questionTypes.health,
          questionTypes.grooming
        ];
        
        questionChart.update();
      },
      
      updateTranscriptsTable() {
        const tableBody = document.getElementById('petsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (this.filteredData.length === 0) {
          const emptyRow = document.createElement('tr');
          const emptyCell = document.createElement('td');
          emptyCell.className = 'empty-table';
          emptyCell.colSpan = 8;
          emptyCell.textContent = 'No transcripts available';
          emptyRow.appendChild(emptyCell);
          tableBody.appendChild(emptyRow);
          return;
        }
        
        // Sort by timestamp descending
        const sortedData = [...this.filteredData].sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        sortedData.forEach(item => {
          const row = document.createElement('tr');
          
          const petParentCell = document.createElement('td');
          petParentCell.textContent = 'Pet Parent'; // Placeholder since we don't have this info
          
          const petTypeCell = document.createElement('td');
          petTypeCell.textContent = item.petType.charAt(0).toUpperCase() + item.petType.slice(1);
          
          const petNameCell = document.createElement('td');
          petNameCell.textContent = item.petName;
          
          const lifeStageCell = document.createElement('td');
          lifeStageCell.textContent = item.lifeStage.charAt(0).toUpperCase() + item.lifeStage.slice(1);
          
          const knowledgeLevelCell = document.createElement('td');
          knowledgeLevelCell.textContent = item.knowledgeLevel.charAt(0).toUpperCase() + item.knowledgeLevel.slice(1);
          knowledgeLevelCell.className = `knowledge-${item.knowledgeLevel}`;
          
          const keyIssuesCell = document.createElement('td');
          keyIssuesCell.textContent = item.keyIssues;
          
          const categoryCell = document.createElement('td');
          categoryCell.textContent = item.customerCategory.charAt(0).toUpperCase() + item.customerCategory.slice(1);
          
          const clinicPitchedCell = document.createElement('td');
          clinicPitchedCell.textContent = item.clinicPitched ? 'Yes' : 'No';
          
          row.appendChild(petParentCell);
          row.appendChild(petTypeCell);
          row.appendChild(petNameCell);
          row.appendChild(lifeStageCell);
          row.appendChild(knowledgeLevelCell);
          row.appendChild(keyIssuesCell);
          row.appendChild(categoryCell);
          row.appendChild(clinicPitchedCell);
          
          tableBody.appendChild(row);
        });
      },
      
      updateInsights() {
        if (this.filteredData.length === 0) return;
        
        this.updateCommonQuestionsInsight();
        this.updateCustomerDifferencesInsight();
        this.updateExcitementFactorsInsight();
        this.updateEffectivePitchesInsight();
        this.updateLifeStageInsightsInsight();
        this.updateClinicOpportunitiesInsight();
      },
      
      updateCommonQuestionsInsight() {
        const commonQuestionsDiv = document.getElementById('commonQuestionsContent');
        if (!commonQuestionsDiv) return;
        
        const questionPatterns = [
          {pattern: /how (often|much|long) should I feed/i, category: 'Feeding Frequency'},
          {pattern: /what (food|brand) (is best|should I)/i, category: 'Food Recommendations'},
          {pattern: /is it normal for my pet to/i, category: 'Normal Behavior'},
          {pattern: /how do I (train|stop|get) my pet to/i, category: 'Training'},
          {pattern: /what (are|is) the symptoms of/i, category: 'Health Symptoms'},
          {pattern: /how (often|much) should I/i, category: 'General Care Frequency'},
          {pattern: /when should I take my pet to the vet/i, category: 'Vet Visits'},
          {pattern: /is (it safe|this dangerous|this toxic)/i, category: 'Safety Concerns'}
        ];
        
        const questionCounts = {};
        
        this.filteredData.forEach(item => {
          const text = item.text;
          
          questionPatterns.forEach(pattern => {
            if (pattern.pattern.test(text)) {
              questionCounts[pattern.category] = (questionCounts[pattern.category] || 0) + 1;
            }
          });
        });
        
        // Sort by frequency
        const sortedQuestions = Object.entries(questionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);
        
        let content = '';
        
        if (sortedQuestions.length > 0) {
          content += '<ol>';
          sortedQuestions.forEach(([category, count]) => {
            content += `<li><strong>${category}</strong>: Asked in ${count} transcripts</li>`;
          });
          content += '</ol>';
        } else {
          content = '<p>Not enough data to analyze common questions.</p>';
        }
        
        commonQuestionsDiv.innerHTML = content;
      },
      
      updateCustomerDifferencesInsight() {
        const customerDifferencesDiv = document.getElementById('customerDifferencesContent');
        if (!customerDifferencesDiv) return;
        
        const foodCustomers = this.filteredData.filter(item => item.customerCategory === 'food');
        const pharmacyCustomers = this.filteredData.filter(item => item.customerCategory === 'pharmacy');
        
        if (foodCustomers.length === 0 || pharmacyCustomers.length === 0) {
          customerDifferencesDiv.innerHTML = '<p>Not enough data to compare food and pharmacy customers.</p>';
          return;
        }
        
        const foodHighKnowledge = foodCustomers.filter(item => item.knowledgeLevel === 'high').length / foodCustomers.length;
        const pharmacyHighKnowledge = pharmacyCustomers.filter(item => item.knowledgeLevel === 'high').length / pharmacyCustomers.length;
        
        const foodClinicPitched = foodCustomers.filter(item => item.clinicPitched).length / foodCustomers.length;
        const pharmacyClinicPitched = pharmacyCustomers.filter(item => item.clinicPitched).length / pharmacyCustomers.length;
        
        let content = `
          <div class="comparison-container">
            <div class="comparison-item">
              <h5>Knowledge Levels</h5>
              <p>Food Customers: ${Math.round(foodHighKnowledge * 100)}% high knowledge</p>
              <p>Pharmacy Customers: ${Math.round(pharmacyHighKnowledge * 100)}% high knowledge</p>
            </div>
            <div class="comparison-item">
              <h5>Clinic Pitches</h5>
              <p>Food Customers: ${Math.round(foodClinicPitched * 100)}% received clinic pitch</p>
              <p>Pharmacy Customers: ${Math.round(pharmacyClinicPitched * 100)}% received clinic pitch</p>
            </div>
          </div>
        `;
        
        customerDifferencesDiv.innerHTML = content;
      },
      
      updateExcitementFactorsInsight() {
        const excitementDiv = document.getElementById('excitementFactorsContent');
        if (!excitementDiv) return;
        
        const excitementKeywords = {
          'Treats & Rewards': ['treat', 'reward', 'chew', 'bone', 'snack'],
          'New Products': ['new', 'launch', 'try', 'recommend', 'product'],
          'Health Improvements': ['better', 'improve', 'recovery', 'healthy', 'solved'],
          'Convenient Services': ['delivery', 'service', 'convenient', 'easy', 'quick'],
          'Cost Savings': ['offer', 'discount', 'sale', 'deal', 'promotion', 'save'],
          'Expert Advice': ['expert', 'professional', 'vet said', 'recommend', 'advise']
        };
        
        const excitementScores = {};
        
        this.filteredData.forEach(item => {
          const text = item.text.toLowerCase();
          
          for (const [category, keywords] of Object.entries(excitementKeywords)) {
            const score = keywords.reduce((total, keyword) => {
              const matches = (text.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
              return total + matches;
            }, 0);
            
            excitementScores[category] = (excitementScores[category] || 0) + score;
          }
        });
        
        const sortedScores = Object.entries(excitementScores)
          .sort((a, b) => b[1] - a[1]);
        
        let content = '<p>Pet parents show most excitement about:</p><ol>';
        
        sortedScores.slice(0, 3).forEach(([category, score]) => {
          content += `<li><strong>${category}</strong> (${score} mentions)</li>`;
        });
        
        content += '</ol>';
        excitementDiv.innerHTML = content;
      },
      
      updateEffectivePitchesInsight() {
        const pitchesDiv = document.getElementById('effectivePitchesContent');
        if (!pitchesDiv) return;
        
        const dogPuppy = this.filteredData.filter(item => item.petType === 'dog' && item.lifeStage === 'puppy');
        const dogAdult = this.filteredData.filter(item => item.petType === 'dog' && item.lifeStage === 'adult');
        const dogSenior = this.filteredData.filter(item => item.petType === 'dog' && item.lifeStage === 'senior');
        
        const catPuppy = this.filteredData.filter(item => item.petType === 'cat' && item.lifeStage === 'puppy');
        const catAdult = this.filteredData.filter(item => item.petType === 'cat' && item.lifeStage === 'adult');
        const catSenior = this.filteredData.filter(item => item.petType === 'cat' && item.lifeStage === 'senior');
        
        let content = '<div class="pitch-container">';
        
        // Dog pitches
        content += '<div class="pitch-section"><h5>Effective Dog Pitches</h5>';
        content += '<ul>';
        
        if (dogPuppy.length > 0) {
          content += '<li><strong>Puppies</strong>: Preventative care, vaccination packages, and training classes</li>';
        }
        
        if (dogAdult.length > 0) {
          content += '<li><strong>Adult Dogs</strong>: Dental care, regular check-ups, and weight management</li>';
        }
        
        if (dogSenior.length > 0) {
          content += '<li><strong>Senior Dogs</strong>: Joint supplements, senior wellness exams, and prescription diets</li>';
        }
        
        content += '</ul></div>';
        
        // Cat pitches
        content += '<div class="pitch-section"><h5>Effective Cat Pitches</h5>';
        content += '<ul>';
        
        if (catPuppy.length > 0) {
          content += '<li><strong>Kittens</strong>: Spay/neuter services, kitten nutrition, and vaccination packages</li>';
        }
        
        if (catAdult.length > 0) {
          content += '<li><strong>Adult Cats</strong>: Dental care, indoor enrichment, and grooming services</li>';
        }
        
        if (catSenior.length > 0) {
          content += '<li><strong>Senior Cats</strong>: Kidney health monitoring, thyroid testing, and comfortable bedding</li>';
        }
        
        content += '</ul></div>';
        content += '</div>';
        
        pitchesDiv.innerHTML = content;
      },
      
      updateLifeStageInsightsInsight() {
        const lifeStageDiv = document.getElementById('lifeStageInsightsContent');
        if (!lifeStageDiv) return;
        
        const puppyData = this.filteredData.filter(item => item.lifeStage === 'puppy');
        const adultData = this.filteredData.filter(item => item.lifeStage === 'adult');
        const seniorData = this.filteredData.filter(item => item.lifeStage === 'senior');
        
        let puppyIssues = {};
        let adultIssues = {};
        let seniorIssues = {};
        
        const issueKeywords = {
          'Nutrition': ['feed', 'food', 'diet', 'eat', 'nutrition'],
          'Training': ['train', 'behavior', 'obedience', 'command', 'learn'],
          'Grooming': ['groom', 'brush', 'bath', 'nail', 'fur', 'coat'],
          'Health': ['health', 'vet', 'vaccine', 'sick', 'pain', 'medication'],
          'Dental': ['teeth', 'dental', 'chew', 'mouth', 'gum'],
          'Mobility': ['joint', 'walk', 'exercise', 'run', 'move', 'mobility'],
          'Social': ['play', 'friend', 'social', 'other pets', 'interaction']
        };
        
        puppyData.forEach(item => {
          const text = item.text.toLowerCase();
          
          for (const [issue, keywords] of Object.entries(issueKeywords)) {
            for (const keyword of keywords) {
              if (text.includes(keyword)) {
                puppyIssues[issue] = (puppyIssues[issue] || 0) + 1;
                break;
              }
            }
          }
        });
        
        adultData.forEach(item => {
          const text = item.text.toLowerCase();
          
          for (const [issue, keywords] of Object.entries(issueKeywords)) {
            for (const keyword of keywords) {
              if (text.includes(keyword)) {
                adultIssues[issue] = (adultIssues[issue] || 0) + 1;
                break;
              }
            }
          }
        });
        
        seniorData.forEach(item => {
          const text = item.text.toLowerCase();
          
          for (const [issue, keywords] of Object.entries(issueKeywords)) {
            for (const keyword of keywords) {
              if (text.includes(keyword)) {
                seniorIssues[issue] = (seniorIssues[issue] || 0) + 1;
                break;
              }
            }
          }
        });
        
        const getTopIssues = (issues) => {
          return Object.entries(issues)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([issue]) => issue)
            .join(', ');
        };
        
        let content = '<div class="life-stage-container">';
        
        if (puppyData.length > 0) {
          content += `
            <div class="life-stage-item">
              <h5>Puppy/Kitten Stage</h5>
              <p><strong>Top concerns:</strong> ${getTopIssues(puppyIssues) || 'Not enough data'}</p>
              <p><strong>Knowledge level:</strong> ${this.calculateKnowledgePercentage(puppyData, 'low')}% low knowledge</p>
            </div>
          `;
        }
        
        if (adultData.length > 0) {
          content += `
            <div class="life-stage-item">
              <h5>Adult Stage</h5>
              <p><strong>Top concerns:</strong> ${getTopIssues(adultIssues) || 'Not enough data'}</p>
              <p><strong>Knowledge level:</strong> ${this.calculateKnowledgePercentage(adultData, 'medium')}% medium knowledge</p>
            </div>
          `;
        }
        
        if (seniorData.length > 0) {
          content += `
            <div class="life-stage-item">
              <h5>Senior Stage</h5>
              <p><strong>Top concerns:</strong> ${getTopIssues(seniorIssues) || 'Not enough data'}</p>
              <p><strong>Knowledge level:</strong> ${this.calculateKnowledgePercentage(seniorData, 'high')}% high knowledge</p>
            </div>
          `;
        }
        
        content += '</div>';
        lifeStageDiv.innerHTML = content;
      },
      
      calculateKnowledgePercentage(data, level) {
        if (data.length === 0) return 0;
        return Math.round((data.filter(item => item.knowledgeLevel === level).length / data.length) * 100);
      },
      
      updateClinicOpportunitiesInsight() {
        const clinicDiv = document.getElementById('clinicOpportunitiesContent');
        if (!clinicDiv) return;
        
        const clinicPitches = this.filteredData.filter(item => item.clinicPitched);
        const missedOpportunities = this.filteredData.filter(item => !item.clinicPitched);
        
        const totalTranscripts = this.filteredData.length;
        const pitchPercentage = Math.round((clinicPitches.length / totalTranscripts) * 100);
        const missedPercentage = Math.round((missedOpportunities.length / totalTranscripts) * 100);
        
        // Calculate potential opportunities
        const healthIssues = this.filteredData.filter(item => item.keyIssues.includes('health') && !item.clinicPitched);
        const seniorPets = this.filteredData.filter(item => item.lifeStage === 'senior' && !item.clinicPitched);
        const lowKnowledge = this.filteredData.filter(item => item.knowledgeLevel === 'low' && !item.clinicPitched);
        
        const potentialOpportunities = new Set([
          ...healthIssues,
          ...seniorPets,
          ...lowKnowledge
        ]);
        
        let content = `
          <div class="clinic-stats">
            <div class="clinic-stat">
              <span class="stat-number">${pitchPercentage}%</span>
              <span class="stat-label">Received clinic pitch</span>
            </div>
            <div class="clinic-stat">
              <span class="stat-number">${missedPercentage}%</span>
              <span class="stat-label">No clinic pitch</span>
            </div>
            <div class="clinic-stat">
              <span class="stat-number">${potentialOpportunities.size}</span>
              <span class="stat-label">Potential opportunities</span>
            </div>
          </div>
          
          <h5>Key Opportunities</h5>
          <ul>
            <li><strong>${healthIssues.length} transcripts</strong> mention health issues but have no clinic pitch</li>
            <li><strong>${seniorPets.length} senior pets</strong> that could benefit from specialized clinic services</li>
            <li><strong>${lowKnowledge.length} pet parents</strong> with low knowledge who need professional guidance</li>
          </ul>
        `;
        
        clinicDiv.innerHTML = content;
      },
      
      detectPetType(text) {
        const dogKeywords = ['dog', 'puppy', 'canine', 'doggie', 'pooch'];
        const catKeywords = ['cat', 'kitten', 'feline', 'kitty'];
        
        const dogCount = dogKeywords.reduce((count, keyword) => {
          return count + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        }, 0);
        
        const catCount = catKeywords.reduce((count, keyword) => {
          return count + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        }, 0);
        
        if (dogCount > catCount) {
          return 'dog';
        } else if (catCount > dogCount) {
          return 'cat';
        } else if (dogCount > 0 || catCount > 0) {
          return 'both';
        }
        
        return 'unknown';
      },
      
      extractPetName(text) {
        const namePatterns = [
          /my (dog|cat|pet)(?:'s| is| named)? (\w+)/i,
          /(\w+) is my (dog|cat|pet)/i,
          /I have a (dog|cat|pet) named (\w+)/i
        ];
        
        for (const pattern of namePatterns) {
          const match = text.match(pattern);
          if (match) {
            if (match[1].toLowerCase() === 'dog' || match[1].toLowerCase() === 'cat' || match[1].toLowerCase() === 'pet') {
              return match[2];
            } else {
              return match[1];
            }
          }
        }
        
        return 'Unknown';
      },
      
      detectLifeStage(text) {
        const puppyKittenKeywords = ['puppy', 'kitten', 'young', 'baby', 'newborn', 'month old', 'weeks old'];
        const adultKeywords = ['adult', 'year old', 'mature'];
        const seniorKeywords = ['senior', 'older', 'elderly', 'aging', 'geriatric', 'old dog', 'old cat'];
        
        const isPuppyKitten = puppyKittenKeywords.some(keyword => text.toLowerCase().includes(keyword));
        const isSenior = seniorKeywords.some(keyword => text.toLowerCase().includes(keyword));
        const isAdult = adultKeywords.some(keyword => text.toLowerCase().includes(keyword));
        
        if (isPuppyKitten) return 'puppy';
        if (isSenior) return 'senior';
        if (isAdult) return 'adult';
        
        return 'unknown';
      },
      
      assessKnowledgeLevel(text) {
        const lowKnowledgePatterns = [
          /I don't know/i,
          /not sure/i,
          /confused about/i,
          /what should I/i,
          /is it okay to/i,
          /first-time/i,
          /never had a/i,
          /how do I/i
        ];
        
        const highKnowledgePatterns = [
          /I've researched/i,
          /I read that/i,
          /according to/i,
          /I understand that/i,
          /I know that/i,
          /I've been feeding/i,
          /I've been giving/i,
          /the vet recommended/i,
          /I've had pets for/i
        ];
        
        const lowMatches = lowKnowledgePatterns.filter(pattern => pattern.test(text)).length;
        const highMatches = highKnowledgePatterns.filter(pattern => pattern.test(text)).length;
        
        const score = highMatches - lowMatches;
        
        if (score >= 2) return 'high';
        if (score <= -2) return 'low';
        return 'medium';
      },
      
      extractKeyIssues(text) {
        const issueCategories = {
          diet: ['food', 'feed', 'diet', 'eating', 'nutrition', 'meal', 'appetite'],
          health: ['sick', 'pain', 'hurt', 'vet', 'medicine', 'symptoms', 'treatment', 'disease', 'condition'],
          behavior: ['behavior', 'training', 'aggressive', 'anxiety', 'scared', 'barking', 'biting', 'chewing'],
          grooming: ['groom', 'bath', 'fur', 'hair', 'brush', 'nail', 'coat', 'shedding']
        };
        
        const issues = [];
        
        for (const [category, keywords] of Object.entries(issueCategories)) {
          for (const keyword of keywords) {
            if (text.toLowerCase().includes(keyword)) {
              issues.push(category);
              break;
            }
          }
        }
        
        return issues.length > 0 ? issues.join(', ') : 'general';
      },
      
      detectCustomerCategory(text) {
        const foodKeywords = ['food', 'diet', 'feeding', 'nutrition', 'meal', 'kibble', 'wet food', 'dry food', 'treats'];
        const pharmacyKeywords = ['medicine', 'medication', 'prescription', 'tablets', 'pills', 'treatment', 'therapy'];
        
        const foodScore = foodKeywords.reduce((score, keyword) => {
          return score + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        }, 0);
        
        const pharmacyScore = pharmacyKeywords.reduce((score, keyword) => {
          return score + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        }, 0);
        
        if (foodScore > pharmacyScore) return 'food';
        if (pharmacyScore > foodScore) return 'pharmacy';
        return 'both';
      },
      
      detectClinicPitch(text) {
        const clinicKeywords = [
          'vet visit', 'veterinary clinic', 'check-up', 'examination', 
          'schedule an appointment', 'visit the vet', 'bring in your pet',
          'veterinary care', 'clinic', 'veterinarian'
        ];
        
        return clinicKeywords.some(keyword => text.toLowerCase().includes(keyword));
      }
    }
  });
  
  analyticsApp.mount('#analytics-view');
}

function updateAnalytics() {
  if (analyticsApp) {
    analyticsApp.updateAnalytics();
  }
}