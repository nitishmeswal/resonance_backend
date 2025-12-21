# 🤖 Resonance Discord Bot - Complete Guide

## Overview

Discord is the **BEST platform for automation** because:
- No rate limits on bots in your own server
- Full API access (messages, reactions, voice, etc.)
- Perfect for music communities
- Can drive direct signups

---

## 🎯 Top 5 Features for Resonance

### 1. `/vibe` - Share Your Current Vibe
```
User types: /vibe
Bot responds with embed showing:
- Current song from Spotify
- Mood (energetic/chill/melancholic)
- Match percentage with server average
- "Find someone with this vibe" button → links to app
```

### 2. `/match @user` - Check Compatibility
```
User types: /match @friend
Bot responds:
- "You and @friend are 78% compatible! 🎵"
- Top shared genres
- Song you'd both love
- "Create a blend on Resonance" button
```

### 3. `/drop` - Server Time Capsule
```
User types: /drop "Feeling nostalgic"
Bot:
- Saves song + message to server
- Others can /discover to find drops
- Creates FOMO and engagement
```

### 4. `/leaderboard` - Weekly Vibe Leaders
```
Auto-posts every Sunday:
- Top 10 most active vibe sharers
- Most compatible pairs
- Most discovered capsules
- Rewards = exclusive roles
```

### 5. `/nearby` - Teaser Feature
```
User types: /nearby
Bot responds:
- "🔍 3 listeners in your area are vibing right now!"
- "Download Resonance to discover them"
- Direct link to app
```

---

## 🛠️ Technical Implementation

### Project Structure
```
resonance-discord-bot/
├── src/
│   ├── commands/
│   │   ├── vibe.ts
│   │   ├── match.ts
│   │   ├── drop.ts
│   │   ├── discover.ts
│   │   ├── leaderboard.ts
│   │   └── nearby.ts
│   ├── events/
│   │   ├── ready.ts
│   │   ├── interactionCreate.ts
│   │   └── guildMemberAdd.ts
│   ├── services/
│   │   ├── spotify.service.ts
│   │   ├── resonance-api.service.ts
│   │   └── database.service.ts
│   ├── utils/
│   │   ├── embeds.ts
│   │   └── buttons.ts
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
    "discord.js": "^14.14.1",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0"
  }
}
```

### Environment Variables
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
RESONANCE_API_URL=https://your-backend.com/api/v1
RESONANCE_APP_URL=https://your-frontend.com
```

---

## 📝 Full Code Implementation

### index.ts - Main Bot File
```typescript
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import path from 'path';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.ts'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Event handlers
client.once('ready', () => {
  console.log(`🎵 Resonance Bot is online as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ 
      content: 'Something went wrong!', 
      ephemeral: true 
    });
  }
});

// Welcome new members
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.systemChannel;
  if (channel) {
    await channel.send({
      embeds: [{
        title: '🎵 Welcome to Resonance!',
        description: `Hey ${member}! Ready to find your music soulmate?\n\nUse \`/vibe\` to share what you're listening to!`,
        color: 0xFF1493,
        footer: { text: 'Download the app: resonance.app' }
      }]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
```

### commands/vibe.ts
```typescript
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('vibe')
  .setDescription('Share your current music vibe');

export async function execute(interaction: any) {
  await interaction.deferReply();

  // Check if user has linked Resonance account
  const userId = interaction.user.id;
  
  try {
    // Call Resonance API to get user's current track
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/discord/user/${userId}/current-track`
    );

    if (response.data.track) {
      const { track, mood, matchPercentage } = response.data;
      
      const embed = new EmbedBuilder()
        .setTitle(`🎵 ${interaction.user.username}'s Vibe`)
        .setDescription(`Currently feeling **${mood}**`)
        .addFields(
          { name: '🎧 Now Playing', value: `${track.name}\nby ${track.artist}`, inline: true },
          { name: '💫 Server Match', value: `${matchPercentage}% compatible`, inline: true }
        )
        .setThumbnail(track.albumArt)
        .setColor(getMoodColor(mood))
        .setFooter({ text: 'Find your music soulmate on Resonance' });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Find Similar Vibes')
            .setURL(`${process.env.RESONANCE_APP_URL}/match`)
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setLabel('Drop This Song')
            .setCustomId('drop_song')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      // User not linked or not playing
      const embed = new EmbedBuilder()
        .setTitle('🔗 Connect Your Vibe')
        .setDescription('Link your Spotify to share your vibe!')
        .setColor(0xFF1493);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Connect on Resonance')
            .setURL(`${process.env.RESONANCE_APP_URL}/auth?discord=${userId}`)
            .setStyle(ButtonStyle.Link)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  } catch (error) {
    await interaction.editReply('Could not fetch your vibe. Try again later!');
  }
}

function getMoodColor(mood: string): number {
  const colors: Record<string, number> = {
    energetic: 0xFF6B6B,
    chill: 0x4ECDC4,
    melancholic: 0x9B59B6,
    euphoric: 0xF39C12,
    focused: 0x3498DB,
  };
  return colors[mood] || 0xFF1493;
}
```

### commands/match.ts
```typescript
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('match')
  .setDescription('Check music compatibility with someone')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to match with')
      .setRequired(true)
  );

export async function execute(interaction: any) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user');
  const requesterId = interaction.user.id;
  const targetId = targetUser.id;

  if (requesterId === targetId) {
    return interaction.editReply("You can't match with yourself! 😅");
  }

  try {
    const response = await axios.post(
      `${process.env.RESONANCE_API_URL}/discord/match`,
      { user1Discord: requesterId, user2Discord: targetId }
    );

    const { matchPercentage, sharedGenres, recommendedSong } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('💕 Vibe Compatibility')
      .setDescription(`${interaction.user} & ${targetUser}`)
      .addFields(
        { name: '🎯 Match Score', value: `**${matchPercentage}%**`, inline: true },
        { name: '🎵 Shared Genres', value: sharedGenres.join(', ') || 'None yet', inline: true },
        { name: '💡 Song You\'d Both Love', value: recommendedSong || 'Connect to find out!' }
      )
      .setColor(matchPercentage > 70 ? 0x2ECC71 : matchPercentage > 40 ? 0xF39C12 : 0xE74C3C)
      .setFooter({ text: 'Create a blend on Resonance!' });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Create Blend')
          .setURL(`${process.env.RESONANCE_APP_URL}/blend?with=${targetId}`)
          .setStyle(ButtonStyle.Link)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    await interaction.editReply('Both users need to connect Resonance first!');
  }
}
```

### commands/drop.ts
```typescript
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('drop')
  .setDescription('Drop your current song as a time capsule')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Add a personal note')
      .setRequired(false)
  );

export async function execute(interaction: any) {
  await interaction.deferReply();

  const message = interaction.options.getString('message') || '';
  const userId = interaction.user.id;
  const serverId = interaction.guildId;

  try {
    const response = await axios.post(
      `${process.env.RESONANCE_API_URL}/discord/drop`,
      { discordUserId: userId, serverId, message }
    );

    const { track, dropId } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('💊 Song Dropped!')
      .setDescription(`${interaction.user} dropped a vibe for the server`)
      .addFields(
        { name: '🎵 Song', value: `${track.name} by ${track.artist}` },
        { name: '💬 Note', value: message || '*No message*' }
      )
      .setThumbnail(track.albumArt)
      .setColor(0x9B59B6)
      .setFooter({ text: `Use /discover to find server drops! | ID: ${dropId.slice(0, 8)}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply('Connect your Spotify on Resonance first!');
  }
}
```

### commands/leaderboard.ts
```typescript
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('See this week\'s top vibers');

export async function execute(interaction: any) {
  await interaction.deferReply();

  const serverId = interaction.guildId;

  try {
    const response = await axios.get(
      `${process.env.RESONANCE_API_URL}/discord/leaderboard/${serverId}`
    );

    const { topVibers, topMatches, topDroppers } = response.data;

    const embed = new EmbedBuilder()
      .setTitle('🏆 Weekly Vibe Leaderboard')
      .setDescription('Top contributors this week')
      .addFields(
        { 
          name: '🎵 Most Active Vibers', 
          value: topVibers.map((u: any, i: number) => 
            `${i + 1}. <@${u.discordId}> - ${u.vibeCount} vibes`
          ).join('\n') || 'No data yet',
          inline: false 
        },
        { 
          name: '💕 Best Matches', 
          value: topMatches.map((m: any) => 
            `<@${m.user1}> & <@${m.user2}> - ${m.percentage}%`
          ).join('\n') || 'No matches yet',
          inline: false 
        },
        { 
          name: '💊 Top Droppers', 
          value: topDroppers.map((u: any, i: number) => 
            `${i + 1}. <@${u.discordId}> - ${u.dropCount} drops`
          ).join('\n') || 'No drops yet',
          inline: false 
        }
      )
      .setColor(0xF1C40F)
      .setFooter({ text: 'Updated every Sunday | Powered by Resonance' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply('Leaderboard coming soon!');
  }
}
```

---

## 🎮 Auto-Manipulation Features

### 1. Auto Welcome + Signup Push
```typescript
// Every new member gets:
// - Welcome message
// - Resonance signup link
// - Exclusive "Early Adopter" role if they sign up
```

### 2. Daily Vibe Prompt
```typescript
// Scheduled post at 7 PM:
"🎵 What's everyone vibing to right now? Drop your /vibe!"

// Creates engagement + shows Resonance features
```

### 3. Match of the Day
```typescript
// Auto-post daily:
"💕 Today's Server Match: @user1 & @user2 are 92% compatible!
Both love indie rock and late-night playlists.
Check your match: /match @someone"
```

### 4. Drop Discovery Alerts
```typescript
// When someone drops:
"🔔 New song dropped in the server! Use /discover to find it!"

// Creates treasure hunt engagement
```

### 5. Milestone Celebrations
```typescript
// When user hits milestones:
"🎉 @user just hit 50 vibes shared! They're a certified vibe master!"

// Gamification drives engagement
```

---

## 📊 Metrics to Track

| Metric | How to Track |
|--------|--------------|
| Commands used | Log each command |
| Signups from Discord | Track `?discord=` param |
| Most active times | Log timestamps |
| Conversion rate | Discord users → App users |

---

## 🚀 Deployment

### Option 1: Railway (Recommended)
```bash
# Push to GitHub, connect Railway
# Add environment variables
# Auto-deploys on push
```

### Option 2: Heroku
```bash
heroku create resonance-discord-bot
heroku config:set DISCORD_TOKEN=xxx
git push heroku main
```

### Option 3: Your Own Server
```bash
npm run build
pm2 start dist/index.js --name resonance-bot
```

---

## 🔗 Connecting to Resonance Backend

Add these endpoints to your Resonance backend:

```typescript
// src/modules/discord/discord.controller.ts
@Controller('discord')
export class DiscordController {
  @Get('user/:discordId/current-track')
  async getCurrentTrack(@Param('discordId') discordId: string) {
    // Find user by Discord ID, return their current track
  }

  @Post('match')
  async matchUsers(@Body() dto: { user1Discord: string; user2Discord: string }) {
    // Calculate match between two Discord users
  }

  @Post('drop')
  async createDrop(@Body() dto: { discordUserId: string; serverId: string; message: string }) {
    // Create a server-specific time capsule
  }

  @Get('leaderboard/:serverId')
  async getLeaderboard(@Param('serverId') serverId: string) {
    // Get server stats
  }
}
```

---

## ✅ Summary

| Feature | Purpose | Conversion Driver |
|---------|---------|-------------------|
| /vibe | Show current track | "Find similar vibes" button |
| /match | Compare with friends | "Create blend" button |
| /drop | Gamification | Uses Time Capsule feature |
| /leaderboard | Competition | Recognition drives engagement |
| /nearby | Tease app feature | Direct signup link |
| Auto-welcome | Onboarding | Immediate signup push |
| Daily prompts | Engagement | Regular app reminders |
