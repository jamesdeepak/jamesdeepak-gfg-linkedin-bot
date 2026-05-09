/**
 * Claude AI integration
 *  - solveProblem()   → Java code (3 escalating strategies)
 *  - generatePost()   → Motivational student LinkedIn post
 */
const axios  = require('axios');
const logger = require('./logger');

const MODEL = 'claude-sonnet-4-20250514';

async function _call(apiKey, prompt, maxTokens = 2000) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 90000
    }
  );
  return (res.data.content[0]?.text || '').trim();
}

/* ── 3-attempt solve strategy ──────────────────────────────────── */

const STRATEGIES = [
  // Attempt 1 — Optimal solution
  (p) => `You are an expert Java competitive programmer solving a GeeksforGeeks problem.

Problem Title: ${p.title}
Difficulty: ${p.difficulty}
URL: ${p.url}

Problem:
${p.statement}

Write the most optimal Java solution.
Return ONLY raw Java code. No markdown, no code fences, no explanation.
Write exactly what goes inside GFG's Solution class (the method + helpers).`,

  // Attempt 2 — Clear and careful, avoid edge case mistakes
  (p) => `You are solving a GeeksforGeeks problem in Java. A previous attempt was WRONG.

Problem Title: ${p.title}
Difficulty: ${p.difficulty}

Problem:
${p.statement}

PREVIOUS ATTEMPT FAILED. Use a different, more careful strategy.
- Re-read the problem statement very carefully
- Watch for edge cases: empty input, single element, duplicates, negative numbers
- Use a well-known algorithm that you are 100% sure is correct
- Verify your logic mentally before writing

Return ONLY raw Java code. No markdown fences, no explanation.`,

  // Attempt 3 — Brute force, guaranteed correct
  (p) => `You are solving a GeeksforGeeks problem in Java. Two previous attempts were WRONG.

Problem Title: ${p.title}
Difficulty: ${p.difficulty}

Problem:
${p.statement}

CRITICAL: Two attempts already failed. This is the final attempt.
Use the SIMPLEST, most straightforward brute-force approach that is guaranteed to be correct.
Forget optimization — correctness is the ONLY goal now.
Even O(n^2) or O(n^3) is fine.

Return ONLY raw Java code. No markdown fences. No explanation.`
];

async function solveProblem(apiKey, problem, attempt = 1) {
  logger.info(`Claude solving "${problem.title}" — attempt ${attempt}/3`);
  const prompt = STRATEGIES[attempt - 1](problem);
  const raw = await _call(apiKey, prompt, 2000);

  // Strip any accidental markdown fences
  return raw
    .replace(/^```java\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
}

/* ── LinkedIn post generator ────────────────────────────────────── */

async function generatePost(apiKey, problem, streakInfo) {
  logger.info('Generating LinkedIn post...');

  const prompt = `Write a technical and professional LinkedIn post for a software engineering student who solved today's GeeksforGeeks Problem of the Day.

Problem details:
- Title: ${problem.title}
- Difficulty: ${problem.difficulty}
- Language: Java
- Streak: ${streakInfo.streak} consecutive days
- Points: ${streakInfo.points}
- URL: ${problem.url}

Post requirements:
1. Opening line: state the problem name and day streak clearly (e.g. "Day ${streakInfo.streak} | ${problem.title}")
2. 2–3 sentences explaining: what algorithm/data structure this problem uses, the time/space complexity of the solution, and one key technical insight
3. One sentence about consistent daily practice
4. Blank line
5. Hashtags on final line — include: #DSA #Java #GeeksForGeeks #DataStructures #Algorithms #ProblemSolving #SoftwareEngineering #CodingChallenge

Tone: professional, technical, concise — like a software engineer sharing a learning note
Length: 120–160 words maximum
Return ONLY the post text. No quotes around it.`;

  try {
    return await _call(apiKey, prompt, 350);
  } catch (e) {
    logger.warn('Post generation failed — using fallback. ' + e.message);
    return [
      `Day ${streakInfo.streak} | ${problem.title}`,
      '',
      `Solved today's GFG Problem of the Day — a ${problem.difficulty} difficulty challenge implemented in Java.`,
      `This problem reinforces core data structures and algorithmic thinking. Consistent daily practice is the most reliable path to engineering excellence.`,
      '',
      `#DSA #Java #GeeksForGeeks #DataStructures #Algorithms #ProblemSolving #SoftwareEngineering #CodingChallenge`
    ].join('\n');
  }
}

module.exports = { solveProblem, generatePost };
