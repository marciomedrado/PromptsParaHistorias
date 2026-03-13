// =============== STATE ===============
const state = {
    currentStep: 1,
    file: null,
    srtData: null,
    scenes: [],
    fullText: '',
    elements: [],
    selectedStyle: '',
    scenePrompts: [],
    outputFiles: {},
    densityRules: [{ start: '00:00', end: '', density: 10 }]
};


// =============== VISUAL STYLES ===============
const VISUAL_STYLES = [
    {
        id: 'cinematic-realism',
        name: 'Realismo Cinematográfico',
        emoji: '🎥',
        desc: 'Fotorealismo com iluminação de cinema, profundidade de campo e color grading profissional',
        prompt: 'Cinematic photorealistic style, dramatic lighting, shallow depth of field, professional color grading, anamorphic lens flare, volumetric lighting, 8K quality'
    },
    {
        id: 'anime-modern',
        name: 'Anime Moderno',
        emoji: '🌸',
        desc: 'Estilo anime japonês contemporâneo com cores vibrantes e traços limpos',
        prompt: 'Modern Japanese anime style, clean linework, vibrant saturated colors, dynamic shading, detailed eyes, cel-shaded rendering, Studio Ghibli and Makoto Shinkai inspired'
    },
    {
        id: 'watercolor-storybook',
        name: 'Aquarela de Livro',
        emoji: '🎨',
        desc: 'Aquarela artística com textura de papel, ideal para histórias infantis e contos',
        prompt: 'Delicate watercolor illustration style, soft paper texture, gentle color bleeding, hand-painted feel, storybook illustration, warm luminous washes, fine ink outlines'
    },
    {
        id: 'dark-fantasy',
        name: 'Fantasia Sombria',
        emoji: '🐉',
        desc: 'Fantasia épica com iluminação dramática, sombras profundas e detalhes góticos',
        prompt: 'Dark fantasy art style, dramatic chiaroscuro lighting, rich deep shadows, gothic architectural details, magical ethereal glow effects, oil painting texture, epic scale'
    },
    {
        id: 'pixar-3d',
        name: 'Animação 3D Pixar',
        emoji: '🧸',
        desc: 'Estilo de animação 3D simplificado, expressivo e colorido como filmes da Pixar',
        prompt: 'Pixar-style 3D animation, smooth rounded forms, expressive cartoon proportions, subsurface scattering on skin, warm global illumination, vibrant saturated palette, playful character design'
    },
    {
        id: 'comic-book',
        name: 'Quadrinhos/HQ',
        emoji: '💥',
        desc: 'Estilo de histórias em quadrinhos com traços fortes, cores chapadas e ação dinâmica',
        prompt: 'Comic book illustration style, bold ink outlines, halftone dot shading, dynamic action poses, dramatic perspectives, flat bold colors, motion lines and speed effects'
    },
    {
        id: 'oil-painting',
        name: 'Pintura a Óleo',
        emoji: '🖼️',
        desc: 'Pintura a óleo clássica com pinceladas visíveis, textura rica e profundidade de cor',
        prompt: 'Classical oil painting style, visible impasto brushstrokes, rich color depth, Renaissance-inspired composition, warm golden light, detailed fabric and skin textures, Old Masters technique'
    },
    {
        id: 'cyberpunk',
        name: 'Cyberpunk Neon',
        emoji: '🌆',
        desc: 'Futuro distópico com neons, chuva, reflexos e alta tecnologia degradada',
        prompt: 'Cyberpunk neon-noir style, vibrant neon pink and cyan lighting, rain-slicked reflective surfaces, holographic displays, dense urban environment, lens flares, Blade Runner atmosphere'
    },
    {
        id: 'minimalist',
        name: 'Minimalista Elegante',
        emoji: '⬜',
        desc: 'Design limpo e minimalista com formas geométricas, paleta reduzida e composição equilibrada',
        prompt: 'Minimalist elegant illustration style, clean geometric shapes, limited refined color palette, generous negative space, subtle gradients, modern design sensibility, balanced composition'
    },
    {
        id: 'retro-vintage',
        name: 'Retrô Vintage',
        emoji: '📺',
        desc: 'Estética vintage com texturas de grão, paleta de cores desaturada e vibes nostálgicas',
        prompt: 'Retro vintage illustration style, muted desaturated warm color palette, visible film grain texture, 1970s color palette, faded edges, nostalgic warmth, screen-print aesthetic'
    },
    {
        id: 'custom',
        name: 'Personalizado',
        emoji: '✏️',
        desc: 'Defina seu próprio estilo visual personalizado',
        prompt: ''
    }
];

// =============== INITIALIZATION ===============
document.addEventListener('DOMContentLoaded', () => {
    checkApiHealth();
    initUploadZone();
    renderStyleGrid();
    renderDensityRules();
    initEventListeners();
});

async function checkApiHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');

        if (data.apiKeyConfigured) {
            dot.classList.add('active');
            text.textContent = 'API da OpenAI conectada e pronta';
        } else {
            text.textContent = '⚠️ Chave da API não configurada — configure no arquivo .env';
        }
    } catch (err) {
        document.getElementById('statusText').textContent = '❌ Erro ao conectar com o servidor';
    }
}

// =============== UPLOAD ===============
function initUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });
}

async function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.srt')) {
        showToast('Apenas arquivos .srt são aceitos', 'error');
        return;
    }

    state.file = file;
    showLoading('Carregando arquivo...', 'Processando SRT');

    const formData = new FormData();
    formData.append('srt', file);
    formData.append('densityRules', JSON.stringify(state.densityRules));

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        state.srtData = data;
        state.scenes = data.scenes;
        state.fullText = data.fullText;

        // Show file info
        document.getElementById('fileName').textContent = `📄 ${data.filename}`;
        document.getElementById('fileStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${data.totalEntries}</div>
        <div class="stat-label">Blocos SRT</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.totalScenes}</div>
        <div class="stat-label">Cenas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.totalDurationFormatted.split(',')[0]}</div>
        <div class="stat-label">Duração Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.fullText.split(/\s+/).length}</div>
        <div class="stat-label">Palavras</div>
      </div>
    `;

        document.getElementById('fileInfo').classList.add('visible');
        document.getElementById('btnAnalyze').disabled = false;

        showToast(`Arquivo carregado: ${data.totalScenes} cenas identificadas`, 'success');
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// =============== ANALYSIS ===============
async function analyzeStory() {
    showLoading('Analisando história com IA...', 'Identificando personagens, locais, objetos e ambientação');
    setProgress(10);

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullText: state.fullText })
        });

        setProgress(70);
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        state.elements = data.elements;
        setProgress(100);

        showToast(`${data.elements.length} elementos identificados na história`, 'success');
        goToStep(2);
    } catch (err) {
        showToast(`Erro na análise: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// =============== STYLE SELECTION ===============
function renderStyleGrid() {
    const grid = document.getElementById('styleGrid');
    grid.innerHTML = VISUAL_STYLES.map(style => `
    <div class="style-card" data-style-id="${style.id}" onclick="selectStyle('${style.id}')">
      <span class="style-emoji">${style.emoji}</span>
      <div class="style-name">${style.name}</div>
      <div class="style-desc">${style.desc}</div>
    </div>
  `).join('');
}

function selectStyle(styleId) {
    // Update UI
    document.querySelectorAll('.style-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.styleId === styleId);
    });

    // Toggle custom input
    const customInput = document.getElementById('customStyleInput');
    customInput.classList.toggle('visible', styleId === 'custom');

    // Set state
    const style = VISUAL_STYLES.find(s => s.id === styleId);
    if (styleId === 'custom') {
        state.selectedStyle = '';
        document.getElementById('btnConfirmStyle').disabled = true;
    } else {
        state.selectedStyle = style.prompt;
        document.getElementById('btnConfirmStyle').disabled = false;
    }
}

// =============== ELEMENT PROMPTS ===============
async function generateElementPrompts() {
    if (state.selectedStyle === '' && document.getElementById('customStyleText').value.trim()) {
        state.selectedStyle = document.getElementById('customStyleText').value.trim();
    }

    if (!state.selectedStyle) {
        showToast('Selecione ou descreva um estilo visual', 'error');
        return;
    }

    showLoading('Gerando prompts dos elementos...', `Processando ${state.elements.length} elementos com estilo selecionado`);
    setProgress(10);

    try {
        const res = await fetch('/api/generate-element-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elements: state.elements, style: state.selectedStyle })
        });

        setProgress(80);
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        state.elements = data.elements;
        setProgress(100);

        renderElements();
        showToast('Prompts de todos os elementos gerados com sucesso!', 'success');
        goToStep(3);
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// =============== ELEMENTS RENDERING ===============
function renderElements() {
    const grid = document.getElementById('elementsGrid');
    grid.innerHTML = state.elements.map((el, idx) => createElementCard(el, idx)).join('');
    renderSceneSelection();
}

function renderSceneSelection() {
    const grid = document.getElementById('scenesSelectionGrid');
    if (!grid) return;

    grid.innerHTML = state.scenes.map((scene, idx) => `
        <div class="scene-selection-item">
            <input type="checkbox" id="scene-check-${scene.sceneNumber}" class="scene-checkbox" value="${idx}" checked>
            <label for="scene-check-${scene.sceneNumber}">
                <span class="scene-num">Trecho #${scene.sceneNumber} (${scene.targetImages} imgs)</span>
                <span class="scene-time">${scene.startTime} → ${scene.endTime}</span>
                <span class="scene-text" style="-webkit-line-clamp: 5;">${scene.narration}</span>
            </label>
        </div>
    `).join('');
}

function createElementCard(element, index) {
    const typeLabels = {
        character: '👤 Personagem',
        location: '📍 Local',
        object: '🔮 Objeto',
        environment: '🌍 Ambiente'
    };

    const fields = getFieldsForType(element);

    return `
    <div class="element-card" id="card-${element.id}" data-index="${index}">
      <div class="element-card-header">
        <span class="element-type-badge ${element.type}">${typeLabels[element.type] || element.type}</span>
        <div class="element-card-actions">
          <button class="btn-icon" onclick="toggleEditElement('${element.id}')" title="Editar">✏️</button>
          <button class="btn-icon save" onclick="saveElement('${element.id}')" title="Salvar" style="display:none;" id="save-${element.id}">💾</button>
          <button class="btn-icon danger" onclick="deleteElement('${element.id}', ${index})" title="Excluir">🗑️</button>
        </div>
      </div>
      <div class="element-card-body">
        <div class="element-name">${element.name}</div>
        ${fields.map(f => `
          <div class="element-field">
            <div class="element-field-label">${f.label}</div>
            <div class="element-field-value">${element[f.key] || '—'}</div>
            <textarea class="element-field-input" data-field="${f.key}" id="field-${element.id}-${f.key}">${element[f.key] || ''}</textarea>
          </div>
        `).join('')}
        ${element.prompt ? `
          <div class="element-prompt-section">
            <div class="element-field-label">Prompt Gerado</div>
            <div class="prompt-container">
              <div class="element-prompt">${element.prompt}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function getFieldsForType(element) {
    switch (element.type) {
        case 'character':
            return [
                { key: 'description', label: 'Descrição Física' },
                { key: 'clothing', label: 'Vestuário' },
                { key: 'personality_visual_cues', label: 'Expressões Visuais' },
                { key: 'recurring_props', label: 'Objetos Associados' }
            ];
        case 'location':
            return [
                { key: 'description', label: 'Descrição' },
                { key: 'lighting', label: 'Iluminação' },
                { key: 'atmosphere', label: 'Atmosfera' },
                { key: 'details', label: 'Detalhes' }
            ];
        case 'object':
            return [
                { key: 'description', label: 'Descrição' },
                { key: 'significance', label: 'Significância' }
            ];
        case 'environment':
            return [
                { key: 'era', label: 'Era/Período' },
                { key: 'world_type', label: 'Tipo de Mundo' },
                { key: 'color_palette', label: 'Paleta de Cores' },
                { key: 'mood', label: 'Humor/Tom' },
                { key: 'weather_patterns', label: 'Clima' },
                { key: 'technology_level', label: 'Nível Tecnológico' }
            ];
        default:
            return [{ key: 'description', label: 'Descrição' }];
    }
}

function toggleEditElement(id) {
    const card = document.getElementById(`card-${id}`);
    const isEditing = card.classList.contains('editing');

    if (isEditing) {
        card.classList.remove('editing');
        document.getElementById(`save-${id}`).style.display = 'none';
    } else {
        card.classList.add('editing');
        document.getElementById(`save-${id}`).style.display = 'flex';
    }
}

async function saveElement(id) {
    const card = document.getElementById(`card-${id}`);
    const elementIdx = state.elements.findIndex(el => el.id === id);
    if (elementIdx === -1) return;

    const element = { ...state.elements[elementIdx] };

    // Get updated values from inputs
    const inputs = card.querySelectorAll('.element-field-input');
    inputs.forEach(input => {
        const field = input.dataset.field;
        element[field] = input.value;
    });

    try {
        const res = await fetch(`/api/elements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(element)
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // Update state
        state.elements[elementIdx] = element;

        // Re-render this card
        renderElements();

        showToast(`Elemento "${element.name}" atualizado!`, 'success');
    } catch (err) {
        showToast(`Erro ao salvar: ${err.message}`, 'error');
    }
}

async function deleteElement(id, index) {
    const element = state.elements[index];
    if (!confirm(`Tem certeza que deseja excluir "${element.name}"?`)) return;

    try {
        await fetch(`/api/elements/${id}`, { method: 'DELETE' });
        state.elements.splice(index, 1);
        renderElements();
        showToast(`Elemento "${element.name}" removido`, 'info');
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

async function addNewElement() {
    const type = document.getElementById('newElementType').value;
    const name = document.getElementById('newElementName').value.trim();
    const desc = document.getElementById('newElementDesc').value.trim();

    if (!name || !desc) {
        showToast('Preencha o nome e a descrição', 'error');
        return;
    }

    const element = {
        id: `${type}_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        name,
        type,
        description: desc
    };

    showLoading('Gerando prompt do novo elemento...', '');

    try {
        const res = await fetch('/api/elements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ element, style: state.selectedStyle })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        state.elements.push(data.element);
        renderElements();

        // Clear form
        document.getElementById('newElementName').value = '';
        document.getElementById('newElementDesc').value = '';

        showToast(`Elemento "${name}" adicionado!`, 'success');
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// =============== SCENE GENERATION ===============
async function generateScenes() {
    const selectedIndices = Array.from(document.querySelectorAll('.scene-checkbox:checked'))
        .map(cb => parseInt(cb.value));

    if (selectedIndices.length === 0) {
        showToast('Selecione pelo menos um trecho para gerar', 'error');
        return;
    }

    const selectedScenes = selectedIndices.map(idx => state.scenes[idx]);

    showLoading('Gerando prompts de cenas em movimento...', `Processando ${selectedScenes.length} cenas com referência de ${state.elements.length} elementos`);
    setProgress(5);

    try {
        const res = await fetch('/api/generate-scenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scenes: selectedScenes,
                elements: state.elements,
                style: state.selectedStyle,
                fullText: state.fullText
            })
        });

        setProgress(80);
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        state.scenePrompts = data.scenePrompts;
        state.outputFiles = {
            full: data.outputFile,
            clean: data.cleanFile
        };

        setProgress(100);
        renderScenes();
        showToast(`${data.scenePrompts.length} prompts de cenas gerados!`, 'success');
        goToStep(4);
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function renderScenes() {
    const list = document.getElementById('scenesList');
    list.innerHTML = state.scenePrompts.map((sp) => {
        return `
      <div class="scene-card">
        <div class="scene-card-header">
          <span class="scene-number">Cena ${sp.sceneNumber} (Trecho ${sp.startTime || ''} → ${sp.endTime || ''})</span>
        </div>
        <div class="scene-narration" style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 12px; border-left: 3px solid var(--accent); padding-left: 10px;">
            "${(sp.narration || '').substring(0, 300)}${(sp.narration || '').length > 300 ? '...' : ''}"
        </div>
        <div class="prompt-container">
          <div class="scene-prompt-text">${sp.prompt}</div>
        </div>
      </div>
    `;
    }).join('');

    document.getElementById('exportSection').style.display = 'block';
}

// =============== EXPORT ===============
function downloadFile(type) {
    if (!state.outputFiles[type]) {
        showToast('Arquivo não disponível', 'error');
        return;
    }

    const filename = state.outputFiles[type].split(/[/\\]/).pop();
    window.open(`/api/download-scenes/${filename}`, '_blank');
}

function copyAllPrompts() {
    const allPrompts = state.scenePrompts.map(sp => sp.prompt).join('\n\n');
    navigator.clipboard.writeText(allPrompts).then(() => {
        showToast('Todos os prompts copiados!', 'success');
    });
}

// =============== NAVIGATION ===============
function goToStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    // Show target step
    document.getElementById(`step${stepNum}`).classList.add('active');

    // Update nav
    document.querySelectorAll('.step-nav-item').forEach(item => {
        const itemStep = parseInt(item.dataset.step);
        item.classList.remove('current', 'completed');

        if (itemStep < stepNum) item.classList.add('completed');
        else if (itemStep === stepNum) item.classList.add('current');
    });

    state.currentStep = stepNum;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============== EVENT LISTENERS ===============
function initEventListeners() {
    document.getElementById('btnAnalyze').addEventListener('click', analyzeStory);
    document.getElementById('btnConfirmStyle').addEventListener('click', generateElementPrompts);
    document.getElementById('btnGenerateScenes').addEventListener('click', generateScenes);
    document.getElementById('btnAddElement').addEventListener('click', addNewElement);
    document.getElementById('btnAddDensityRule')?.addEventListener('click', addDensityRule);

    document.getElementById('btnSelectAllScenes')?.addEventListener('click', () => {
        document.querySelectorAll('.scene-checkbox').forEach(cb => cb.checked = true);
    });

    document.getElementById('btnDeselectAllScenes')?.addEventListener('click', () => {
        document.querySelectorAll('.scene-checkbox').forEach(cb => cb.checked = false);
    });

    document.getElementById('btnDownloadFull')?.addEventListener('click', () => downloadFile('full'));
    document.getElementById('btnDownloadClean')?.addEventListener('click', () => downloadFile('clean'));
    document.getElementById('btnCopyAll')?.addEventListener('click', copyAllPrompts);

    // Custom style text listener
    document.getElementById('customStyleText').addEventListener('input', (e) => {
        const hasText = e.target.value.trim().length > 0;
        state.selectedStyle = hasText ? e.target.value.trim() : '';
        document.getElementById('btnConfirmStyle').disabled = !hasText;
    });
}

// =============== DENSITY RULES ===============
function renderDensityRules() {
    const container = document.getElementById('densityRulesContainer');
    if (!container) return;
    container.innerHTML = state.densityRules.map((rule, idx) => `
        <div class="density-rule" style="display: flex; gap: 8px; align-items: center;">
            <input type="text" class="form-input" style="width: 70px; padding: 8px; text-align: center;" value="${rule.start}" oninput="formatTimeInput(this, ${idx}, 'start')" placeholder="00:00">
            <span style="font-size: 13px; color: var(--text-dim);">até</span>
            <input type="text" class="form-input" style="width: 70px; padding: 8px; text-align: center;" value="${rule.end}" oninput="formatTimeInput(this, ${idx}, 'end')" placeholder="Fim">
            <input type="number" class="form-input" style="width: 70px; padding: 8px; text-align: center;" value="${rule.density}" onchange="updateDensityRule(${idx}, 'density', this.value)" min="1" max="999">
            <span style="font-size: 13px; color: var(--text-dim);">imagens</span>
            ${state.densityRules.length > 1 ? `<button class="btn-icon danger" onclick="removeDensityRule(${idx})" style="width: 28px; height: 28px; margin-left: 8px;">🗑️</button>` : ''}
        </div>
    `).join('');
}

window.formatTimeInput = function (input, idx, field) {
    let val = input.value.replace(/\D/g, ''); // Remove on-digits
    if (val.length > 4) val = val.slice(0, 4);

    if (val.length >= 3) {
        val = val.slice(0, 2) + ':' + val.slice(2);
    }
    input.value = val;
    state.densityRules[idx][field] = val;
};

window.updateDensityRule = function (idx, field, value) {
    state.densityRules[idx][field] = value;
};

window.removeDensityRule = function (idx) {
    state.densityRules.splice(idx, 1);
    renderDensityRules();
};

window.addDensityRule = function () {
    let nextStart = '00:00';
    if (state.densityRules.length > 0) {
        let lastEnd = state.densityRules[state.densityRules.length - 1].end;
        if (lastEnd && lastEnd.length === 5 && lastEnd.includes(':')) {
            const parts = lastEnd.split(':').map(Number);
            if (!isNaN(parts[0]) && !isNaN(parts[1])) {
                let totalSeconds = parts[0] * 60 + parts[1] + 1;
                const m = Math.floor(totalSeconds / 60);
                const s = totalSeconds % 60;
                nextStart = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            }
        }
    }
    state.densityRules.push({ start: nextStart, end: '', density: 10 });
    renderDensityRules();
};

// =============== UTILITIES ===============
function showLoading(text, subtext) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingSubtext').textContent = subtext;
    document.getElementById('loadingOverlay').classList.add('visible');
    setProgress(0);
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('visible');
}

function setProgress(percent) {
    document.getElementById('progressFill').style.width = `${percent}%`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
