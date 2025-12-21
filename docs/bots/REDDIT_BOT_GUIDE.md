# 🤖 Resonance Reddit Strategy - Complete Guide

## ⚠️ IMPORTANT: Reddit HATES Bots

Reddit is extremely hostile to automation:
- Bots get banned quickly
- Promotional content gets downvoted
- Users can see through marketing

**Best approach: 90% manual, 10% automation**

---

## 🎯 Top 5 Strategies (Mostly Manual)

### 1. Genuine Community Participation
```
Join relevant subreddits:
- r/spotify
- r/music
- r/indieheads
- r/LetsTalkMusic
- r/SideProject
- r/startups
- r/dating
- r/MeetNewPeopleHere

Actually engage authentically for 2-3 weeks before ANY mention of your app
```

### 2. AMA (Ask Me Anything)
```
Title: "I built an app that lets you find people nearby based on their music taste. AMA!"

Subreddits:
- r/IAmA
- r/startups
- r/SideProject
- r/spotify (with mod permission)
```

### 3. Show HN Style Posts
```
r/SideProject post:
"Show r/SideProject: Resonance - Like Tinder but you match on music taste, not photos"

Include:
- Problem you solved
- How you built it
- Tech stack
- Lessons learned
- Link at the end
```

### 4. Comment Strategy (Not Bot)
```
When you see posts like:
- "How do I meet people with similar music taste?"
- "Dating apps are so shallow"
- "I wish Spotify had better social features"

Respond genuinely, THEN mention Resonance as something you're building
```

### 5. Own Subreddit
```
Create r/ResonanceApp
- Post updates
- Feature requests
- Match stories
- Build community

Cross-post to other subreddits (carefully)
```

---

## 🛠️ What CAN Be Automated

### 1. Mention Monitoring
```typescript
// Monitor mentions of "Resonance" or "resonance.app"
// Alert you to respond manually
// DO NOT auto-reply
```

### 2. Keyword Alerts
```typescript
// Monitor for opportunities:
// - "music dating app"
// - "find people music taste"
// - "spotify social features"
// Alert you → you respond manually
```

### 3. Analytics Dashboard
```typescript
// Track:
// - Mentions of Resonance
// - Sentiment analysis
// - Top performing posts
// - Best times to post
```

### 4. Content Scheduling
```typescript
// Pre-write posts
// Schedule for optimal times
// But require manual approval before posting
```

---

## 📝 Monitoring Bot Implementation

### Project Structure
```
resonance-reddit-monitor/
├── src/
│   ├── monitors/
│   │   ├── keyword-monitor.ts
│   │   ├── mention-monitor.ts
│   │   └── subreddit-monitor.ts
│   ├── alerts/
│   │   ├── discord-webhook.ts
│   │   └── email-alert.ts
│   ├── analytics/
│   │   └── tracker.ts
│   ├── config.ts
│   └── index.ts
├── .env
└── package.json
```

### Dependencies
```json
{
  "dependencies": {
    "snoowrap": "^1.23.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
```

### Environment Variables
```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_username
REDDIT_PASSWORD=your_password
REDDIT_USER_AGENT=Resonance Monitor Bot v1.0

# Notification webhooks
DISCORD_WEBHOOK_URL=your_discord_webhook
SLACK_WEBHOOK_URL=your_slack_webhook
```

---

## 📝 Code Implementation

### index.ts - Monitor Bot
```typescript
import Snoowrap from 'snoowrap';
import cron from 'node-cron';
import { config } from 'dotenv';
import { monitorKeywords } from './monitors/keyword-monitor';
import { monitorMentions } from './monitors/mention-monitor';
import { sendDiscordAlert } from './alerts/discord-webhook';

config();

const reddit = new Snoowrap({
  userAgent: process.env.REDDIT_USER_AGENT!,
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
});

console.log('👀 Reddit Monitor starting...');

// Monitor keywords every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('🔍 Checking keywords...');
  await monitorKeywords(reddit);
});

// Monitor mentions every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('🔔 Checking mentions...');
  await monitorMentions(reddit);
});

console.log('✅ Reddit Monitor is running!');
```

### monitors/keyword-monitor.ts
```typescript
import Snoowrap from 'snoowrap';
import { sendDiscordAlert } from '../alerts/discord-webhook';

const SUBREDDITS = [
  'spotify',
  'music',
  'dating',
  'MeetNewPeopleHere',
  'SideProject',
  'startups'
];

const KEYWORDS = [
  'music taste dating',
  'find people same music',
  'spotify social',
  'music compatibility',
  'meet people music',
  'dating app music'
];

const seenPosts = new Set<string>();

export async function monitorKeywords(reddit: Snoowrap) {
  for (const subreddit of SUBREDDITS) {
    try {
      const posts = await reddit.getSubreddit(subreddit).getNew({ limit: 25 });
      
      for (const post of posts) {
        if (seenPosts.has(post.id)) continue;
        seenPosts.add(post.id);
        
        const content = `${post.title} ${post.selftext}`.toLowerCase();
        
        for (const keyword of KEYWORDS) {
          if (content.includes(keyword.toLowerCase())) {
            await sendDiscordAlert({
              title: '🎯 Keyword Match Found!',
              description: `**r/${subreddit}**: ${post.title}`,
              url: `https://reddit.com${post.permalink}`,
              keyword,
              action: 'Consider responding manually'
            });
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Error monitoring r/${subreddit}:`, error);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

### monitors/mention-monitor.ts
```typescript
import Snoowrap from 'snoowrap';
import { sendDiscordAlert } from '../alerts/discord-webhook';

const BRAND_KEYWORDS = [
  'resonance app',
  'resonance.app',
  'resonanceapp',
  'resonance music'
];

export async function monitorMentions(reddit: Snoowrap) {
  try {
    // Search for brand mentions
    for (const keyword of BRAND_KEYWORDS) {
      const results = await reddit.search({
        query: keyword,
        sort: 'new',
        time: 'day',
        limit: 10
      });

      for (const post of results) {
        await sendDiscordAlert({
          title: '🔔 Brand Mention!',
          description: `Someone mentioned Resonance: ${post.title}`,
          url: `https://reddit.com${post.permalink}`,
          sentiment: 'Check manually',
          action: 'Respond if appropriate'
        });
      }
    }
  } catch (error) {
    console.error('Error monitoring mentions:', error);
  }
}
```

### alerts/discord-webhook.ts
```typescript
import axios from 'axios';

interface AlertData {
  title: string;
  description: string;
  url: string;
  keyword?: string;
  sentiment?: string;
  action?: string;
}

export async function sendDiscordAlert(data: AlertData) {
  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL!, {
      embeds: [{
        title: data.title,
        description: data.description,
        url: data.url,
        color: 0xFF1493,
        fields: [
          data.keyword && { name: 'Keyword', value: data.keyword, inline: true },
          data.sentiment && { name: 'Sentiment', value: data.sentiment, inline: true },
          data.action && { name: 'Action', value: data.action, inline: false }
        ].filter(Boolean),
        timestamp: new Date().toISOString()
      }]
    });
    console.log('✅ Discord alert sent');
  } catch (error) {
    console.error('❌ Discord alert failed:', error);
  }
}
```

---

## 📋 Content Templates for Manual Posting

### Launch Post Template
```markdown
Title: I built an app that matches you with people based on music taste, not photos

Hey r/SideProject!

**The Problem:**
Dating/friend apps focus on photos and bios. But music taste is a way better predictor of compatibility, and it's totally ignored.

**The Solution:**
Resonance shows you who's listening to music near you RIGHT NOW. You see their current song, mood, and top genres. Match based on actual taste.

**Features:**
- 🎵 Live feed of nearby listeners
- 💕 Match percentage based on music taste  
- 💊 "Time Capsule" - drop songs at locations for others to discover
- 🔍 "Find Listener" - hot/cold game to meet in person

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- Backend: NestJS + PostgreSQL + Redis
- Spotify OAuth for music data
- WebSockets for real-time

**What I learned:**
- Building with Spotify API is smooth
- WebSocket scaling is tricky
- Privacy-preserving location is possible with geohashing

**Try it:** [resonance.app]

Would love feedback! What features would make you use this?
```

### Comment Response Templates
```markdown
// When someone says "I wish Spotify had better social features"

"This is actually something I'm working on! Built an app called Resonance that shows you who's listening to music near you and matches based on taste. Spotify's social features are pretty basic - we try to go deeper by showing what people are playing RIGHT NOW, not just their all-time favorites."

// When someone asks "How do I meet people with similar music taste?"

"There are a few ways:
1. Concert communities (subreddits, Facebook groups)
2. Last.fm still has social features
3. I built something called Resonance that shows nearby listeners - shameless plug but it's literally what you're asking for

What genre are you into? That might help narrow it down."
```

---

## 🚫 What NOT To Do

| ❌ DON'T | ✅ DO |
|----------|-------|
| Auto-post promotional content | Participate genuinely first |
| Bot-reply to every opportunity | Manually craft thoughtful responses |
| Spam links | Include links only when asked |
| Create multiple accounts | Use one authentic account |
| Ignore subreddit rules | Read and follow each sub's rules |
| Sound like marketing | Sound like a person |

---

## 📊 Subreddit Strategy

| Subreddit | Strategy | Frequency |
|-----------|----------|-----------|
| r/spotify | Genuine participation | Daily comments |
| r/SideProject | Launch post + updates | Monthly |
| r/startups | Milestone posts | When relevant |
| r/dating | Helpful comments | Weekly |
| r/music | Genre discussions | Daily |
| r/IndieHeads | Authentic engagement | Daily |

---

## ✅ Summary

| Component | Automated? | Purpose |
|-----------|------------|---------|
| Keyword monitoring | ✅ Yes | Find opportunities |
| Mention tracking | ✅ Yes | Brand awareness |
| Alerts to Discord | ✅ Yes | Quick response |
| Actual posting | ❌ NO | Avoid bans |
| Comment replies | ❌ NO | Must be authentic |
| Analytics | ✅ Yes | Track performance |

**Reddit success = patience + authenticity + value-first mindset**
