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
    outputFiles: {}
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
        <div class="stat-label">Cenas (≤6s)</div>
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
    showLoading('Gerando prompts de cenas em movimento...', `Processando ${state.scenes.length} cenas com referência de ${state.elements.length} elementos`);
    setProgress(5);

    try {
        const res = await fetch('/api/generate-scenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scenes: state.scenes,
                elements: state.elements,
                style: state.selectedStyle
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
    list.innerHTML = state.scenePrompts.map((sp, i) => {
        const scene = state.scenes[i] || {};
        return `
      <div class="scene-card">
        <div class="scene-card-header">
          <span class="scene-number">Cena ${sp.sceneNumber}</span>
          <span class="scene-time">${scene.startTime || ''} → ${scene.endTime || ''} (${scene.duration ? (scene.duration / 1000).toFixed(1) + 's' : ''})</span>
        </div>
        <div class="scene-narration">"${scene.narration || ''}"</div>
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
