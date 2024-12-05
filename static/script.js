// script.js
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let conversation = [];
let customUserPrompt = '';

const recordButton = document.getElementById('recordButton');
const endButton = document.getElementById('endButton');
const deleteButton = document.getElementById('deleteButton');
const status = document.getElementById('status');
const conversationDiv = document.getElementById('conversation');
const promptModal = document.getElementById('promptModal');
const systemPromptTextarea = document.getElementById('systemPrompt');
const userPromptTextarea = document.getElementById('userPrompt');
const savePromptsButton = document.getElementById('savePromptsButton');
const closeModalButton = document.getElementById('closeModalButton');
const changeSavePathButton = document.getElementById('changeSavePathButton');
const savePathModal = document.getElementById('savePathModal');
const savePathInput = document.getElementById('savePath');
const saveSavePathButton = document.getElementById('saveSavePathButton');
const closeSavePathModalButton = document.getElementById('closeSavePathModalButton');
const darkModeToggle = document.getElementById('darkModeToggle');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const menuModal = document.getElementById('menuModal');
const closeMenuButton = document.getElementById('closeMenuButton');
const changeApiKeyButton = document.getElementById('changeApiKeyButton');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyButton = document.getElementById('saveApiKeyButton');
const closeApiKeyModalButton = document.getElementById('closeApiKeyModalButton');



function setupEventListeners() {
    recordButton.addEventListener('click', toggleRecording);
    endButton.addEventListener('click', endConversation);
    deleteButton.addEventListener('click', deleteConversation);
    changePromptButton.addEventListener('click', openPromptModal);
    savePromptsButton.addEventListener('click', savePrompts);
    closeModalButton.addEventListener('click', closePromptModal);
    changeSavePathButton.addEventListener('click', openSavePathModal);
    saveSavePathButton.addEventListener('click', saveSavePath);
    closeSavePathModalButton.addEventListener('click', closeSavePathModal);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    hamburgerMenu.addEventListener('click', openMenuModal);
    closeMenuButton.addEventListener('click', closeMenuModal);
    changeApiKeyButton.addEventListener('click', openApiKeyModal);
    saveApiKeyButton.addEventListener('click', saveApiKey);
    closeApiKeyModalButton.addEventListener('click', closeApiKeyModal);
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeDarkMode();
});


async function fetchData(url, method='GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error('HTTP error! status: ${response.status}');
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }

}

function handleError(error, customMessage = 'An error occurred. Please try again.') {
    console.error('Error:', error);
    alert(customMessage);
    status.textContent = customMessage;
}

function openMenuModal() {
    menuModal.style.display = 'block';
}

function closeMenuModal() {
    menuModal.style.display = 'none';
}

function openApiKeyModal() {
    apiKeyModal.style.display = 'block';
    closeMenuModal();
}

function saveApiKey() {
    const newApiKey = apiKeyInput.value;
    
    fetch('/save_api_key','POST', {api_key: newApiKey })
    .then(data => {
        if (data.error){ 
            handleError(data.error, 'Error saving API key:', data.error)
            }  else if (data.message) {
            alert(data.message);
            closeApiKeyModal();
        }
    })
    .catch(error => {
        handleError(error, 'An error occured while saving API key.');
    });
}

function closeApiKeyModal() {
    apiKeyModal.style.display = 'none';
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        darkModeToggle.innerHTML = '<i class="bi bi-moon"></i><i class="bi bi-toggle-on"></i>';
    } else {
        darkModeToggle.innerHTML = '<i class="bi bi-sun"></i><i class="bi bi-toggle-off"></i>';
    }
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

document.addEventListener('DOMContentLoaded', initializeDarkMode);

function initializeDarkMode() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="bi bi-moon"></i><i class="bi bi-toggle-on"></i>';
    }
}

function toggleRecording() {
    if (!isRecording) {
        startRecording();
        recordButton.innerHTML = '<i class="bi bi-stop-fill"></i>';
        recordButton.classList.remove('btn-success');
        recordButton.classList.add('btn-danger');
    } else {
        stopRecording();
        recordButton.innerHTML = '<i class="bi bi-mic-fill"></i>';
        recordButton.classList.remove('btn-danger');
        recordButton.classList.add('btn-success');
    }
    // Apply dark mode styles to the record button if dark mode is active
    if (document.body.classList.contains('dark-mode')) {
        recordButton.style.color = '#87CEFA';
    } else {
        recordButton.style.color = '';
    }
}

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            isRecording = true;
            status.textContent = 'Recording...';
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
            };
        })
        .catch(error => {
            handleError(error, 'An error occurred while trying to record.');
        });
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;
    status.textContent = 'Processing...';

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        sendAudioForProcessing(audioBlob);
    };
}


function sendAudioForProcessing(audioBlob) {
    const formData = new FormData();
    formData.append('audio_data', audioBlob, 'recording.webm');
    formData.append('conversation', JSON.stringify(conversation));

    fetch('/process_audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            status.textContent = 'Error: ' + data.error;
        } else {
            let userMessage = data.transcription;
            // If there's a custom user prompt, prepend it to the transcription
            if (customUserPrompt) {
                userMessage = customUserPrompt + '\n\n' + userMessage;
            }
            conversation.push({ role: 'user', content: userMessage });
            conversation.push({ role: 'assistant', content: data.suggestions });
            updateConversationDisplay();
            status.textContent = 'Processing complete.';
            endButton.disabled = false;
            deleteButton.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        status.textContent = 'An error occurred during processing.';
    });
}

function endConversation() {
    fetchData('/end_conversation', 'POST',{ conversation: conversation })
    .then(data => {
        if (data.error) {
            handleErrorI(data.error, 'Error saving conversation:' + data.error);
        } else {
            status.textContent = 'Conversation saved to Obsidian.';
            resetConversation();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        status.textContent = 'An error occurred while saving the conversation.';
    });
}

function deleteConversation() {
    resetConversation();
    status.textContent = 'Conversation deleted.';
}

function resetConversation() {
    conversation = [];
    updateConversationDisplay();
    recordButton.innerHTML = '<i class="bi bi-mic-fill"></i>';
    recordButton.classList.remove('btn-danger');
    recordButton.classList.add('btn-success');
    endButton.disabled = true;
    deleteButton.disabled = true;
}

function updateConversationDisplay() {
    conversationDiv.innerHTML = conversation.map(message => 
        `<div class="${message.role}-message">
            <strong>${message.role === 'user' ? 'You' : 'AI'}:</strong> ${message.content}
        </div>`
    ).join('');
    conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

function openPromptModal() {
    fetch('/get_prompts')
        .then(response => response.json())
        .then(data => {
            systemPromptTextarea.value = data.system_prompt;
            userPromptTextarea.value = data.user_prompt || '';
            promptModal.style.display = 'block';
        })
        .catch(error => console.error('Error:', error));
}

function savePrompts() {
    const systemPrompt = systemPromptTextarea.value;
    customUserPrompt = userPromptTextarea.value;
    
    fetchData('/save_prompts', 'POST', {
        system_prompt: systemPrompt,
        user_prompt: customUserPrompt
    })
    .then(data => {
        if (data.error){
            handleError(data.error, 'Error saving prompts:', data.error);
        }   else if (data.message) {
            alert(data.message);
            closePromptModal();
        }
    })
    .catch(error => {
        alert('An error occurred while saving prompts. Please try again.');
    });
}

function closePromptModal() {
    promptModal.style.display = 'none';
}

function openSavePathModal() {
    fetch('/get_save_path')
        .then(response => response.json())
        .then(data => {
            savePathInput.value = data.save_path;
            savePathModal.style.display = 'block';
        })
        .catch(error => console.error('Error:', error));
}

function saveSavePath() {
    const newSavePath = savePathInput.value;
    
    fetchData('/save_save_path', 'POST', 
        {save_path: newSavePath})
    .then(data => {
        if (data.error){
            handleError(data.error, 'Error saving path:' + error.data);
        }   else if (data.message) {
            alert(data.message);
            closeSavePathModal();
        }
    })
    .catch(error => 
        {alert('An error occured while saving path.');
    });
}

function closeSavePathModal() {
    savePathModal.style.display = 'none';
}
