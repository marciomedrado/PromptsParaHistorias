require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories exist
const dirs = ['uploads', 'output', 'output/elements', 'output/scenes'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Multer config for SRT upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
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

// Split SRT into 6-second max scenes
function splitIntoScenes(entries) {
  const MAX_SCENE_MS = 6000;
  const scenes = [];
  let sceneIndex = 1;

  for (const entry of entries) {
    const duration = entry.endMs - entry.startMs;

    if (duration <= MAX_SCENE_MS) {
      scenes.push({
        sceneNumber: sceneIndex++,
        startMs: entry.startMs,
        endMs: entry.endMs,
        startTime: msToTime(entry.startMs),
        endTime: msToTime(entry.endMs),
        duration: duration,
        narration: entry.text
      });
    } else {
      // Split into multiple scenes of max 6 seconds
      const numScenes = Math.ceil(duration / MAX_SCENE_MS);
      const words = entry.text.split(/\s+/);
      const wordsPerScene = Math.ceil(words.length / numScenes);

      for (let i = 0; i < numScenes; i++) {
        const sceneStartMs = entry.startMs + (i * MAX_SCENE_MS);
        const sceneEndMs = Math.min(entry.startMs + ((i + 1) * MAX_SCENE_MS), entry.endMs);
        const sceneWords = words.slice(i * wordsPerScene, (i + 1) * wordsPerScene);

        scenes.push({
          sceneNumber: sceneIndex++,
          startMs: sceneStartMs,
          endMs: sceneEndMs,
          startTime: msToTime(sceneStartMs),
          endTime: msToTime(sceneEndMs),
          duration: sceneEndMs - sceneStartMs,
          narration: sceneWords.join(' ')
        });
      }
    }
  }

  return scenes;
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

async function generateScenePrompts(scenes, elements, style) {
  // Build element reference map
  const elementMap = {};
  for (const el of elements) {
    elementMap[el.id] = el;
  }

  const allElementsRef = elements.map(el => `[${el.id}]: ${el.name} - ${el.prompt}`).join('\n\n');

  const scenePrompts = [];
  const batchSize = 5;

  for (let i = 0; i < scenes.length; i += batchSize) {
    const batch = scenes.slice(i, i + batchSize);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
8. Each scene represents a maximum of 6 seconds of motion.

ELEMENT REFERENCE DESCRIPTIONS (use these EXACTLY in scene prompts when the element appears):
${allElementsRef}

Respond in JSON format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "prompt": "Complete scene prompt with full element descriptions included inline..."
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Generate motion scene prompts for these scenes. For each scene, identify which elements appear and include their FULL descriptions from the reference:\n\n${JSON.stringify(batch.map(s => ({
            sceneNumber: s.sceneNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration + 'ms',
            narration: s.narration
          })))}`
        }
      ],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    scenePrompts.push(...result.scenes);
  }

  return scenePrompts;
}

// =============== ROUTES ===============

// Upload SRT
app.post('/api/upload', upload.single('srt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const entries = parseSRT(content);
    const scenes = splitIntoScenes(entries);
    const fullText = entries.map(e => e.text).join(' ');

    // Get total duration
    const totalDuration = entries.length > 0 ? entries[entries.length - 1].endMs : 0;

    res.json({
      success: true,
      filename: req.file.originalname,
      totalEntries: entries.length,
      totalScenes: scenes.length,
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
        const filePath = path.join(__dirname, 'output', 'elements', `${char.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(char, null, 2));
        allElements.push(char);
      }
    }

    if (elements.locations) {
      for (const loc of elements.locations) {
        const filePath = path.join(__dirname, 'output', 'elements', `${loc.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(loc, null, 2));
        allElements.push(loc);
      }
    }

    if (elements.objects) {
      for (const obj of elements.objects) {
        const filePath = path.join(__dirname, 'output', 'elements', `${obj.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        allElements.push(obj);
      }
    }

    if (elements.environment) {
      const env = elements.environment;
      const filePath = path.join(__dirname, 'output', 'elements', `${env.id}.json`);
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
      const filePath = path.join(__dirname, 'output', 'elements', `${element.id}.json`);
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
    
    const filePath = path.join(__dirname, 'output', 'elements', `${id}.json`);
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
    const filePath = path.join(__dirname, 'output', 'elements', `${id}.json`);
    
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
    
    const filePath = path.join(__dirname, 'output', 'elements', `${element.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(element, null, 2));
    
    res.json({ success: true, element });
  } catch (err) {
    console.error('Add element error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate scene prompts
app.post('/api/generate-scenes', async (req, res) => {
  try {
    const { scenes, elements, style } = req.body;
    if (!scenes || !elements || !style) {
      return res.status(400).json({ error: 'Cenas, elementos e estilo são obrigatórios' });
    }

    const scenePrompts = await generateScenePrompts(scenes, elements, style);
    
    // Save to file with empty line between prompts
    const outputText = scenePrompts.map((sp, i) => {
      return `[Scene ${sp.sceneNumber} | ${scenes[i]?.startTime || ''} → ${scenes[i]?.endTime || ''}]\n${sp.prompt}`;
    }).join('\n\n');
    
    const outputPath = path.join(__dirname, 'output', 'scenes', `scene_prompts_${Date.now()}.txt`);
    fs.writeFileSync(outputPath, outputText, 'utf-8');
    
    // Also save a clean version (prompts only, no headers)
    const cleanText = scenePrompts.map(sp => sp.prompt).join('\n\n');
    const cleanPath = path.join(__dirname, 'output', 'scenes', `scene_prompts_clean_${Date.now()}.txt`);
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
  const filePath = path.join(__dirname, 'output', 'scenes', req.params.filename);
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
  console.log(`\n🎬 PromptsParaHistorias rodando em http://localhost:${PORT}`);
  console.log(`   API Key configurada: ${!!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'}`);
});
