require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3500;

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories exist
const dataDir = process.cwd();
const dirs = ['uploads', 'output', 'output/elements', 'output/scenes'];
dirs.forEach(dir => {
  const dirPath = path.join(dataDir, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Multer config for SRT upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.srt') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .srt são aceitos'));
    }
  }
});

// =============== SRT PARSING ===============

function parseSRT(content) {
  const blocks = content.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  const entries = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );
    if (!timeMatch) continue;

    const startMs = timeToMs(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const endMs = timeToMs(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    const text = lines.slice(2).join(' ').trim();

    entries.push({ index, startMs, endMs, startTime: lines[1].split('-->')[0].trim(), endTime: lines[1].split('-->')[1].trim(), text });
  }

  return entries;
}

function timeToMs(h, m, s, ms) {
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

function msToTime(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mil = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${mil}`;
}

function timeStrToMs(str) {
  if (!str || str.toLowerCase() === 'fim') return Infinity;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
}

// Split SRT into sections based on the user's defined time blocks
function splitIntoScenes(entries, densityRules = [], totalDurationMs = 0) {
  const sections = [];
  let sectionIndex = 1;

  if (entries.length === 0) return sections;

  for (const rule of densityRules) {
    let startMs = rule.startMs;
    let endMs = isFinite(rule.endMs) ? rule.endMs : totalDurationMs;
    endMs = Math.max(startMs, endMs);

    const bucketEntries = [];
    for (const entry of entries) {
      const entryMid = entry.startMs + (entry.endMs - entry.startMs) / 2;
      if (entryMid >= startMs && entryMid < endMs) {
        bucketEntries.push(entry.text);
      }
    }

    // Edge case: if it's the last rule, sweep the rest
    if (rule === densityRules[densityRules.length - 1]) {
      for (const entry of entries) {
        const entryMid = entry.startMs + (entry.endMs - entry.startMs) / 2;
        if (entryMid >= endMs) {
          if (!bucketEntries.includes(entry.text)) {
            bucketEntries.push(entry.text);
          }
        }
      }
    }

    sections.push({
      sceneNumber: sectionIndex++,
      startMs: startMs,
      endMs: endMs,
      startTime: msToTime(startMs).split(',')[0],
      endTime: isFinite(rule.endMs) ? msToTime(endMs).split(',')[0] : 'Fim',
      duration: endMs - startMs,
      targetImages: rule.density || 1,
      narration: bucketEntries.join(' ').trim() || "(Nenhuma narração neste trecho)"
    });
  }

  return sections;
}

// =============== OPENAI FUNCTIONS ===============

async function analyzeStory(fullText) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert story analyst and visual director. You analyze narratives to extract every visual element needed for consistent image generation.

You MUST respond in valid JSON format with this exact structure:
{
  "characters": [
    {
      "id": "char_unique_id",
      "name": "Character Name",
      "type": "character",
      "description": "Extremely detailed physical description including: approximate age, gender, ethnicity/skin tone, height/build, hair color/style/length, eye color/shape, facial features (nose, lips, jaw, cheekbones), distinguishing marks (scars, tattoos, freckles), typical posture/bearing",
      "clothing": "Detailed description of typical clothing: colors, materials, textures, patterns, accessories, shoes, jewelry",
      "personality_visual_cues": "How their personality shows visually: expressions, gestures, movement style",
      "recurring_props": "Objects they carry or are associated with"
    }
  ],
  "locations": [
    {
      "id": "loc_unique_id",
      "name": "Location Name",
      "type": "location",
      "description": "Extremely detailed description: architecture style, materials (stone, wood, metal), colors, textures, scale/dimensions, notable features",
      "lighting": "Natural/artificial, time of day feel, shadow quality, light color temperature",
      "atmosphere": "Mood, temperature feel, sounds implied visually, weather",
      "details": "Small details: furniture, decorations, vegetation, wear/aging, stains, cracks"
    }
  ],
  "objects": [
    {
      "id": "obj_unique_id",
      "name": "Object Name",
      "type": "object",
      "description": "Detailed description: shape, size, material, color, texture, wear/condition, glow/special properties",
      "significance": "Role in the story, how it interacts with characters"
    }
  ],
  "environment": {
    "id": "env_global",
    "name": "Global Environment",
    "type": "environment",
    "era": "Time period/era of the story",
    "world_type": "Fantasy, sci-fi, realistic, etc.",
    "color_palette": "Dominant colors throughout the story",
    "mood": "Overall mood/tone",
    "weather_patterns": "Typical weather described or implied",
    "technology_level": "Technology level visible"
  }
}

Be EXTREMELY detailed in descriptions. Every element must have enough visual detail to generate consistent images. Do not summarize - be specific and thorough. Infer visual details from context when not explicitly stated. Write all descriptions in English for image generation compatibility.`
      },
      {
        role: 'user',
        content: `Analyze this complete narration and extract ALL visual elements. Be exhaustive and extremely detailed in physical descriptions:\n\n${fullText}`
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}

async function generateElementPrompt(element, style) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert visual prompt engineer specializing in consistent character/location/object design sheets.

Generate a COMPLETE, DETAILED image generation prompt for this element in the "${style}" visual style. 

Rules:
- NO summaries or abbreviations. Every visual detail must be explicitly written out.
- Include ALL physical details from the description.
- Include the visual style consistently.
- The prompt must be self-contained - reading it alone should produce the same result every time.
- Write in English.
- Do NOT use markdown formatting. Write as a single flowing prompt description.
- For characters: describe as a full-body character reference sheet showing front and 3/4 views.
- For locations: describe as an establishing shot/wide angle view.
- For objects: describe as a detailed close-up with context.

Respond with ONLY the prompt text, nothing else.`
      },
      {
        role: 'user',
        content: `Element type: ${element.type}\nName: ${element.name}\nFull description: ${JSON.stringify(element)}\nVisual style: ${style}`
      }
    ],
    temperature: 0.4,
    max_tokens: 1000
  });

  return response.choices[0].message.content.trim();
}

async function generateScenePrompts(trechos, elements, style, fullText) {
  // Build element reference map
  const allElementsRef = elements.map(el => `[${el.id}]: ${el.name} - ${el.prompt}`).join('\n\n');

  const scenePrompts = [];
  let globalSceneNumber = 1;

  console.log(`Buscando prompts para ${trechos.length} trechos selecionados...`);

  for (const trecho of trechos) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert motion-image scene prompt engineer. You create prompts for animated/motion scenes that maintain perfect visual consistency across an entire story.

CRITICAL RULES:
1. Every scene prompt MUST include the COMPLETE, UNABRIDGED descriptions of every element (character, location, object) that appears in that scene. Copy them EXACTLY from the reference descriptions - do NOT summarize, shorten, or paraphrase.
2. Add motion/action descriptions: camera movement, character actions, environmental motion (wind, particles, light changes).
3. Include the visual style "${style}" in every prompt.
4. Describe the specific moment and emotion of the scene.
5. Include lighting, atmosphere, and mood for each scene.
6. Write in English.
7. Do NOT use markdown formatting. Each prompt should be plain text.

ELEMENT REFERENCE DESCRIPTIONS (use these EXACTLY in scene prompts when the element appears):
${allElementsRef}

You will be given a section of the story's narration, and you MUST generate EXACTLY the requested number of image prompts that evenly cover the narrative progression of this section. Ensure the chronological sequence flows logically.

Respond in JSON format:
{
  "scenes": [
    {
      "prompt": "Complete scene prompt with full element descriptions included inline..."
    }
  ]
}`
        },
        {
          role: 'user',
          content: `STORY CONTEXT (Full Text - For Reference):
${fullText}

---

CURRENT SECTION TO PROCESS:
Time range: ${trecho.startTime} to ${trecho.endTime}
Requested Number of Images: EXACTLY ${trecho.targetImages} images for this section.

NARRATION FOR THIS NOVEL SECTION:
${trecho.narration}

Please generate EXACTLY ${trecho.targetImages} image prompts that visually translate this section's narration in sequential order. Make sure you output an array of exactly ${trecho.targetImages} items in the "scenes" array.`
        }
      ],
      temperature: 0.5,
      max_tokens: 12000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Assign global scene numbers and attach trecho details
    for (const s of result.scenes) {
      scenePrompts.push({
        sceneNumber: globalSceneNumber++,
        prompt: s.prompt,
        startTime: trecho.startTime,
        endTime: trecho.endTime,
        narration: trecho.narration
      });
    }
  }

  return scenePrompts;
}

// =============== ROUTES ===============

// Upload SRT
app.post('/api/upload', upload.single('srt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    let rawRules = [];
    try {
      if (req.body.densityRules) {
        rawRules = JSON.parse(req.body.densityRules);
      }
    } catch (e) {
      console.error("Erro parsing densityRules", e);
    }

    if (rawRules.length === 0) {
      rawRules = [{ start: '00:00', end: 'Fim', density: 10 }];
    }

    const densityRules = rawRules.map(r => ({
      startMs: timeStrToMs(r.start),
      endMs: r.end ? timeStrToMs(r.end) : Infinity,
      density: parseInt(r.density) || 10
    }));

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const entries = parseSRT(content);

    // Get total duration beforehand
    const totalDuration = entries.length > 0 ? entries[entries.length - 1].endMs : 0;

    const scenes = splitIntoScenes(entries, densityRules, totalDuration);
    const fullText = entries.map(e => e.text).join(' ');

    res.json({
      success: true,
      filename: req.file.originalname,
      densityRules,
      totalEntries: entries.length,
      totalScenes: densityRules.reduce((sum, rule) => sum + (parseInt(rule.density) || 0), 0),
      totalDuration,
      totalDurationFormatted: msToTime(totalDuration),
      fullText,
      scenes
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Analyze story
app.post('/api/analyze', async (req, res) => {
  try {
    const { fullText } = req.body;
    if (!fullText) return res.status(400).json({ error: 'Texto não fornecido' });

    const elements = await analyzeStory(fullText);

    // Save elements to individual files
    const allElements = [];

    if (elements.characters) {
      for (const char of elements.characters) {
        const filePath = path.join(process.cwd(), 'output', 'elements', `${char.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(char, null, 2));
        allElements.push(char);
      }
    }

    if (elements.locations) {
      for (const loc of elements.locations) {
        const filePath = path.join(process.cwd(), 'output', 'elements', `${loc.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(loc, null, 2));
        allElements.push(loc);
      }
    }

    if (elements.objects) {
      for (const obj of elements.objects) {
        const filePath = path.join(process.cwd(), 'output', 'elements', `${obj.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        allElements.push(obj);
      }
    }

    if (elements.environment) {
      const env = elements.environment;
      const filePath = path.join(process.cwd(), 'output', 'elements', `${env.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(env, null, 2));
      allElements.push(env);
    }

    res.json({ success: true, elements: allElements });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate element prompts with style
app.post('/api/generate-element-prompts', async (req, res) => {
  try {
    const { elements, style } = req.body;
    if (!elements || !style) return res.status(400).json({ error: 'Elementos e estilo são obrigatórios' });

    const updatedElements = [];

    for (const element of elements) {
      const prompt = await generateElementPrompt(element, style);
      element.prompt = prompt;

      // Save updated element
      const filePath = path.join(process.cwd(), 'output', 'elements', `${element.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(element, null, 2));

      updatedElements.push(element);
    }

    res.json({ success: true, elements: updatedElements });
  } catch (err) {
    console.error('Element prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a single element
app.put('/api/elements/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updatedElement = req.body;

    const filePath = path.join(process.cwd(), 'output', 'elements', `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(updatedElement, null, 2));

    res.json({ success: true, element: updatedElement });
  } catch (err) {
    console.error('Update element error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete an element
app.delete('/api/elements/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(process.cwd(), 'output', 'elements', `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete element error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add new element
app.post('/api/elements', async (req, res) => {
  try {
    const { element, style } = req.body;

    // Generate prompt for new element
    const prompt = await generateElementPrompt(element, style);
    element.prompt = prompt;

    const filePath = path.join(process.cwd(), 'output', 'elements', `${element.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(element, null, 2));

    res.json({ success: true, element });
  } catch (err) {
    console.error('Add element error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-scenes', async (req, res) => {
  try {
    const { scenes, elements, style, fullText } = req.body;
    if (!scenes || !elements || !style) {
      return res.status(400).json({ error: 'Cenas, elementos e estilo são obrigatórios' });
    }

    const scenePrompts = await generateScenePrompts(scenes, elements, style, fullText || '');

    // Save to file with empty line between prompts
    const outputText = scenePrompts.map((sp, i) => {
      return `[Scene ${sp.sceneNumber} | ${scenes[i]?.startTime || ''} → ${scenes[i]?.endTime || ''}]\n${sp.prompt}`;
    }).join('\n\n');

    const outputPath = path.join(process.cwd(), 'output', 'scenes', `scene_prompts_${Date.now()}.txt`);
    fs.writeFileSync(outputPath, outputText, 'utf-8');

    // Also save a clean version (prompts only, no headers)
    const cleanText = scenePrompts.map(sp => sp.prompt).join('\n\n');
    const cleanPath = path.join(process.cwd(), 'output', 'scenes', `scene_prompts_clean_${Date.now()}.txt`);
    fs.writeFileSync(cleanPath, cleanText, 'utf-8');

    res.json({
      success: true,
      scenePrompts,
      outputFile: outputPath,
      cleanFile: cleanPath
    });
  } catch (err) {
    console.error('Scene generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download scene prompts file
app.get('/api/download-scenes/:filename', (req, res) => {
  const filePath = path.join(process.cwd(), 'output', 'scenes', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
  });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🎬 PromptsParaHistorias rodando em ${url}`);
  console.log(`   API Key configurada: ${!!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'}`);

  // Abrir navegador automaticamente no Windows
  require('child_process').exec(`start ${url}`);
});
