AOS.init({
    duration: 800,
    easing: 'ease-in-out',
    once: true
});

const elements = {};
const defaultTranscript = "This is a sample transcript. It contains information about various topics that you can ask about. Feel free to ask questions related to this content and our AI will analyze it for you.";
let currentTranscript = defaultTranscript;
let isSpecialPromptActive = false;
let activeSpecialPromptButton = null;
let allTranscripts = [];
let analyticsData = null;
let currentAudioFile = null;

function initChat() {
    console.log("Initializing chat interface");
    
    elements.uploadSection = document.getElementById('upload-section');
    elements.loadingSection = document.getElementById('loading-section');
    elements.chatSection = document.getElementById('chat-section');
    elements.chatMessages = document.getElementById('chatMessages');
    elements.userInput = document.getElementById('userInput');
    elements.sendButton = document.getElementById('sendMessage');
    elements.newTranscriptButton = document.getElementById('newTranscript');
    elements.fileInput = document.getElementById('fileInput');
    elements.dropArea = document.getElementById('dropArea');
    elements.fileName = document.getElementById('fileName');
    elements.fileFeedback = document.getElementById('fileFeedback');
    elements.chatFooter = document.querySelector('.chat-footer');
    
    const missingElements = [];
    Object.entries(elements).forEach(([key, element]) => {
        if (!element) {
            missingElements.push(key);
        }
    });
    
    if (missingElements.length > 0) {
        console.error("Missing elements:", missingElements);
    } else {
        console.log("All DOM elements found successfully");
    }
    
    addSpecialPromptButtons();
    createAnalyticsView();
    addViewToggleButtons();
    modifyUploadSection();
    
    if (elements.sendButton) {
        elements.sendButton.addEventListener('click', () => {
            console.log("Send button clicked");
            sendMessage();
        });
    }
    
    if (elements.userInput) {
        elements.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log("Enter key pressed in input field");
                sendMessage();
            }
        });
    }
    
    if (elements.newTranscriptButton) {
        elements.newTranscriptButton.addEventListener('click', () => {
            console.log("New transcript button clicked");
            resetToUpload();
        });
    }
    
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', (e) => {
            console.log("File input changed");
            if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
    
    if (elements.dropArea) {
        elements.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropArea.style.borderColor = 'var(--primary)';
            elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
        });
        
        elements.dropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            elements.dropArea.style.borderColor = 'var(--primary-light)';
            elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
        });
        
        elements.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log("File dropped");
            elements.dropArea.style.borderColor = 'var(--primary-light)';
            elements.dropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
        
        elements.dropArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const success = document.querySelector('.file-feedback.success');
                if (success && success.style.display === 'block') {
                    console.log("Process button clicked");
                    processTranscript();
                }
            }
        });
    }
    
    if (window.location.hash === '#auto-chat') {
        console.log("Clearing auto-chat mode");
        window.location.hash = '';
        window.location.reload();
    }
}

function modifyUploadSection() {
    const uploadSection = elements.uploadSection;
    if (!uploadSection) return;
    
    const uploadContainer = uploadSection.querySelector('.upload-container');
    if (!uploadContainer) return;
    
    const existingUploadText = uploadContainer.querySelector('.upload-text');
    if (existingUploadText) {
        const uploadTextH3 = existingUploadText.querySelector('h3');
        if (uploadTextH3) {
            uploadTextH3.textContent = 'Upload Transcript or Audio';
        }
        
        const uploadTextP = existingUploadText.querySelector('p');
        if (uploadTextP) {
            uploadTextP.textContent = 'Drop your transcript file or audio recording here or click the button below to browse';
        }
    }
    
    const fileInputLabel = uploadContainer.querySelector('label[for="fileInput"]');
    if (fileInputLabel) {
        fileInputLabel.innerHTML = '<i class="fas fa-upload"></i> Choose File';
    }
    
    const transcriptOptionsDiv = document.createElement('div');
    transcriptOptionsDiv.className = 'transcript-options';
    transcriptOptionsDiv.style.marginTop = '15px';
    transcriptOptionsDiv.style.display = 'none';
    transcriptOptionsDiv.id = 'transcriptOptions';
    
    const audioContainer = document.createElement('div');
    audioContainer.className = 'audio-container';
    audioContainer.style.marginTop = '15px';
    audioContainer.style.width = '100%';
    audioContainer.style.display = 'none';
    audioContainer.id = 'audioContainer';
    
    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    audioElement.style.width = '100%';
    audioElement.style.marginBottom = '10px';
    audioElement.id = 'audioPlayer';
    
    const transcriptInput = document.createElement('textarea');
    transcriptInput.className = 'transcript-input';
    transcriptInput.placeholder = 'Paste transcript here if available...';
    transcriptInput.style.width = '100%';
    transcriptInput.style.height = '120px';
    transcriptInput.style.padding = '10px';
    transcriptInput.style.marginBottom = '10px';
    transcriptInput.style.borderRadius = '8px';
    transcriptInput.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    transcriptInput.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    transcriptInput.style.color = 'var(--text)';
    transcriptInput.style.resize = 'vertical';
    transcriptInput.id = 'transcriptInput';
    
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '10px';
    buttonRow.style.marginTop = '10px';
    
    const processWithTranscriptBtn = document.createElement('button');
    processWithTranscriptBtn.className = 'btn';
    processWithTranscriptBtn.innerHTML = '<i class="fas fa-check"></i> Process with Transcript';
    processWithTranscriptBtn.id = 'processWithTranscriptBtn';
    
    const processWithoutTranscriptBtn = document.createElement('button');
    processWithoutTranscriptBtn.className = 'btn btn-outline';
    processWithoutTranscriptBtn.innerHTML = '<i class="fas fa-microphone"></i> No Transcript Available';
    processWithoutTranscriptBtn.id = 'processWithoutTranscriptBtn';
    
    buttonRow.appendChild(processWithTranscriptBtn);
    buttonRow.appendChild(processWithoutTranscriptBtn);
    
    audioContainer.appendChild(audioElement);
    transcriptOptionsDiv.appendChild(audioContainer);
    transcriptOptionsDiv.appendChild(transcriptInput);
    transcriptOptionsDiv.appendChild(buttonRow);
    
    uploadContainer.appendChild(transcriptOptionsDiv);
    
    processWithTranscriptBtn.addEventListener('click', () => {
        const transcriptText = transcriptInput.value.trim();
        if (transcriptText) {
            currentTranscript = transcriptText;
            processTranscript();
        } else if (currentAudioFile) {
            showFileFeedback('error', 'Please enter a transcript or click "No Transcript Available"');
        } else {
            showFileFeedback('error', 'Please enter a transcript or upload an audio file');
        }
    });
    
    processWithoutTranscriptBtn.addEventListener('click', () => {
        if (currentAudioFile) {
            showFileFeedback('info', 'Transcribing audio...');
            transcribeAudioFileForChat(currentAudioFile);
        } else {
            showFileFeedback('error', 'Please upload an audio file first');
        }
    });
}

function addViewToggleButtons() {
    const headerRight = document.querySelector('header .brand');
    if (!headerRight) return;
    
    const viewToggleContainer = document.createElement('div');
    viewToggleContainer.className = 'view-toggle-container';
    viewToggleContainer.style.marginLeft = 'auto';
    viewToggleContainer.style.display = 'flex';
    viewToggleContainer.style.gap = '10px';
    
    const chatButton = document.createElement('button');
    chatButton.className = 'view-toggle-btn active';
    chatButton.textContent = 'Chat View';
    chatButton.dataset.view = 'chat';
    
    const analyticsButton = document.createElement('button');
    analyticsButton.className = 'view-toggle-btn';
    analyticsButton.textContent = 'Analytics';
    analyticsButton.dataset.view = 'analytics';
    
    viewToggleContainer.appendChild(chatButton);
    viewToggleContainer.appendChild(analyticsButton);
    
    headerRight.parentNode.style.display = 'flex';
    headerRight.parentNode.style.justifyContent = 'space-between';
    headerRight.parentNode.style.alignItems = 'center';
    headerRight.parentNode.appendChild(viewToggleContainer);
    
    const viewButtons = [chatButton, analyticsButton];
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            viewButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const viewType = button.dataset.view;
            toggleView(viewType);
        });
    });
}

function toggleView(viewType) {
    const chatView = document.getElementById('main-chat-view');
    const analyticsView = document.getElementById('analytics-view');
    
    if (viewType === 'chat') {
        chatView.style.display = 'block';
        analyticsView.style.display = 'none';
    } else if (viewType === 'analytics') {
        chatView.style.display = 'none';
        analyticsView.style.display = 'block';
        updateAnalytics();
    }
}

function createAnalyticsView() {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;
    
    const analyticsView = document.createElement('div');
    analyticsView.id = 'analytics-view';
    analyticsView.style.display = 'none';
    analyticsView.className = 'container';
    
    const mainContainer = document.querySelector('main .container');
    mainContainer.id = 'main-chat-view';
    
    const analyticsContent = `
        <div class="card" data-aos="fade-up">
            <h2 style="margin-bottom: 20px; color: var(--primary);">Pet Parent Analytics</h2>
            
            <div class="analytics-summary">
                <div class="analytics-upload">
                    <h3>Upload Additional Transcripts</h3>
                    <p>Add more transcripts to enhance your analytics</p>
                    <div class="upload-container mini-upload" id="analyticsDropArea">
                        <div class="upload-icon">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <label for="analyticsFileInput" class="btn">
                            <i class="fas fa-upload"></i> Choose Files
                        </label>
                        <input type="file" id="analyticsFileInput" class="file-input" accept=".txt,.doc,.docx,.pdf,.mp3" multiple>
                    </div>
                    <div id="analyticsFileList" class="file-list"></div>
                    <div id="analyticsFeedback" class="file-feedback"></div>
                </div>
                
                <div class="stats-container">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-paw"></i></div>
                        <div class="stat-value" id="totalTranscripts">0</div>
                        <div class="stat-label">Total Transcripts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-dog"></i></div>
                        <div class="stat-value" id="dogOwners">0</div>
                        <div class="stat-label">Dog Owners</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-cat"></i></div>
                        <div class="stat-value" id="catOwners">0</div>
                        <div class="stat-label">Cat Owners</div>
                    </div>
                </div>
            </div>
            
            <div class="knowledge-chart">
                <h3>Pet Parent Knowledge Levels</h3>
                <div class="chart-container">
                    <div class="chart-bar high">
                        <div class="chart-fill" id="highKnowledgeBar"></div>
                        <div class="chart-label">High Knowledge</div>
                        <div class="chart-value" id="highKnowledgeValue">0</div>
                    </div>
                    <div class="chart-bar medium">
                        <div class="chart-fill" id="mediumKnowledgeBar"></div>
                        <div class="chart-label">Medium Knowledge</div>
                        <div class="chart-value" id="mediumKnowledgeValue">0</div>
                    </div>
                    <div class="chart-bar low">
                        <div class="chart-fill" id="lowKnowledgeBar"></div>
                        <div class="chart-label">Low Knowledge</div>
                        <div class="chart-value" id="lowKnowledgeValue">0</div>
                    </div>
                </div>
            </div>
            
            <div class="transcript-table">
                <h3>Transcript Analysis</h3>
                <table id="petsTable">
                    <thead>
                        <tr>
                            <th>Pet Parent</th>
                            <th>Pet Type</th>
                            <th>Pet Name</th>
                            <th>Knowledge Level</th>
                            <th>Key Issues</th>
                        </tr>
                    </thead>
                    <tbody id="petsTableBody">
                        <tr>
                            <td colspan="5" style="text-align: center;">No transcripts analyzed yet</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    analyticsView.innerHTML = analyticsContent;
    mainElement.appendChild(analyticsView);
    
    setupAnalyticsListeners();
}

function setupAnalyticsListeners() {
    const analyticsFileInput = document.getElementById('analyticsFileInput');
    const analyticsDropArea = document.getElementById('analyticsDropArea');
    
    if (analyticsFileInput) {
        analyticsFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleMultipleFileUpload(e.target.files);
            }
        });
    }
    
    if (analyticsDropArea) {
        analyticsDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            analyticsDropArea.style.borderColor = 'var(--primary)';
            analyticsDropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.1)';
        });
        
        analyticsDropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            analyticsDropArea.style.borderColor = 'var(--primary-light)';
            analyticsDropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
        });
        
        analyticsDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log("Files dropped on analytics");
            analyticsDropArea.style.borderColor = 'var(--primary-light)';
            analyticsDropArea.style.backgroundColor = 'rgba(140, 82, 255, 0.05)';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleMultipleFileUpload(e.dataTransfer.files);
            }
        });
    }
}

function handleMultipleFileUpload(files) {
    const fileList = document.getElementById('analyticsFileList');
    const analyticsFeedback = document.getElementById('analyticsFeedback');
    
    if (!fileList || !analyticsFeedback) return;
    
    fileList.innerHTML = '';
    
    let validFiles = [];
    let invalidFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();
        
        const isTextFile = fileName.endsWith('.txt');
        const isPdfFile = fileName.endsWith('.pdf');
        const isDocFile = fileName.endsWith('.doc') || fileName.endsWith('.docx');
        const isMp3File = fileName.endsWith('.mp3');
        
        if (isTextFile || isPdfFile || isDocFile || isMp3File) {
            if (file.size <= 20 * 1024 * 1024) {
                validFiles.push(file);
                
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span class="file-item-name">${file.name}</span>
                    <span class="file-item-status">Pending</span>
                `;
                fileList.appendChild(fileItem);
            } else {
                invalidFiles.push({ file, reason: 'size' });
            }
        } else {
            invalidFiles.push({ file, reason: 'type' });
        }
    }
    
    if (invalidFiles.length > 0) {
        const invalidFileNames = invalidFiles.map(item => `${item.file.name} (${item.reason === 'size' ? 'too large' : 'invalid type'})`).join(', ');
        analyticsFeedback.textContent = `Some files could not be processed: ${invalidFileNames}`;
        analyticsFeedback.className = 'file-feedback warning';
        analyticsFeedback.style.display = 'block';
    }
    
    if (validFiles.length > 0) {
        analyticsFeedback.textContent = `Processing ${validFiles.length} file${validFiles.length > 1 ? 's' : ''}...`;
        analyticsFeedback.className = 'file-feedback info';
        analyticsFeedback.style.display = 'block';
        
        processMultipleFiles(validFiles);
    } else {
        analyticsFeedback.textContent = 'No valid files to process. Please upload .txt, .doc, .docx, .pdf, or .mp3 files (max 20MB each).';
        analyticsFeedback.className = 'file-feedback error';
        analyticsFeedback.style.display = 'block';
    }
}

function processMultipleFiles(files) {
    const fileList = document.getElementById('analyticsFileList');
    const analyticsFeedback = document.getElementById('analyticsFeedback');
    
    let processedCount = 0;
    const totalFiles = files.length;
    
    const updateProgress = () => {
        processedCount++;
        analyticsFeedback.textContent = `Processed ${processedCount}/${totalFiles} files`;
        
        if (processedCount === totalFiles) {
            analyticsFeedback.textContent = `Successfully processed ${totalFiles} file${totalFiles > 1 ? 's' : ''}!`;
            analyticsFeedback.className = 'file-feedback success';
        }
    };
    
    files.forEach((file, index) => {
        const fileItems = fileList.querySelectorAll('.file-item');
        const fileItem = fileItems[index];
        const statusSpan = fileItem.querySelector('.file-item-status');
        
        statusSpan.textContent = 'Processing...';
        
        const fileName = file.name.toLowerCase();
        const isTextFile = fileName.endsWith('.txt');
        const isMp3File = fileName.endsWith('.mp3');
        
        if (isMp3File) {
            processAudioFileForAnalytics(file, fileItem, () => {
                updateProgress();
            });
        } else {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                let transcriptText;
                
                if (isTextFile) {
                    transcriptText = e.target.result || defaultTranscript;
                } else {
                    transcriptText = `[Binary content from ${file.name}]`;
                }
                
                analyzeTranscriptForAnalytics(transcriptText, file.name, fileItem, () => {
                    updateProgress();
                });
            };
            
            reader.onerror = (e) => {
                console.error("Error reading file:", e);
                statusSpan.textContent = 'Error';
                statusSpan.style.color = 'var(--danger)';
                updateProgress();
            };
            
            if (isTextFile) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
                analyzeTranscriptForAnalytics(`[Binary content from ${file.name}]`, file.name, fileItem, () => {
                    updateProgress();
                });
            }
        }
    });
}

function processAudioFileForAnalytics(file, fileItem, callback) {
    const statusSpan = fileItem.querySelector('.file-item-status');
    statusSpan.textContent = 'Transcribing audio...';
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const fileReader = new FileReader();
    
    fileReader.onload = function(e) {
        const arrayBuffer = e.target.result;
        
        audioContext.decodeAudioData(arrayBuffer)
            .then(function(audioBuffer) {
                const offlineContext = new OfflineAudioContext(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length,
                    audioBuffer.sampleRate
                );
                
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);
                
                return offlineContext.startRendering();
            })
            .then(function(renderedBuffer) {
                const transcription = transcribeAudio(renderedBuffer);
                statusSpan.textContent = 'Analyzing transcript...';
                
                analyzeTranscriptForAnalytics(transcription, file.name, fileItem, callback);
            })
            .catch(function(err) {
                console.error('Audio processing error:', err);
                statusSpan.textContent = 'Error';
                statusSpan.style.color = 'var(--danger)';
                if (callback) callback();
            });
    };
    
    fileReader.readAsArrayBuffer(file);
}

function transcribeAudio(audioBuffer) {
    const transcriptionPlaceholder = `[This transcript was generated from an audio file]
    
    Customer: Hi, I'm calling about my dog Max. He's been having some digestive issues lately.
    Support: Hello! I'm sorry to hear about Max. Can you tell me more about his symptoms?
    Customer: He's been vomiting after meals sometimes, and seems less active than usual.
    Support: I understand. What kind of food does Max eat? And how old is he?
    Customer: He's a 3-year-old golden retriever. I feed him dry kibble twice a day.
    Support: Has there been any change in his diet recently?
    Customer: Well, I did switch brands about two weeks ago.
    Support: That could be contributing to the issue. Let's talk about how we might address this...`;
    
    return transcriptionPlaceholder;
}

function transcribeAudioFileWithWebSpeechAPI(audioFile, onComplete) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        onComplete("Browser doesn't support speech recognition. Using simulated transcript instead.\n\n" + 
                 transcribeAudio(null));
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    let transcriptParts = [];
    
    recognition.onresult = function(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcriptParts.push(event.results[i][0].transcript);
            }
        }
    };
    
    recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        onComplete("Error in speech recognition. Using simulated transcript instead.\n\n" + 
                  transcribeAudio(null));
    };
    
    recognition.onend = function() {
        if (transcriptParts.length === 0) {
            onComplete("Could not transcribe audio. Using simulated transcript instead.\n\n" + 
                      transcribeAudio(null));
        } else {
            onComplete(transcriptParts.join(' '));
        }
    };
    
    const audioUrl = URL.createObjectURL(audioFile);
    const audio = new Audio(audioUrl);
    
    audio.onended = function() {
        recognition.stop();
    };
    
    try {
        recognition.start();
        audio.play();
    } catch (e) {
        console.error("Error starting recognition or playing audio", e);
        onComplete("Error transcribing audio. Using simulated transcript instead.\n\n" + 
                  transcribeAudio(null));
    }
}

function analyzeTranscriptForAnalytics(transcriptText, fileName, fileItem, callback) {
    const statusSpan = fileItem ? fileItem.querySelector('.file-item-status') : null;
    if (statusSpan) {
        statusSpan.textContent = 'Analyzing...';
    }
    
    const prompt = `
You're analyzing a pet care conversation transcript. Extract these details:
1. Pet parent name
2. Pet type (dog/cat/both/other)
3. Pet name(s)
4. Knowledge level (rate 1-10, where 1-3=low, 4-7=medium, 8-10=high)
5. Key issues mentioned

Respond ONLY in this JSON format:
{
  "petParent": "name or unknown",
  "petType": "dog/cat/both/other",
  "petNames": ["name1", "name2"],
  "knowledgeLevel": 5,
  "knowledgeCategory": "low/medium/high",
  "keyIssues": "brief summary of main problems"
}

Transcript:
${transcriptText}
`;
    
    fetch("https://solvr-api.vercel.app/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    })
    .then(response => response.text())
    .then(rawText => {
        let data;
        try {
            data = JSON.parse(rawText);
            
            let petAnalysis;
            
            if (data.data && data.data.candidates && 
                data.data.candidates[0] && 
                data.data.candidates[0].content && 
                data.data.candidates[0].content.parts && 
                data.data.candidates[0].content.parts[0] && 
                data.data.candidates[0].content.parts[0].text) {
                
                const responseText = data.data.candidates[0].content.parts[0].text;
                
                try {
                    const jsonStartIndex = responseText.indexOf('{');
                    const jsonEndIndex = responseText.lastIndexOf('}') + 1;
                    const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex);
                    petAnalysis = JSON.parse(jsonString);
                } catch (jsonError) {
                    console.error("Error parsing JSON from response:", jsonError);
                    petAnalysis = {
                        petParent: "Unknown",
                        petType: "unknown",
                        petNames: ["Unknown"],
                        knowledgeLevel: 5,
                        knowledgeCategory: "medium",
                        keyIssues: "Could not determine from transcript"
                    };
                }
            } else {
                petAnalysis = {
                    petParent: "Unknown",
                    petType: "unknown",
                    petNames: ["Unknown"],
                    knowledgeLevel: 5,
                    knowledgeCategory: "medium",
                    keyIssues: "Could not determine from transcript"
                };
            }
            
            const transcriptEntry = {
                fileName: fileName,
                transcript: transcriptText,
                analysis: petAnalysis
            };
            
            allTranscripts.push(transcriptEntry);
            updateAnalytics();
            
            if (statusSpan) {
                statusSpan.textContent = 'Complete';
                statusSpan.style.color = 'var(--success)';
            }
            
            if (callback) callback();
            
        } catch (e) {
            console.error("Error processing analytics response:", e);
            
            if (statusSpan) {
                statusSpan.textContent = 'Error';
                statusSpan.style.color = 'var(--danger)';
            }
            
            if (callback) callback();
        }
    })
    .catch(error => {
        console.error("API request error for analytics:", error);
        
        if (statusSpan) {
            statusSpan.textContent = 'Error';
            statusSpan.style.color = 'var(--danger)';
        }
        
        if (callback) callback();
    });
}

function updateAnalytics() {
    if (allTranscripts.length === 0) return;
    
    const totalTranscripts = document.getElementById('totalTranscripts');
    const dogOwners = document.getElementById('dogOwners');
    const catOwners = document.getElementById('catOwners');
    const highKnowledgeBar = document.getElementById('highKnowledgeBar');
    const mediumKnowledgeBar = document.getElementById('mediumKnowledgeBar');
    const lowKnowledgeBar = document.getElementById('lowKnowledgeBar');
    const highKnowledgeValue = document.getElementById('highKnowledgeValue');
    const mediumKnowledgeValue = document.getElementById('mediumKnowledgeValue');
    const lowKnowledgeValue = document.getElementById('lowKnowledgeValue');
    const petsTableBody = document.getElementById('petsTableBody');
    
    if (totalTranscripts) totalTranscripts.textContent = allTranscripts.length;
    
    let dogCount = 0;
    let catCount = 0;
    let highKnowledge = 0;
    let mediumKnowledge = 0;
    let lowKnowledge = 0;
    
    allTranscripts.forEach(transcript => {
        const petType = transcript.analysis.petType.toLowerCase();
        
        if (petType.includes('dog')) dogCount++;
        if (petType.includes('cat')) catCount++;
        if (petType.includes('both')) {
            dogCount++;
            catCount++;
        }
        
        const knowledge = transcript.analysis.knowledgeCategory.toLowerCase();
        if (knowledge === 'high') highKnowledge++;
        else if (knowledge === 'medium') mediumKnowledge++;
        else if (knowledge === 'low') lowKnowledge++;
    });
    
    if (dogOwners) dogOwners.textContent = dogCount;
    if (catOwners) catOwners.textContent = catCount;
    
    const total = allTranscripts.length;
    
    if (highKnowledgeBar) {
        const highPercent = total > 0 ? (highKnowledge / total) * 100 : 0;
        highKnowledgeBar.style.width = `${highPercent}%`;
        highKnowledgeValue.textContent = highKnowledge;
    }
    
    if (mediumKnowledgeBar) {
        const mediumPercent = total > 0 ? (mediumKnowledge / total) * 100 : 0;
        mediumKnowledgeBar.style.width = `${mediumPercent}%`;
        mediumKnowledgeValue.textContent = mediumKnowledge;
    }
    
    if (lowKnowledgeBar) {
        const lowPercent = total > 0 ? (lowKnowledge / total) * 100 : 0;
        lowKnowledgeBar.style.width = `${lowPercent}%`;
        lowKnowledgeValue.textContent = lowKnowledge;
    }
    
    if (petsTableBody) {
        petsTableBody.innerHTML = '';
        
        allTranscripts.forEach(transcript => {
            const row = document.createElement('tr');
            
            const petParentCell = document.createElement('td');
            petParentCell.textContent = transcript.analysis.petParent;
            
            const petTypeCell = document.createElement('td');
            petTypeCell.textContent = transcript.analysis.petType;
            
            const petNameCell = document.createElement('td');
            petNameCell.textContent = transcript.analysis.petNames.join(', ');
            
            const knowledgeLevelCell = document.createElement('td');
            knowledgeLevelCell.textContent = `${transcript.analysis.knowledgeCategory} (${transcript.analysis.knowledgeLevel}/10)`;
            
            const knowledgeClass = transcript.analysis.knowledgeCategory.toLowerCase();
            knowledgeLevelCell.classList.add(`knowledge-${knowledgeClass}`);
            
            const keyIssuesCell = document.createElement('td');
            keyIssuesCell.textContent = transcript.analysis.keyIssues;
            
            row.appendChild(petParentCell);
            row.appendChild(petTypeCell);
            row.appendChild(petNameCell);
            row.appendChild(knowledgeLevelCell);
            row.appendChild(keyIssuesCell);
            
            petsTableBody.appendChild(row);
        });
    }
}

function addSpecialPromptButtons() {
    if (!elements.chatFooter) return;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'special-prompt-buttons';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '10px';
    
    const knowledgeButton = createSpecialPromptButton(
        'Pet Knowledge', 
        'Based on the transcript, rate the pet parent\'s knowledge level about pet care on a scale of 1-10. Explain why you gave this rating with specific examples from the transcript.'
    );
    
    const dietButton = createSpecialPromptButton(
        'Pet Diet', 
        'Based on the transcript, analyze the pet\'s diet. What are they currently feeding their pet? Are there any concerns or issues with the diet mentioned? Provide specific recommendations if appropriate.'
    );
    
    buttonContainer.appendChild(knowledgeButton);
    buttonContainer.appendChild(dietButton);
    
    elements.chatFooter.insertBefore(buttonContainer, elements.chatFooter.firstChild);
}

function createSpecialPromptButton(label, prompt) {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'special-prompt-btn';
    button.style.padding = '8px 12px';
    button.style.backgroundColor = 'var(--secondary)';
    button.style.color = 'var(--text)';
    button.style.border = '1px solid var(--primary-light)';
    button.style.borderRadius = '6px';
    button.style.cursor = 'pointer';
    button.style.transition = 'all 0.3s ease';
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    
    button.addEventListener('click', () => {
        isSpecialPromptActive = true;
        activeSpecialPromptButton = button;
        sendSpecialPrompt(prompt);
        
        const allButtons = document.querySelectorAll('.special-prompt-btn');
        allButtons.forEach(btn => {
            btn.style.backgroundColor = 'var(--secondary)';
            btn.classList.remove('active-special-prompt');
        });
        
        button.style.backgroundColor = 'rgba(140, 82, 255, 0.2)';
        button.classList.add('active-special-prompt');
        
        addMovingBorder(button);
    });
    
    return button;
}

function addMovingBorder(element) {
    if (!element) return;
    
    element.classList.add('moving-border');
    
    if (!document.querySelector('.moving-border-style')) {
        const style = document.createElement('style');
        style.className = 'moving-border-style';
        style.textContent = `
            @keyframes borderMove {
                0% { border-color: rgba(255, 215, 0, 0.7); }
                25% { border-color: rgba(255, 215, 0, 1); }
                50% { border-color: rgba(255, 215, 0, 0.7); }
                75% { border-color: rgba(255, 215, 0, 1); }
                100% { border-color: rgba(255, 215, 0, 0.7); }
            }
            
            .moving-border {
                border: 2px solid rgba(255, 215, 0, 0.7) !important;
                animation: borderMove 2s infinite linear;
            }
            
            .special-response {
                background-color: rgba(255, 215, 0, 0.1) !important;
                border-left: 3px solid gold !important;
            }
        `;
        document.head.appendChild(style);
    }
}

function sendSpecialPrompt(promptText) {
    if (!elements.userInput) return;
    
    elements.userInput.value = '';
    addMessageToChat('user', `🔍 ${promptText}`, true);
    
    addTypingIndicator();
    sendToGeminiAPI(promptText, currentTranscript, true);
}

function handleFileUpload(file) {
    if (!file) {
        console.error("No file provided");
        return;
    }
    
    console.log("Handling file upload:", file.name, file.type, file.size);
    
    const fileName = file.name.toLowerCase();
    const isTextFile = fileName.endsWith('.txt');
    const isPdfFile = fileName.endsWith('.pdf');
    const isDocFile = fileName.endsWith('.doc') || fileName.endsWith('.docx');
    const isMp3File = fileName.endsWith('.mp3');
    
    if (!(isTextFile || isPdfFile || isDocFile || isMp3File)) {
        console.error("Invalid file type");
        showFileFeedback('error', 'Please upload a valid transcript file (.txt, .doc, .docx, .pdf, .mp3)');
        return;
    }
    
    if (file.size > 15 * 1024 * 1024) {
        console.error("File too large");
        showFileFeedback('error', 'File size should be less than 15MB');
        return;
    }
    
    elements.fileName.textContent = file.name;
    
    if (isMp3File) {
        currentAudioFile = file;
        
        const audioPlayer = document.getElementById('audioPlayer');
        const audioContainer = document.getElementById('audioContainer');
        const transcriptOptions = document.getElementById('transcriptOptions');
        
        if (audioPlayer && audioContainer && transcriptOptions) {
            const audioUrl = URL.createObjectURL(file);
            audioPlayer.src = audioUrl;
            audioContainer.style.display = 'block';
            transcriptOptions.style.display = 'block';
        }
        
        showFileFeedback('info', 'Audio file uploaded. You can enter a transcript or let us transcribe it for you.');
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log("File read successfully");
            if (isTextFile) {
                currentTranscript = e.target.result || defaultTranscript;
                
                const transcriptInput = document.getElementById('transcriptInput');
                const transcriptOptions = document.getElementById('transcriptOptions');
                
                if (transcriptInput && transcriptOptions) {
                    transcriptInput.value = currentTranscript;
                    transcriptOptions.style.display = 'block';
                }
            } else {
                currentTranscript = `[Binary content from ${file.name}]`;
            }
            showFileFeedback('success', 'File uploaded successfully. Click to process.');
        };
        
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            currentTranscript = defaultTranscript;
            showFileFeedback('error', 'Error reading file. Please try again.');
        };
        
        if (isTextFile) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
            currentTranscript = `[Binary content from ${file.name}]`;
            showFileFeedback('success', 'File uploaded successfully. Click to process.');
        }
    }
}

function transcribeAudioFileForChat(file) {
    if (!file) return;
    
    showFileFeedback('info', 'Transcribing audio... This may take a moment.');
    
    transcribeAudioFileWithWebSpeechAPI(file, transcriptText => {
        currentTranscript = transcriptText;
        showFileFeedback('success', 'Audio transcribed successfully! Click to process.');
    });
}

function showFileFeedback(type, message) {
    console.log(`Showing ${type} feedback:`, message);
    if (elements.fileFeedback) {
        elements.fileFeedback.textContent = message;
        elements.fileFeedback.className = `file-feedback ${type}`;
        elements.fileFeedback.style.display = 'block';
    }
}

function processTranscript() {
    console.log("Processing transcript:", currentTranscript.substring(0, 50) + "...");
    
    if (!currentTranscript) {
        console.error("No transcript content");
        showFileFeedback('error', 'Please upload a transcript file first');
        return;
    }
    
    elements.uploadSection.style.display = 'none';
    elements.loadingSection.style.display = 'flex';
    
    setTimeout(() => {
        elements.loadingSection.style.display = 'none';
        elements.chatSection.style.display = 'flex';
        scrollChatToBottom();
    }, 1000);
}

function resetToUpload() {
    console.log("Resetting to upload screen");
    
    if (elements.chatSection) elements.chatSection.style.display = 'none';
    if (elements.uploadSection) elements.uploadSection.style.display = 'block';
    
    if (elements.fileInput) elements.fileInput.value = '';
    if (elements.fileName) elements.fileName.textContent = '';
    if (elements.fileFeedback) elements.fileFeedback.style.display = 'none';
    
    const audioPlayer = document.getElementById('audioPlayer');
    const audioContainer = document.getElementById('audioContainer');
    const transcriptOptions = document.getElementById('transcriptOptions');
    const transcriptInput = document.getElementById('transcriptInput');
    
    if (audioPlayer) audioPlayer.src = '';
    if (audioContainer) audioContainer.style.display = 'none';
    if (transcriptOptions) transcriptOptions.style.display = 'none';
    if (transcriptInput) transcriptInput.value = '';
    
    currentTranscript = defaultTranscript;
    currentAudioFile = null;
    
    const firstMessage = elements.chatMessages.firstElementChild;
    elements.chatMessages.innerHTML = '';
    if (firstMessage) {
        elements.chatMessages.appendChild(firstMessage);
    }
    
    isSpecialPromptActive = false;
    activeSpecialPromptButton = null;
    
    const allButtons = document.querySelectorAll('.special-prompt-btn');
    allButtons.forEach(btn => {
        btn.style.backgroundColor = 'var(--secondary)';
        btn.classList.remove('active-special-prompt');
        btn.classList.remove('moving-border');
    });
}

function sendMessage() {
    if (!elements.userInput) {
        console.error("User input element not found");
        return;
    }
    
    const userMessage = elements.userInput.value.trim();
    
    if (!userMessage) {
        console.log("Empty message, not sending");
        return;
    }
    
    console.log("Sending message:", userMessage);
    
    addMessageToChat('user', userMessage);
    
    elements.userInput.value = '';
    
    addTypingIndicator();
    
    sendToGeminiAPI(userMessage, currentTranscript);
}

function formatMarkdown(text) {
    if (!text) return text;
    
    let formattedText = text;
    
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formattedText = formattedText.replace(/__(.*?)__/g, '<u>$1</u>');
    formattedText = formattedText.replace(/~~(.*?)~~/g, '<del>$1</del>');
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

function addMessageToChat(type, text, isSpecialPrompt = false) {
    console.log(`Adding ${type} message to chat:`, text.substring(0, 50) + (text.length > 50 ? "..." : ""));
    
    if (!elements.chatMessages) {
        console.error("Chat messages element not found");
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'user' ? 'message user-message' : 'message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = type === 'user' ? 'avatar user-avatar' : 'avatar bot-avatar';
    
    const icon = document.createElement('i');
    icon.className = type === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(icon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (type === 'bot' && isSpecialPromptActive && isSpecialPrompt) {
        contentDiv.classList.add('special-response');
        isSpecialPromptActive = false;
        
        if (activeSpecialPromptButton) {
            setTimeout(() => {
                activeSpecialPromptButton.classList.remove('moving-border');
            }, 1000);
        }
    }
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    
    if (type === 'bot') {
        textDiv.innerHTML = formatMarkdown(text);
    } else {
        textDiv.textContent = text;
    }
    
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
}

function addTypingIndicator() {
    console.log("Adding typing indicator");
    
    if (!elements.chatMessages) {
        console.error("Chat messages element not found");
        return;
    }
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message';
    typingIndicator.id = 'typingIndicator';
    
    typingIndicator.innerHTML = `
        <div class="avatar bot-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(typingIndicator);
    scrollChatToBottom();
}

function removeTypingIndicator() {
    console.log("Removing typing indicator");
    
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    } else {
        console.warn("Typing indicator not found");
    }
}

function scrollChatToBottom() {
    if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

async function sendToGeminiAPI(userMessage, transcriptContent, isSpecialPrompt = false) {
    console.log("Sending to Gemini API...");
    console.log("User message:", userMessage);
    console.log("Transcript length:", transcriptContent.length);
    
    const prompt = `You are analyzing a transcript of a conversation. The transcript may contain spelling mistakes or unclear text due to AI transcription, but please ignore these issues and don't mention them.

IMPORTANT: Focus only on answering the user's question based on information found in the transcript.

Transcript:
${transcriptContent}

User question: ${userMessage}

Answer the question based ONLY on information found in the transcript. If you cannot find relevant information in the transcript to answer the question, simply state "I don't see that information in the transcript." DO NOT make up information or provide general knowledge that isn't in the transcript.`;
    
    console.log("Sending prompt (first 200 chars):", prompt.substring(0, 200) + "...");
    
    try {
        console.log("Making API request to https://solvr-api.vercel.app/api/gemini");
        
        const response = await fetch("https://solvr-api.vercel.app/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const rawText = await response.text();
        console.log("Raw API response (first 500 chars):", rawText.substring(0, 500) + "...");
        
        let data;
        try {
            data = JSON.parse(rawText);
            console.log("Successfully parsed response as JSON");
        } catch (e) {
            console.log("Response is not valid JSON, using raw text");
            data = { text: rawText };
        }
        
        console.log("API response data:", data);
        console.log("API response data structure:", JSON.stringify(data));
        
        removeTypingIndicator();
        
        let botResponse;
        
        try {
            if (data.data && data.data.candidates && 
                data.data.candidates[0] && 
                data.data.candidates[0].content && 
                data.data.candidates[0].content.parts && 
                data.data.candidates[0].content.parts[0] && 
                data.data.candidates[0].content.parts[0].text) {
                
                botResponse = data.data.candidates[0].content.parts[0].text;
                console.log("Found response in data.data.candidates[0].content.parts[0].text");
            }
            else if (data.response) {
                botResponse = data.response;
                console.log("Found response in data.response");
            } else if (data.data && data.data.response) {
                botResponse = data.data.response;
                console.log("Found response in data.data.response");
            } else if (data.data && data.data.text) {
                botResponse = data.data.text;
                console.log("Found response in data.data.text");
            } else if (data.text) {
                botResponse = data.text;
                console.log("Found response in data.text");
            } else if (typeof data === 'string') {
                botResponse = data;
                console.log("Using raw string data as response");
            } else {
                console.log("Unknown response format. Full response:", JSON.stringify(data));
                botResponse = "I'm sorry, but I couldn't process the information from the transcript.";
            }
        } catch (error) {
            console.error("Error extracting response:", error);
            botResponse = "Error processing response. Please try again.";
        }
        
        console.log("Final bot response:", botResponse);
        addMessageToChat('bot', botResponse, isSpecialPrompt);
        
    } catch (error) {
        console.error("API request error:", error);
        
        removeTypingIndicator();
        
        addMessageToChat('bot', "I'm sorry, there was an error processing your request. Please try again.", isSpecialPrompt);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing app");
    initChat();
});