/**
 * Generate showcase transcript by running scripted user messages
 * through the real Nora API.
 *
 * Prerequisites:
 *   1. nora-mobile server running: node server.js
 *   2. Aalto VPN connected + AALTO_API_KEY set
 *   3. (Optional) Luca server running on :8001 if trip_research is needed
 *
 * Usage:
 *   node scripts/generate-showcase.js
 *
 * Output:
 *   public/data/showcase-transcript.json
 *
 * After generation, manually review and polish the output:
 *   - Adjust Nora's wording if needed
 *   - Set pickedChip values on user turns
 *   - Verify card data looks realistic
 *   - Add isConfirm: true to the confirm user turn
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const OUTPUT = join(__dirname, '..', 'public', 'data', 'showcase-transcript.json');

// ── Scripted conversations ────────────────────────────────────────────────

const CONVERSATIONS = [
  {
    id: 'emma_japan',
    profile: {
      userId: 'showcase_emma',
      firstName: 'Emma',
      fullName: 'Emma',
      tagline: 'Saving for a trip to Japan',
    },
    demoMode: 'scripted_emma',
    userMessages: [
      { text: 'I want to save for a trip to Japan next summer', pickedChip: 'A trip to Japan' },
      { text: 'Should I put this in a fund or just savings?', pickedChip: 'Should I put this in a fund or just savings?' },
      { text: 'Ok, build me a plan with savings', pickedChip: 'Ok, build me a plan with savings' },
      { text: "Looks good, let's set it up", pickedChip: "Looks good, let's set it up" },
      { text: 'Confirm — start saving', pickedChip: 'Confirm — start saving', isConfirm: true },
    ],
  },
  {
    id: 'aleksi_apartment',
    profile: {
      userId: 'showcase_aleksi',
      firstName: 'Aleksi',
      fullName: 'Aleksi',
      tagline: 'Saving for a first apartment',
    },
    // Use a test profile if Aleksi exists, otherwise scripted_emma
    demoMode: 'scripted_emma',
    userMessages: [
      { text: 'I want to buy my first apartment in about 3 years', pickedChip: 'First apartment' },
      { text: "Is putting money in funds actually safe? I've heard people lose everything", pickedChip: 'Is putting money in funds safe?' },
      { text: 'Ok, I feel better about that. Build me a plan', pickedChip: 'Ok, I feel better about that. Build me a plan' },
      { text: "Looks good, let's go", pickedChip: "Looks good, let's go" },
      { text: 'Confirm — start saving', pickedChip: 'Confirm — start saving', isConfirm: true },
    ],
  },
];

// ── Run one conversation ──────────────────────────────────────────────────

async function runConversation(conv) {
  console.log(`\n--- ${conv.id}: ${conv.profile.firstName} ---`);

  // Get first reply
  const firstRes = await fetch(`${API_BASE}/api/nora/first-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demoMode: conv.demoMode }),
  });
  const firstData = await firstRes.json();
  console.log(`  First reply: "${firstData.message?.slice(0, 60)}..."`);

  const result = {
    id: conv.id,
    profile: conv.profile,
    firstReply: {
      text: firstData.message,
      suggestedReplies: firstData.suggestedReplies || [],
    },
    turns: [],
  };

  // Accumulate state across turns
  const apiMessages = [];
  let memory = [];
  const invokedSoFar = [];
  let confirmed = false;

  // Add first reply to history
  apiMessages.push({ role: 'assistant', content: firstData.message });

  for (const userMsg of conv.userMessages) {
    // Add user message
    apiMessages.push({ role: 'user', content: userMsg.text });
    result.turns.push({
      from: 'user',
      text: userMsg.text,
      pickedChip: userMsg.pickedChip || null,
      ...(userMsg.isConfirm ? { isConfirm: true } : {}),
    });

    console.log(`  User: "${userMsg.text.slice(0, 50)}..."`);

    // Call Nora
    const sessionState = {
      confirmed,
      invokedSoFar: [...new Set(invokedSoFar)],
    };

    const res = await fetch(`${API_BASE}/api/nora/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        memory,
        sessionState,
        demoMode: conv.demoMode,
      }),
    });
    const data = await res.json();

    console.log(`  Nora: "${(data.message || '').slice(0, 60)}..." | cards: ${data.cards?.length || 0} | agents: ${data.invokedAgents?.join(', ') || 'none'}`);

    // Record Nora turn
    result.turns.push({
      from: 'nora',
      text: data.message || '',
      cards: data.cards || [],
      invokedAgents: data.invokedAgents || [],
      suggestedReplies: data.suggestedReplies || [],
      memoryUpdates: data.memoryUpdates || [],
    });

    // Update accumulated state
    apiMessages.push({ role: 'assistant', content: data.message || '' });
    if (data.memoryUpdates?.length) {
      memory = [...memory, ...data.memoryUpdates].slice(-12);
    }
    if (data.invokedAgents?.length) {
      invokedSoFar.push(...data.invokedAgents);
    }
    if (userMsg.isConfirm) {
      confirmed = true;
    }

    // Small delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating showcase transcript...');
  console.log(`API: ${API_BASE}`);

  const conversations = [];
  for (const conv of CONVERSATIONS) {
    const result = await runConversation(conv);
    conversations.push(result);
  }

  const transcript = {
    version: 1,
    generated: new Date().toISOString(),
    conversations,
  };

  writeFileSync(OUTPUT, JSON.stringify(transcript, null, 2));
  console.log(`\nWritten to: ${OUTPUT}`);
  console.log('Review the output and manually polish before committing.');
}

main().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
