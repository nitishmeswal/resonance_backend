# 🐦 Resonance Twitter/X Automation - Complete Guide

## Overview

Twitter is best for:
- Viral content potential
- Hot takes and engagement bait
- Building brand voice
- Direct user interaction
- Trending topics hijacking

**⚠️ Limitations**:
- API costs money for high volume
- Free tier: 1,500 tweets/month
- Strict automation rules
- Can't DM without user opt-in

---

## 🎯 Top 5 Automation Features

### 1. Scheduled Content Posts
```
Daily 9 AM: Engagement tweet
Daily 7 PM: "Vibe of the day" stats
Weekly: Feature highlight
Random: Trending topic hijack
```

### 2. Auto-Reply to Keywords
```
Someone tweets: "wish I could find people with my music taste"
Bot replies: "That's literally what Resonance does! 🎵 [link]"
```

### 3. User Milestone Celebrations
```
When user hits milestone:
"🎉 @username just found their 10th music soulmate on Resonance!

Your vibe attracts your tribe ✨"
```

### 4. Stats Thread Generator
```
Weekly thread:
"🧵 This week on Resonance:

1/ 1,247 matches made through music
2/ Most popular mood: Chill (34%)
3/ Top genre: Indie Rock
4/ Longest match: 98% compatible 💕

Join us: resonance.app"
```

### 5. Meme Templates
```
Pre-approved templates:
- "POV: You find someone who listens to [niche artist]"
- "Dating apps: [photo]. Resonance: [playlist screenshot]"
- "When you match with someone who has the same 3am playlist 🥹"
```

---

## 🛠️ Technical Implementation

### Project Structure
```
resonance-twitter-bot/
├── src/
│   ├── schedulers/
│   │   ├── daily-vibes.ts
│   │   ├── weekly-stats.ts
│   │   └── content-queue.ts
│   ├── listeners/
│   │   ├── keyword-monitor.ts
│   │   └── mention-handler.ts
│   ├── generators/
│   │   ├── tweet-templates.ts
│   │   ├── meme-generator.ts
│   │   └── stats-thread.ts
│   ├── services/
│   │   ├── twitter-api.ts
│   │   └── resonance-api.ts
│   ├── content/
│   │   ├── templates.json
│   │   └── memes/
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
    "twitter-api-v2": "^1.15.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/node-cron": "^3.0.11"
  }
}
```

### Environment Variables
```env
# Twitter API v2 credentials
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# Resonance
RESONANCE_API_URL=https://your-backend.com/api/v1
RESONANCE_APP_URL=https://your-frontend.com
```

---

## 📝 Full Code Implementation

### index.ts - Main Bot
```typescript
import { TwitterApi } from 'twitter-api-v2';
import cron from 'node-cron';
import { config } from 'dotenv';
import { postDailyVibe } from './schedulers/daily-vibes';
import { postWeeklyStats } from './schedulers/weekly-stats';
import { monitorKeywords } from './listeners/keyword-monitor';
import { handleMentions } from './listeners/mention-handler';
import { processContentQueue } from './schedulers/content-queue';

config();

// Initialize Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

const rwClient = client.readWrite;

console.log('🐦 Resonance Twitter Bot starting...');

// ========== SCHEDULED POSTS ==========

// Daily vibe post at 7 PM IST
cron.schedule('0 19 * * *', async () => {
  console.log('📊 Posting daily vibe...');
  await postDailyVibe(rwClient);
}, { timezone: 'Asia/Kolkata' });

// Morning engagement post at 9 AM IST
cron.schedule('0 9 * * *', async () => {
  console.log('💬 Posting morning engagement...');
  await postEngagementTweet(rwClient);
}, { timezone: 'Asia/Kolkata' });

// Weekly stats thread on Sunday 12 PM
cron.schedule('0 12 * * 0', async () => {
  console.log('🧵 Posting weekly stats thread...');
  await postWeeklyStats(rwClient);
}, { timezone: 'Asia/Kolkata' });

// Process content queue every 2 hours
cron.schedule('0 */2 * * *', async () => {
  await processContentQueue(rwClient);
});

// ========== LISTENERS ==========

// Check mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await handleMentions(rwClient);
});

// Monitor keywords every 30 minutes (careful with rate limits)
cron.schedule('*/30 * * * *', async () => {
  await monitorKeywords(rwClient);
});

// ========== HELPER FUNCTIONS ==========

async function postEngagementTweet(client: TwitterApi) {
  const tweets = [
    "What's the first song you played today? 🎵\n\nReply and we'll find someone who played the same thing 👀",
    "Your music taste says more about you than your bio ever could.\n\nAgree or disagree? 🤔",
    "POV: You finally meet someone who knows all your favorite underground artists 🥹",
    "Hot take: Music compatibility > zodiac compatibility\n\nWho's with me? ✋",
    "The song you play on repeat at 2 AM defines you more than any personality test.\n\nWhat's yours? 🌙"
  ];
  
  const tweet = tweets[Math.floor(Math.random() * tweets.length)];
  
  try {
    await client.v2.tweet(tweet);
    console.log('✅ Engagement tweet posted');
  } catch (error) {
    console.error('❌ Failed to post:', error);
  }
}

console.log('✅ Twitter Bot is running!');
```

### schedulers/daily-vibes.ts
```typescript
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

export async function postDailyVibe(client: TwitterApi) {
  try {
    // Get stats from Resonance API
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/stats/daily`
    );
    
    const { 
      matchesMade, 
      topMood, 
      topGenre, 
      liveNow,
      capsuleDropped 
    } = response.data;

    const moodEmoji: Record<string, string> = {
      energetic: '🔥',
      chill: '😌',
      melancholic: '💜',
      euphoric: '✨',
      focused: '🎯'
    };

    const tweet = `📊 Today on Resonance:

${moodEmoji[topMood] || '🎵'} Vibe of the day: ${topMood}
🎧 Top genre: ${topGenre}
💕 ${matchesMade} matches made
💊 ${capsuleDropped} songs dropped
📍 ${liveNow} people live right now

Find your music soulmate 👇
resonance.app`;

    await client.v2.tweet(tweet);
    console.log('✅ Daily vibe posted');
    
  } catch (error) {
    console.error('❌ Daily vibe post failed:', error);
  }
}
```

### schedulers/weekly-stats.ts
```typescript
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

export async function postWeeklyStats(client: TwitterApi) {
  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/stats/weekly`
    );
    
    const {
      totalMatches,
      newUsers,
      topSong,
      topArtist,
      bestMatch,
      totalCapsules,
      topCity
    } = response.data;

    // Create thread
    const thread = [
      `🧵 This week on Resonance - a thread:\n\n💕 ${totalMatches.toLocaleString()} music soulmates found\n👥 ${newUsers.toLocaleString()} new vibers joined\n\nHere's what went down 👇`,
      
      `🎵 Most played this week:\n\n"${topSong.name}" by ${topSong.artist}\n\nThis song brought the most people together. Have you heard it?`,
      
      `🏆 Best match of the week:\n\n98% compatibility between two strangers who both love ${topArtist}!\n\nThey're now friends IRL. Music really does connect people. 💜`,
      
      `💊 Time Capsules:\n\n${totalCapsules} songs were "dropped" at locations this week.\n\nPeople are leaving musical breadcrumbs for strangers to discover. Wild concept, right?`,
      
      `📍 Hottest city:\n\n${topCity} had the most activity this week!\n\nWhere are you vibing from? Reply with your city 👇`,
      
      `Want to be part of next week's stats?\n\n🔗 Join us: resonance.app\n\nFind your people through music, not photos. ✨`
    ];

    // Post thread
    let lastTweetId: string | undefined;
    
    for (const tweet of thread) {
      const result = await client.v2.tweet(tweet, {
        reply: lastTweetId ? { in_reply_to_tweet_id: lastTweetId } : undefined
      });
      lastTweetId = result.data.id;
      
      // Rate limit safety
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('✅ Weekly thread posted');
    
  } catch (error) {
    console.error('❌ Weekly stats failed:', error);
  }
}
```

### listeners/keyword-monitor.ts
```typescript
import { TwitterApi } from 'twitter-api-v2';

const KEYWORDS = [
  'wish I could find people with my music taste',
  'dating apps suck',
  'music compatibility',
  'meet people who listen to',
  'find friends with same music',
  'spotify friends'
];

const REPLY_TEMPLATES = [
  "This is literally why I built Resonance! Find people nearby based on what you're ACTUALLY listening to 🎵\n\nresonance.app",
  "You might love Resonance - it matches you with people who share your exact music taste. No photos, just vibes ✨\n\nresonance.app",
  "Ever tried finding people through music instead of photos? That's what Resonance does 🎧\n\nresonance.app"
];

// Store replied tweet IDs to avoid duplicates
const repliedTweets = new Set<string>();

export async function monitorKeywords(client: TwitterApi) {
  try {
    for (const keyword of KEYWORDS) {
      const tweets = await client.v2.search(keyword, {
        max_results: 10,
        'tweet.fields': ['created_at', 'author_id']
      });

      for (const tweet of tweets.data?.data || []) {
        // Skip if already replied
        if (repliedTweets.has(tweet.id)) continue;
        
        // Skip if tweet is too old (> 1 hour)
        const tweetAge = Date.now() - new Date(tweet.created_at!).getTime();
        if (tweetAge > 60 * 60 * 1000) continue;

        // Reply with random template
        const reply = REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];
        
        await client.v2.reply(reply, tweet.id);
        repliedTweets.add(tweet.id);
        
        console.log(`✅ Replied to tweet about "${keyword}"`);
        
        // Rate limit: 1 reply per search
        break;
      }
      
      // Wait between searches
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error('❌ Keyword monitoring failed:', error);
  }
}
```

### listeners/mention-handler.ts
```typescript
import { TwitterApi } from 'twitter-api-v2';

let lastMentionId: string | undefined;

export async function handleMentions(client: TwitterApi) {
  try {
    const mentions = await client.v2.mentionTimeline(
      (await client.v2.me()).data.id,
      {
        since_id: lastMentionId,
        max_results: 10,
        'tweet.fields': ['text', 'author_id']
      }
    );

    for (const mention of mentions.data?.data || []) {
      lastMentionId = mention.id;
      
      const text = mention.text.toLowerCase();
      
      // Auto-reply based on content
      let reply: string;
      
      if (text.includes('how') && text.includes('work')) {
        reply = "Resonance shows you who's listening to music near you RIGHT NOW! 🎵\n\n1. Connect Spotify\n2. Go Live\n3. Discover people with your vibe\n\nTry it: resonance.app";
      } else if (text.includes('download') || text.includes('link')) {
        reply = "Here you go! 🎵\n\nresonance.app\n\nFind your music soulmate today ✨";
      } else if (text.includes('love') || text.includes('amazing')) {
        reply = "Thank you! 💜 Spread the vibe - tell your friends about us! 🎧";
      } else {
        reply = "Hey! 👋 Check out Resonance to find your music soulmate: resonance.app 🎵";
      }

      await client.v2.reply(reply, mention.id);
      console.log('✅ Replied to mention');
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error('❌ Mention handling failed:', error);
  }
}
```

### generators/tweet-templates.ts
```typescript
export const tweetTemplates = {
  engagement: [
    "Your Spotify Wrapped should be your dating profile. Change my mind. 🎵",
    "POV: You see a stranger at the café playing your exact current obsession 👀",
    "Hot take: If our Spotify playlists don't vibe, we won't either 🤷",
    "The way someone's music taste tells you more than a 2-hour date ever could",
    "Dating apps need a 'What's your sad playlist?' question tbh",
  ],
  
  memes: [
    "Dating apps: Here's a photo\nResonance: Here's their 3 AM playlist\n\nWhich tells you more? 🤔",
    "When you match with someone who also listens to [insert obscure artist]\n\n*instant best friends*",
    "Red flag: 'I listen to everything'\nGreen flag: Has a curated playlist for every mood 🟢",
  ],
  
  features: [
    "New feature alert! 🚨\n\nTime Capsule Drops - leave a song at any location for strangers to discover!\n\nLike a treasure hunt, but for music 💊",
    "Did you know? Resonance shows you what people are listening to RIGHT NOW, not what they listened to 3 months ago 🎵",
  ],
  
  milestones: [
    "🎉 {count} matches made through Resonance!\n\nThat's {count} people who found someone who GETS their music taste.\n\nJoin them: resonance.app",
    "We just hit {count} Time Capsules dropped across the world! 💊\n\nWhat song would you leave for a stranger?",
  ]
};
```

---

## 🎮 Auto-Manipulation Strategies

### 1. Trending Topic Hijacking
```typescript
// Monitor trending topics
// If music-related, post relevant content

"Trending: #SpotifyWrapped

Your Wrapped is cool, but what about RIGHT NOW?

Resonance shows what you're playing TODAY. Find your 2024 music soulmate 👀

resonance.app"
```

### 2. Quote Tweet Strategy
```typescript
// Find viral music takes, quote tweet with Resonance angle

// Original: "Music compatibility in relationships is underrated"
// Quote: "This is literally why we built Resonance 🎵
// Find people nearby who actually share your taste →"
```

### 3. Reply Guy Mode (Careful!)
```typescript
// Monitor music influencers
// Thoughtfully engage (NOT spam)
// Occasional Resonance mention when relevant
```

### 4. User-Generated Content
```typescript
// When users tweet about Resonance:
// - Like it
// - Retweet it
// - Reply with thanks
// - Ask permission to feature
```

---

## ⚠️ Rate Limits & Costs

### Free Tier (v2)
- 1,500 tweets/month
- 50 tweets/day
- Limited search

### Basic Tier ($100/month)
- 10,000 tweets/month
- Better search
- More reads

### Recommended Strategy
```
Free tier allocation:
- 1 morning tweet (30/month)
- 1 evening tweet (30/month)
- 1 weekly thread (4/month, ~24 tweets)
- Replies (~50/month)
- Buffer (~36/month)

Total: ~170 tweets/month = within free tier
```

---

## 📊 Metrics to Track

| Metric | How | Goal |
|--------|-----|------|
| Impressions | Twitter Analytics | 100K/month |
| Engagements | Twitter Analytics | 5% rate |
| Link clicks | UTM + Analytics | 1,000/month |
| Follower growth | Weekly count | 20%/month |
| Signups from Twitter | UTM tracking | 200/month |

---

## ✅ Summary

| Feature | Frequency | Purpose |
|---------|-----------|---------|
| Daily vibes | 2x/day | Consistent presence |
| Weekly thread | 1x/week | Deep engagement |
| Keyword replies | Auto | Lead capture |
| Mention replies | Auto | Customer service |
| Memes | 3x/week | Viral potential |
