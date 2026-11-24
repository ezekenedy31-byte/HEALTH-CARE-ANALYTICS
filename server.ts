import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FunctionDeclaration, GoogleGenAI, Type, type Content } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

const triggerForecastTool: FunctionDeclaration = {
  name: 'triggerDashboardForecast',
  description:
    'Updates the interactive forecast chart in the hospital operations dashboard when the user asks to forecast, predict, or project future admissions/demand, bed occupancy, or staffing requirements.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      horizonDays: {
        type: Type.NUMBER,
        description: 'Number of days to project into the future (between 7 and 30; default 14 for two weeks).',
      },
      metric: {
        type: Type.STRING,
        description:
          'Metric to forecast: "demand" for admissions/patients handled, "occupancy" for bed occupancy percentage, or "staffing" for required shift staffing levels.',
      },
      department: {
        type: Type.STRING,
        description:
          'Optional specific department name (e.g., "Emergency", "Cardiology", "Maternity") or "All" for hospital-wide.',
      },
    },
    required: ['horizonDays', 'metric'],
  },
};

interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface ForecastActionPayload {
  horizonDays: number;
  metric: 'demand' | 'occupancy' | 'staffing';
  department?: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(analyticsContext: Record<string, unknown>): string {
  return [
    'You are the clinical operations analytics assistant embedded inside Meridian Hospital Operations.',
    'Answer leadership questions strictly and accurately using ONLY the computed JSON dataset snapshot provided below.',
    '',
    'STRICT GROUNDING & CITATION RULES:',
    '1. Every numeric answer MUST come directly from the provided dataset snapshot. Never guess, extrapolate undocumented metrics, or fabricate records.',
    '2. Always cite the exact data scope you used (for example: "Based on 3,650 daily department logs and 1,200 patient encounters from 2025-01-01 to 2025-12-31").',
    '3. If a question asks for information, columns, or dates NOT present in the loaded datasets (such as medication inventory, lab turnaround times, ambulance GPS, or unrecorded future events), clearly state what is missing and list what operational fields ARE available instead of inventing numbers.',
    '4. Notice whether OvertimeHours_Logged is 0.0 across the dataset — if asked about overtime, report the exact logged overtime figure (e.g., 0.0 hrs) truthfully, and optionally reference staffing shortfalls vs shift targets or patient-to-staff ratios if relevant.',
    '5. When the user asks to forecast or predict future admissions, demand, bed occupancy, or staffing needs (e.g., "next 2 weeks", "next 30 days"), call the `triggerDashboardForecast` tool with the requested horizonDays (clamped 7-30), metric, and department, then clearly label all projected numbers as estimates based on the Holt exponential smoothing + day-of-week seasonality model.',
    '6. Keep responses crisp, executive-ready, structured with bullet points where helpful, and scannable.',
    '',
    'LOADED DATASET SNAPSHOT (JSON):',
    JSON.stringify(analyticsContext),
  ].join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/chat', async (req, res) => {
    try {
      const body = req.body as {
        message?: unknown;
        history?: unknown;
        analyticsContext?: unknown;
      };

      if (typeof body?.message !== 'string' || body.message.trim().length === 0) {
        return res.status(400).json({ error: 'A non-empty question string is required.' });
      }
      if (body.message.length > 2000) {
        return res.status(400).json({ error: 'Message exceeds 2,000 character limit.' });
      }
      if (!body.analyticsContext || typeof body.analyticsContext !== 'object' || Array.isArray(body.analyticsContext)) {
        return res.status(400).json({ error: 'Valid analyticsContext object is required.' });
      }

      const safeHistory: ChatHistoryTurn[] = Array.isArray(body.history)
        ? body.history
            .slice(-10)
            .filter(
              (t): t is ChatHistoryTurn =>
                Boolean(t) &&
                typeof t === 'object' &&
                (t.role === 'user' || t.role === 'assistant') &&
                typeof t.text === 'string' &&
                t.text.trim().length > 0
            )
        : [];

      const ai = getGeminiClient();
      const systemInstruction = buildSystemInstruction(body.analyticsContext as Record<string, unknown>);

      const contents: Content[] = [
        ...safeHistory.map((turn) => ({
          role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: turn.text.slice(0, 2000) }],
        })),
        {
          role: 'user',
          parts: [{ text: body.message.trim() }],
        },
      ];

      const response1 = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [triggerForecastTool] }],
        },
      });

      const firstContent = response1.candidates?.[0]?.content;
      const forecastCall = firstContent?.parts?.find((p) => p.functionCall?.name === 'triggerDashboardForecast')?.functionCall;

      let forecastAction: ForecastActionPayload | undefined;
      let finalReplyText = response1.text || '';

      if (firstContent && forecastCall) {
        const rawArgs = (forecastCall.args || {}) as Record<string, unknown>;
        const rawHorizon = typeof rawArgs.horizonDays === 'number' ? rawArgs.horizonDays : 14;
        const horizonDays = Math.max(7, Math.min(30, Math.round(rawHorizon)));
        const rawMetric = typeof rawArgs.metric === 'string' ? rawArgs.metric : 'demand';
        const metric: 'demand' | 'occupancy' | 'staffing' =
          rawMetric === 'occupancy' || rawMetric === 'staffing' ? rawMetric : 'demand';
        const department = typeof rawArgs.department === 'string' && rawArgs.department.trim() ? rawArgs.department.trim() : undefined;

        forecastAction = { horizonDays, metric, department };

        const response2 = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [
            ...contents,
            firstContent,
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    id: forecastCall.id,
                    name: 'triggerDashboardForecast',
                    response: {
                      status: 'updated_dashboard_forecast',
                      appliedHorizonDays: horizonDays,
                      appliedMetric: metric,
                      appliedDepartment: department || 'current_filter',
                      modelUsed: 'Damped Holt Exponential Smoothing + Day-of-Week Seasonality (95% CI)',
                    },
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: [triggerForecastTool] }],
          },
        });

        finalReplyText = response2.text || finalReplyText;
      }

      if (!finalReplyText.trim()) {
        return res.status(502).json({ error: 'AI service returned an empty response.' });
      }

      return res.json({
        reply: finalReplyText.trim(),
        forecastAction,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected server error while querying Gemini.';
      console.error('[/api/chat] Error:', message);
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Hospital Operations server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
