# 🤖 Resonance Telegram Bot - Complete Guide

## Overview

Telegram is great for:
- Inline sharing (share vibes in any chat)
- Group engagement
- News channel for updates
- Direct user communication
- No rate limits on your own bot

---

## 🎯 Top 5 Features for Resonance

### 1. Inline Vibe Sharing
```
User types in ANY chat: @ResonanceBot vibe
Bot shows: Card with current song + mood
Result: Beautiful shareable card drives curiosity
```

### 2. /start - Onboarding Flow
```
User: /start
Bot: Welcome sequence:
  1. "Hey! 👋 I'm Resonance Bot"
  2. "I help you find music soulmates"
  3. "Connect your Spotify to get started"
  4. [Connect Button] → App OAuth
```

### 3. /nearby - Tease Discovery
```
User: /nearby
Bot: "🔍 Right now, 47 people near you are vibing!
Top mood: Chill (34%)
Discover them on Resonance 👇"
[Open App Button]
```

### 4. /drop - Quick Capsule
```
User: /drop
Bot: "💊 Dropping your current song..."
Shows: Song card + "Dropped at [City]!"
"Others nearby can discover this on the app"
```

### 5. /notify - Alert Settings
```
User: /notify on
Bot: "🔔 You'll get alerts when:
- Someone with 80%+ match goes live near you
- Someone discovers your capsule
- New features drop"
```

---

## 🛠️ Technical Implementation

### Project Structure
```
resonance-telegram-bot/
├── src/
│   ├── commands/
│   │   ├── start.ts
│   │   ├── vibe.ts
│   │   ├── nearby.ts
│   │   ├── drop.ts
│   │   ├── notify.ts
│   │   └── help.ts
│   ├── inline/
│   │   └── vibeCard.ts
│   ├── services/
│   │   ├── resonance-api.ts
│   │   └── user-store.ts
│   ├── utils/
│   │   └── keyboards.ts
│   ├── config.ts
│   └── index.ts
├── .env
├── package.json
└── tsconfig.json
```

### Dependencies
```json
{
  "dependencies": {
    "node-telegram-bot-api": "^0.64.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/node-telegram-bot-api": "^0.64.0"
  }
}
```

### Environment Variables
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
RESONANCE_API_URL=https://your-backend.com/api/v1
RESONANCE_APP_URL=https://your-frontend.com
```

---

## 📝 Full Code Implementation

### index.ts - Main Bot File
```typescript
import TelegramBot from 'node-telegram-bot-api';
import { config } from 'dotenv';
import { handleStart } from './commands/start';
import { handleVibe } from './commands/vibe';
import { handleNearby } from './commands/nearby';
import { handleDrop } from './commands/drop';
import { handleNotify } from './commands/notify';
import { handleInlineQuery } from './inline/vibeCard';

config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

console.log('🎵 Resonance Telegram Bot is running...');

// Command handlers
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/vibe/, (msg) => handleVibe(bot, msg));
bot.onText(/\/nearby/, (msg) => handleNearby(bot, msg));
bot.onText(/\/drop/, (msg) => handleDrop(bot, msg));
bot.onText(/\/notify (.+)/, (msg, match) => handleNotify(bot, msg, match?.[1]));
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🎵 *Resonance Bot Commands*

/vibe - Share your current music vibe
/nearby - See how many listeners are near you
/drop - Drop your song as a time capsule
/notify on/off - Toggle notifications
/help - Show this message

💡 *Inline Mode*
Type @ResonanceBot in any chat to share your vibe!
  `, { parse_mode: 'Markdown' });
});

// Inline query handler (for sharing in any chat)
bot.on('inline_query', (query) => handleInlineQuery(bot, query));

// Callback query handler (for button clicks)
bot.on('callback_query', async (query) => {
  const data = query.data;
  
  if (data === 'connect_spotify') {
    const userId = query.from.id;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message!.chat.id, 
      `🔗 Connect your Spotify:\n${process.env.RESONANCE_APP_URL}/auth?telegram=${userId}`,
      { 
        reply_markup: {
          inline_keyboard: [[
            { text: '🎵 Open Resonance', url: `${process.env.RESONANCE_APP_URL}/auth?telegram=${userId}` }
          ]]
        }
      }
    );
  }
  
  if (data === 'open_app') {
    await bot.answerCallbackQuery(query.id, { url: process.env.RESONANCE_APP_URL });
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
```

### commands/start.ts
```typescript
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export async function handleStart(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || 'there';

  // Check if user already connected
  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/telegram/user/${userId}`
    );
    
    if (response.data.connected) {
      // User already connected
      await bot.sendMessage(chatId, `
Welcome back, ${username}! 🎵

Your Spotify is connected. Here's what you can do:

/vibe - Share what you're listening to
/nearby - See listeners around you
/drop - Drop a song capsule

Or type @ResonanceBot in any chat to share your vibe inline!
      `);
      return;
    }
  } catch (e) {
    // User not found, continue with onboarding
  }

  // Onboarding sequence
  await bot.sendMessage(chatId, `
Hey ${username}! 👋

I'm the *Resonance Bot* - your gateway to finding music soulmates!

🎵 *What is Resonance?*
An app that connects you with people nearby based on what you're listening to RIGHT NOW.

Ready to discover your music tribe?
  `, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🔗 Connect Spotify', callback_data: 'connect_spotify' }
      ], [
        { text: '📱 Open App', url: process.env.RESONANCE_APP_URL! }
      ]]
    }
  });
}
```

### commands/vibe.ts
```typescript
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export async function handleVibe(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/telegram/user/${userId}/current-track`
    );

    if (response.data.track) {
      const { track, mood } = response.data;
      
      const moodEmoji: Record<string, string> = {
        energetic: '🔥',
        chill: '😌',
        melancholic: '💜',
        euphoric: '✨',
        focused: '🎯'
      };

      await bot.sendPhoto(chatId, track.albumArt, {
        caption: `
${moodEmoji[mood] || '🎵'} *${mood.toUpperCase()} VIBES*

🎧 *${track.name}*
👤 ${track.artist}

Share your vibe: Type @ResonanceBot in any chat!
        `,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔍 Find Similar Vibes', url: `${process.env.RESONANCE_APP_URL}/match` }
          ]]
        }
      });
    } else {
      await bot.sendMessage(chatId, 
        "🎵 You're not playing anything right now!\n\nStart some music on Spotify and try again.",
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎧 Open Spotify', url: 'https://open.spotify.com' }
            ]]
          }
        }
      );
    }
  } catch (error) {
    await bot.sendMessage(chatId, 
      "🔗 Connect your Spotify first!",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔗 Connect Now', url: `${process.env.RESONANCE_APP_URL}/auth?telegram=${userId}` }
          ]]
        }
      }
    );
  }
}
```

### commands/nearby.ts
```typescript
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export async function handleNearby(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/telegram/user/${userId}/nearby-stats`
    );

    const { nearbyCount, topMood, topGenre } = response.data;

    await bot.sendMessage(chatId, `
🔍 *Nearby Right Now*

👥 *${nearbyCount}* listeners in your area
🎭 Top Mood: *${topMood}*
🎵 Popular Genre: *${topGenre}*

Someone with your vibe might be just around the corner!
    `, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗺️ See Live Map', url: `${process.env.RESONANCE_APP_URL}/` }
        ], [
          { text: '🎯 Find Matches', url: `${process.env.RESONANCE_APP_URL}/match` }
        ]]
      }
    });
  } catch (error) {
    await bot.sendMessage(chatId, 
      "📍 Enable location in the app to see nearby listeners!",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📱 Open App', url: process.env.RESONANCE_APP_URL! }
          ]]
        }
      }
    );
  }
}
```

### commands/drop.ts
```typescript
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export async function handleDrop(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  await bot.sendMessage(chatId, "💊 Dropping your current song...");

  try {
    const response = await axios.post(
      `${process.env.RESONANCE_API_URL}/telegram/drop`,
      { telegramUserId: userId }
    );

    const { track, location } = response.data;

    await bot.sendPhoto(chatId, track.albumArt, {
      caption: `
💊 *Song Dropped!*

🎵 *${track.name}*
👤 ${track.artist}
📍 Dropped near ${location}

Others nearby can discover this on Resonance!
      `,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🗺️ See Your Drops', url: `${process.env.RESONANCE_APP_URL}/capsules/mine` }
        ]]
      }
    });
  } catch (error) {
    await bot.sendMessage(chatId, 
      "Could not drop. Make sure you're connected and playing music!",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔗 Connect Spotify', url: `${process.env.RESONANCE_APP_URL}/auth?telegram=${userId}` }
          ]]
        }
      }
    );
  }
}
```

### inline/vibeCard.ts - Inline Sharing
```typescript
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export async function handleInlineQuery(bot: TelegramBot, query: TelegramBot.InlineQuery) {
  const userId = query.from.id;

  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/telegram/user/${userId}/current-track`
    );

    if (response.data.track) {
      const { track, mood } = response.data;
      
      const results: TelegramBot.InlineQueryResultArticle[] = [{
        type: 'article',
        id: '1',
        title: `🎵 Share: ${track.name}`,
        description: `${track.artist} • ${mood} vibes`,
        thumb_url: track.albumArt,
        input_message_content: {
          message_text: `
🎵 *Currently Vibing*

${getMoodEmoji(mood)} *${track.name}*
👤 ${track.artist}
💭 Feeling ${mood}

_Shared via Resonance - Find your music soulmate_
🔗 resonance.app
          `,
          parse_mode: 'Markdown'
        },
        reply_markup: {
          inline_keyboard: [[
            { text: '🎧 Listen on Spotify', url: `https://open.spotify.com/track/${track.id}` }
          ], [
            { text: '📱 Get Resonance', url: process.env.RESONANCE_APP_URL! }
          ]]
        }
      }];

      await bot.answerInlineQuery(query.id, results, { cache_time: 30 });
    } else {
      const results: TelegramBot.InlineQueryResultArticle[] = [{
        type: 'article',
        id: '1',
        title: '🎵 Not playing anything',
        description: 'Start some music on Spotify first!',
        input_message_content: {
          message_text: 'I\'m not playing anything right now. Check out Resonance to find music soulmates! 🎵\n\nresonance.app'
        }
      }];

      await bot.answerInlineQuery(query.id, results, { cache_time: 10 });
    }
  } catch (error) {
    const results: TelegramBot.InlineQueryResultArticle[] = [{
      type: 'article',
      id: '1',
      title: '🔗 Connect to share vibes',
      description: 'Link your Spotify on Resonance',
      input_message_content: {
        message_text: `Check out Resonance - find people nearby who share your music taste! 🎵\n\n${process.env.RESONANCE_APP_URL}`
      }
    }];

    await bot.answerInlineQuery(query.id, results, { cache_time: 60 });
  }
}

function getMoodEmoji(mood: string): string {
  const emojis: Record<string, string> = {
    energetic: '🔥',
    chill: '😌',
    melancholic: '💜',
    euphoric: '✨',
    focused: '🎯'
  };
  return emojis[mood] || '🎵';
}
```

---

## 🎮 Auto-Manipulation Features

### 1. Push Notifications to Users
```typescript
// When high-match user goes live nearby:
bot.sendMessage(userId, `
🔔 *Match Alert!*

Someone with 89% match just went live near you!
They're listening to indie rock right now 🎸

Open Resonance to discover them!
`, { 
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [[
      { text: '👀 See Who', url: `${process.env.RESONANCE_APP_URL}/` }
    ]]
  }
});
```

### 2. Daily Digest
```typescript
// Send at 7 PM:
"📊 Your Daily Vibe Report

Today you matched with 3 new people
Your most compatible: @username (91%)
Top shared genre: Lo-fi

Keep vibing! 🎵"
```

### 3. Capsule Discovery Alerts
```typescript
// When someone discovers user's capsule:
"💊 Someone found your capsule!

Your drop of 'Blinding Lights' was discovered by someone nearby!
They liked it 💜

See who's discovering your drops →"
```

### 4. Weekly Challenge
```typescript
// Monday morning:
"🎯 Weekly Challenge

This week: Drop 5 capsules at different spots
Reward: "Explorer" badge on your profile

Start dropping: /drop"
```

---

## 📊 Conversion Metrics

| Action | Tracks | Purpose |
|--------|--------|---------|
| /start | New user count | Onboarding funnel |
| Connect click | Conversion to app | Main KPI |
| /vibe usage | Engagement | Feature adoption |
| Inline shares | Virality | Word of mouth |

---

## 🚀 Deployment

Same as Discord - Railway, Heroku, or your own server with PM2.

```bash
# Create bot with BotFather
1. Message @BotFather on Telegram
2. /newbot
3. Name: Resonance Bot
4. Username: ResonanceVibeBot
5. Copy token to .env
```

---

## ✅ Summary

| Feature | Purpose | Conversion Driver |
|---------|---------|-------------------|
| /start | Onboarding | Direct Spotify connect button |
| /vibe | Engagement | "Find Similar" button |
| /nearby | FOMO | "See Live Map" button |
| /drop | Uses app feature | Links to app |
| Inline | Viral sharing | Every share = ad |
| Notifications | Re-engagement | Brings users back |
