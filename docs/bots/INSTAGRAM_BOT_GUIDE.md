# 📸 Resonance Instagram Strategy - Complete Guide

## ⚠️ Instagram API Limitations

Instagram is the MOST restricted platform:
- No automated posting to personal accounts
- Business accounts only via API
- No DM automation allowed
- Story API is very limited
- Reels cannot be automated

**Best approach: Use scheduling tools + manual engagement**

---

## 🎯 Top 5 Strategies

### 1. Scheduled Posts (via Buffer/Later)
```
Tools: Buffer, Later, Hootsuite, Meta Business Suite
Cost: $15-30/month

Schedule:
- 3x week: Feature highlights
- 2x week: User stories/testimonials
- 2x week: Memes/relatable content
- Daily: Stories (manual)
```

### 2. Carousels - High Engagement
```
Example carousel:
Slide 1: "5 Signs You Need Resonance"
Slide 2: "1. Your music taste is 'too niche'"
Slide 3: "2. Dating apps show photos, not playlists"
Slide 4: "3. You judge people by their Spotify"
Slide 5: "4. Your friends don't get your music"
Slide 6: "5. You want to meet your music soulmate"
Slide 7: "Download Resonance - link in bio 🎵"
```

### 3. Reels (Manual but Template-Based)
```
Reel ideas:
- POV: Finding someone with your exact taste
- "How Resonance works" in 30 seconds
- User reaction to matching
- Before/After meeting music soulmate
```

### 4. Stories Strategy
```
Daily stories:
- Poll: "What mood are you vibing today?"
- Quiz: "Guess the genre from the emoji"
- "Go live" reminder
- User shoutouts
- Behind the scenes
```

### 5. User-Generated Content
```
Encourage users to:
- Post their matches
- Share their vibe cards
- Tag @resonance.app

Repost the best ones (with permission)
```

---

## 🛠️ What CAN Be Automated

### 1. Post Scheduling
```
Use Buffer API or Later API to:
- Schedule posts in advance
- Queue content
- Analyze best posting times
```

### 2. Analytics Collection
```typescript
// Collect metrics via Instagram Graph API
// - Follower growth
// - Post engagement
// - Story views
// - Profile visits
```

### 3. Comment Monitoring
```typescript
// Monitor comments for:
// - Questions (respond manually)
// - Positive feedback (like + respond)
// - Spam (hide/delete)
```

### 4. Hashtag Research
```typescript
// Track performance of hashtags
// Find trending music hashtags
// A/B test hashtag sets
```

---

## 📝 Implementation

### Analytics & Monitoring Bot

```
resonance-instagram-monitor/
├── src/
│   ├── analytics/
│   │   ├── follower-tracker.ts
│   │   ├── engagement-tracker.ts
│   │   └── content-performance.ts
│   ├── monitoring/
│   │   ├── comment-monitor.ts
│   │   └── mention-monitor.ts
│   ├── scheduling/
│   │   └── buffer-integration.ts
│   ├── config.ts
│   └── index.ts
├── .env
└── package.json
```

### Dependencies
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1"
  }
}
```

### Environment Variables
```env
# Instagram Graph API (Business Account Required)
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ID=your_business_account_id

# Buffer API (for scheduling)
BUFFER_ACCESS_TOKEN=your_buffer_token

# Alerts
DISCORD_WEBHOOK_URL=your_webhook
```

---

## 📝 Code Implementation

### analytics/engagement-tracker.ts
```typescript
import axios from 'axios';

interface PostMetrics {
  id: string;
  likes: number;
  comments: number;
  saves: number;
  reach: number;
  engagement_rate: number;
}

export async function getPostMetrics(mediaId: string): Promise<PostMetrics> {
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${mediaId}/insights`,
    {
      params: {
        metric: 'likes,comments,saved,reach',
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN
      }
    }
  );
  
  const data = response.data.data;
  const likes = data.find((m: any) => m.name === 'likes')?.values[0]?.value || 0;
  const comments = data.find((m: any) => m.name === 'comments')?.values[0]?.value || 0;
  const saves = data.find((m: any) => m.name === 'saved')?.values[0]?.value || 0;
  const reach = data.find((m: any) => m.name === 'reach')?.values[0]?.value || 1;
  
  return {
    id: mediaId,
    likes,
    comments,
    saves,
    reach,
    engagement_rate: ((likes + comments + saves) / reach) * 100
  };
}

export async function getWeeklyReport() {
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_BUSINESS_ID}/media`,
    {
      params: {
        fields: 'id,caption,timestamp',
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN
      }
    }
  );
  
  const posts = response.data.data;
  const metrics = await Promise.all(
    posts.slice(0, 10).map((post: any) => getPostMetrics(post.id))
  );
  
  return {
    totalPosts: posts.length,
    avgEngagement: metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length,
    topPost: metrics.sort((a, b) => b.engagement_rate - a.engagement_rate)[0],
    totalReach: metrics.reduce((sum, m) => sum + m.reach, 0)
  };
}
```

### monitoring/comment-monitor.ts
```typescript
import axios from 'axios';
import { sendDiscordAlert } from '../alerts/discord-webhook';

const seenComments = new Set<string>();

export async function monitorComments() {
  try {
    // Get recent posts
    const postsResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_BUSINESS_ID}/media`,
      {
        params: {
          fields: 'id',
          limit: 5,
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        }
      }
    );
    
    for (const post of postsResponse.data.data) {
      // Get comments for each post
      const commentsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${post.id}/comments`,
        {
          params: {
            fields: 'id,text,username,timestamp',
            access_token: process.env.INSTAGRAM_ACCESS_TOKEN
          }
        }
      );
      
      for (const comment of commentsResponse.data.data || []) {
        if (seenComments.has(comment.id)) continue;
        seenComments.add(comment.id);
        
        // Check if needs response
        const text = comment.text.toLowerCase();
        const needsResponse = 
          text.includes('?') ||
          text.includes('how') ||
          text.includes('download') ||
          text.includes('link');
        
        if (needsResponse) {
          await sendDiscordAlert({
            title: '💬 Instagram Comment Needs Response',
            description: `@${comment.username}: "${comment.text}"`,
            postId: post.id,
            action: 'Reply manually on Instagram'
          });
        }
      }
    }
  } catch (error) {
    console.error('Comment monitoring error:', error);
  }
}
```

### scheduling/buffer-integration.ts
```typescript
import axios from 'axios';

interface ScheduledPost {
  text: string;
  imageUrl?: string;
  scheduledAt: Date;
}

export async function schedulePost(post: ScheduledPost) {
  try {
    // Get Buffer profile ID
    const profilesResponse = await axios.get(
      'https://api.bufferapp.com/1/profiles.json',
      {
        params: { access_token: process.env.BUFFER_ACCESS_TOKEN }
      }
    );
    
    const instagramProfile = profilesResponse.data.find(
      (p: any) => p.service === 'instagram'
    );
    
    if (!instagramProfile) {
      throw new Error('No Instagram profile connected to Buffer');
    }
    
    // Schedule the post
    await axios.post(
      'https://api.bufferapp.com/1/updates/create.json',
      null,
      {
        params: {
          access_token: process.env.BUFFER_ACCESS_TOKEN,
          profile_ids: [instagramProfile.id],
          text: post.text,
          media: post.imageUrl ? { photo: post.imageUrl } : undefined,
          scheduled_at: Math.floor(post.scheduledAt.getTime() / 1000)
        }
      }
    );
    
    console.log('✅ Post scheduled on Buffer');
    
  } catch (error) {
    console.error('❌ Buffer scheduling failed:', error);
  }
}

// Schedule a week of content
export async function scheduleWeekContent(posts: ScheduledPost[]) {
  for (const post of posts) {
    await schedulePost(post);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }
}
```

---

## 📋 Content Templates

### Feed Post Templates

```markdown
### Feature Highlight
🎵 Did you know Resonance shows you what people are listening to RIGHT NOW?

Not last month's top songs. Not their all-time favorites. 
What they're vibing to at this exact moment.

That's real connection. That's Resonance.

Link in bio 👆

#SpotifyMusic #MusicLovers #MeetNewPeople #MusicApp #VibeCheck

---

### User Story
"I matched with someone playing the exact same obscure indie song as me. We've been dating for 3 months now." - @username

Stories like this are why we built Resonance. 💜

Your turn? Link in bio.

#MusicSoulmate #MatchMade #SpotifyFriends #MusicConnection

---

### Meme/Relatable
Dating apps: Here's a filtered photo
Resonance: Here's their 3 AM sad playlist

Which tells you more about a person? 🤔

#Dating #MusicMemes #RelatableContent #SpotifyWrapped
```

### Story Templates

```markdown
### Poll Story
"What's your vibe today?"
[Energetic 🔥] vs [Chill 😌]

---

### Quiz Story
"Which genre matches your personality?"
A) Indie (mysterious)
B) Pop (social butterfly)
C) Hip-hop (confident)
D) Lo-fi (introspective)

---

### Countdown Story
"New feature dropping in..."
[Countdown sticker: Time Capsule Drops 💊]
```

---

## 📊 Posting Schedule

| Day | Time (IST) | Content Type |
|-----|------------|--------------|
| Mon | 7 PM | Feature highlight |
| Tue | 12 PM | User story |
| Wed | 7 PM | Meme/relatable |
| Thu | 12 PM | Behind the scenes |
| Fri | 7 PM | Weekend vibe post |
| Sat | 3 PM | User-generated repost |
| Sun | 7 PM | Weekly stats |

### Stories (Daily)
- Morning: Poll/quiz
- Afternoon: Feature reminder
- Evening: Go live reminder

---

## 🎨 Visual Guidelines

### Brand Colors
```
Primary: #FF1493 (Hot Pink)
Secondary: #00CED1 (Cyan)
Accent: #9B59B6 (Purple)
Background: #1A1A2E (Dark)
```

### Post Dimensions
```
Feed Post: 1080x1080 (square) or 1080x1350 (portrait)
Story: 1080x1920
Reel: 1080x1920
```

### Fonts
```
Headers: Bold sans-serif (Montserrat, Poppins)
Body: Clean sans-serif (Inter, Roboto)
```

---

## 📈 Growth Tactics

### 1. Hashtag Strategy
```
Branded: #ResonanceApp #FindYourVibe #MusicSoulmate
Music: #SpotifyMusic #MusicLovers #NowPlaying #VibeCheck
Niche: #IndieMusic #LoFiBeats #MusicTaste
Growth: #MeetNewPeople #MakeFriends #Dating
```

### 2. Engagement Pods (Careful)
```
Join music/startup communities
Engage with similar accounts
Cross-promote carefully
```

### 3. Influencer Seeding
```
Send app access to:
- Music reviewers (10K-50K followers)
- Lifestyle creators
- Dating commentary accounts
- Tech reviewers
```

### 4. Reels Strategy
```
Trending sounds + Resonance twist
Before/after format
POV format
Tutorial format
```

---

## ✅ Summary

| Component | Method | Tool |
|-----------|--------|------|
| Post scheduling | Semi-automated | Buffer/Later |
| Stories | Manual | Instagram app |
| Reels | Manual | Instagram app |
| Analytics | Automated | Graph API |
| Comment monitoring | Automated | Custom bot |
| Engagement | Manual | Instagram app |
| Hashtag research | Semi-automated | Later/analytics |

**Instagram success = consistent quality content + authentic engagement**
