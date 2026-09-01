import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { campaign as defaultCampaign } from '../campaigns/instagram-2026/campaign.mjs';

const REQUIRED_HASHTAGS = ['#beads', '#glassbeads', '#beading', '#handicraft', '#womenartisan'];
const FREE_QUEUE_LIMIT = 10;

export function normalizeText(text) {
  return String(text).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateCampaign(campaign) {
  const errors = [];
  const ids = new Set();
  const dueDates = new Set();
  const imageUrls = new Set();

  for (const [index, post] of campaign.entries()) {
    const label = post.id || `row ${index + 1}`;
    if (!post.id || ids.has(post.id)) errors.push(`duplicate or missing id: ${label}`);
    ids.add(post.id);

    if (!post.dueAt || Number.isNaN(Date.parse(post.dueAt))) {
      errors.push(`invalid dueAt: ${label}`);
    } else {
      if (dueDates.has(post.dueAt)) errors.push(`duplicate dueAt: ${post.dueAt}`);
      dueDates.add(post.dueAt);
      const date = new Date(post.dueAt);
      const makassarHour = (date.getUTCHours() + 8) % 24;
      const weekday = date.getUTCDay();
      if (makassarHour !== 10 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0 || ![1, 3, 5].includes(weekday)) {
        errors.push(`invalid WITA schedule: ${label}`);
      }
    }

    if (!/^Why\b/.test(post.text || '')) errors.push(`caption must start with Why: ${label}`);
    for (const hashtag of REQUIRED_HASHTAGS) {
      if (!(post.text || '').includes(hashtag)) errors.push(`missing hashtag ${hashtag}: ${label}`);
    }
    if (!/^https:\/\//.test(post.imageUrl || '')) {
      errors.push(`invalid image URL: ${label}`);
    } else {
      if (imageUrls.has(post.imageUrl)) errors.push(`duplicate image URL: ${post.imageUrl}`);
      imageUrls.add(post.imageUrl);
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return campaign;
}

export function selectPostsToCreate({ campaign, existingPosts, now = new Date() }) {
  const scheduledCount = existingPosts.filter(post => ['scheduled', 'sending'].includes(post.status)).length;
  const capacity = Math.max(0, FREE_QUEUE_LIMIT - scheduledCount);
  const knownTimes = new Set(existingPosts.map(post => post.dueAt).filter(Boolean));
  const knownTexts = new Set(existingPosts.map(post => normalizeText(post.text)).filter(Boolean));

  const campaignTimes = new Set(campaign.map(post => post.dueAt));
  const campaignTexts = new Set(campaign.map(post => normalizeText(post.text)));
  const failed = existingPosts.find(post =>
    ['error', 'failed'].includes(post.status) &&
    (campaignTimes.has(post.dueAt) || campaignTexts.has(normalizeText(post.text))),
  );
  if (failed) throw new Error(`failed campaign post requires review: ${failed.dueAt || normalizeText(failed.text)}`);

  const selected = [];
  for (const post of [...campaign].sort((a, b) => a.dueAt.localeCompare(b.dueAt))) {
    if (knownTimes.has(post.dueAt) || knownTexts.has(normalizeText(post.text))) continue;
    if (new Date(post.dueAt) <= now) throw new Error(`past-due campaign post: ${post.id}`);
    if (selected.length < capacity) selected.push(post);
  }
  return selected;
}

export async function runRefill({ client, campaign, dryRun, now = new Date() }) {
  validateCampaign(campaign);
  const { organizationId, channelId } = await client.discoverInstagramChannel('alanawinatrudi');
  const existingPosts = await client.listCampaignPosts({ organizationId, channelId, campaign });
  const planned = selectPostsToCreate({ campaign, existingPosts, now });
  const knownTimes = new Set(existingPosts.map(post => post.dueAt).filter(Boolean));
  const knownTexts = new Set(existingPosts.map(post => normalizeText(post.text)).filter(Boolean));
  const skipped = campaign.filter(post => knownTimes.has(post.dueAt) || knownTexts.has(normalizeText(post.text)));
  const created = [];

  await client.validateImageAssets(planned);
  if (!dryRun) {
    for (const post of planned) {
      try {
        const result = await client.createScheduledImagePost({ channelId, post });
        created.push({ campaignId: post.id, bufferPostId: result.id });
      } catch (error) {
        error.createdPosts = [...created];
        error.failedCampaignId = post.id;
        throw error;
      }
    }
  }

  return { planned, created, skipped, failed: [], existingPosts };
}

function gqlString(value) {
  return JSON.stringify(String(value));
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  return null;
}

function imageDimensions(bytes, contentType) {
  if (contentType.includes('png') && bytes.length >= 24 && bytes.subarray(1, 4).toString() === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (contentType.includes('webp') && bytes.length >= 30 && bytes.subarray(0, 4).toString() === 'RIFF') {
    const kind = bytes.subarray(12, 16).toString();
    if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
  }
  return jpegDimensions(bytes);
}

export class BufferClient {
  constructor({ token, fetchImpl = fetch, mediaFetchImpl = fetch }) {
    if (!token) throw new Error('BUFFER_API_KEY is required');
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.mediaFetchImpl = mediaFetchImpl;
  }

  async request(query) {
    const response = await this.fetchImpl('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`Buffer HTTP error: ${response.status || 'unknown'}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors.map(error => error.message).join('; '));
    return payload.data;
  }

  async discoverInstagramChannel(handle) {
    const accountData = await this.request(`query GetOrganizations {
      account { organizations { id name } }
    }`);
    const matches = [];
    for (const organization of accountData.account.organizations) {
      const data = await this.request(`query GetChannels {
        channels(input: { organizationId: ${gqlString(organization.id)} }) {
          id name displayName service isQueuePaused timezone isDisconnected isLocked allowedActions
        }
      }`);
      for (const channel of data.channels) {
        const names = [channel.name, channel.displayName].filter(Boolean).map(value => value.toLowerCase());
        if (channel.service === 'instagram' && names.includes(handle.toLowerCase())) {
          matches.push({ organizationId: organization.id, channel });
        }
      }
    }
    if (matches.length !== 1) {
      throw new Error(`expected exactly one Instagram channel named ${handle}; found ${matches.length}`);
    }
    const [{ organizationId, channel }] = matches;
    if (channel.isDisconnected) throw new Error(`Buffer channel is disconnected for ${handle}`);
    if (channel.isLocked) throw new Error(`Buffer channel is locked for ${handle}`);
    if (!channel.allowedActions?.includes('manageUpdates')) {
      throw new Error(`Buffer channel does not grant post write access for ${handle}`);
    }
    if (channel.isQueuePaused) throw new Error(`Buffer queue is paused for ${handle}`);
    if (channel.timezone !== 'Asia/Makassar') {
      throw new Error(`expected Asia/Makassar timezone; found ${channel.timezone || 'unset'}`);
    }
    return { organizationId, channelId: channel.id, timezone: channel.timezone };
  }

  async validateImageAssets(posts) {
    return Promise.all(posts.map(async post => {
      const response = await this.mediaFetchImpl(post.imageUrl, { method: 'GET', redirect: 'follow' });
      if (!response.ok) throw new Error(`invalid image asset ${post.id}: HTTP ${response.status || 'unknown'}`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) throw new Error(`invalid image asset ${post.id}: not an image`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 15 * 1024 * 1024) throw new Error(`invalid image asset ${post.id}: exceeds 15 MB`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) throw new Error(`invalid image asset ${post.id}: exceeds 15 MB`);
      const dimensions = imageDimensions(bytes, contentType);
      if (!dimensions?.width || !dimensions?.height) throw new Error(`invalid image asset ${post.id}: unsupported or unreadable dimensions`);
      if (dimensions.width >= dimensions.height || Math.abs(dimensions.width / dimensions.height - 0.8) > 0.01) {
        throw new Error(`invalid image asset ${post.id}: expected 4:5 portrait, found ${dimensions.width}x${dimensions.height}`);
      }
      return { id: post.id, ...dimensions };
    }));
  }

  async listCampaignPosts({ organizationId, channelId, campaign }) {
    const startDate = campaign[0].dueAt;
    const endDate = new Date(new Date(campaign.at(-1).dueAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const queueData = await this.request(`query GetLiveQueue {
      posts(
        first: 100
        input: {
          organizationId: ${gqlString(organizationId)}
          filter: { channelIds: [${gqlString(channelId)}], status: [scheduled, sending] }
          sort: [{ field: dueAt, direction: asc }, { field: createdAt, direction: asc }]
        }
      ) {
        edges { node { id text dueAt status channelId } }
        pageInfo { hasNextPage endCursor }
      }
    }`);
    const historyData = await this.request(`query GetCampaignPosts {
      posts(
        first: 100
        input: {
          organizationId: ${gqlString(organizationId)}
          filter: {
            channelIds: [${gqlString(channelId)}]
            status: [draft, error, needs_approval, scheduled, sending, sent]
            startDate: ${gqlString(startDate)}
            endDate: ${gqlString(endDate)}
          }
          sort: [{ field: dueAt, direction: asc }, { field: createdAt, direction: asc }]
        }
      ) {
        edges { node { id text dueAt status channelId } }
        pageInfo { hasNextPage endCursor }
      }
    }`);
    if (queueData.posts.pageInfo.hasNextPage || historyData.posts.pageInfo.hasNextPage) {
      throw new Error('Buffer query exceeded 100 posts; refusing incomplete capacity or duplicate detection');
    }
    const postsById = new Map();
    for (const edge of [...queueData.posts.edges, ...historyData.posts.edges]) {
      postsById.set(edge.node.id, edge.node);
    }
    return [...postsById.values()];
  }

  async createScheduledImagePost({ channelId, post }) {
    const data = await this.request(`mutation CreateCampaignPost {
      createPost(input: {
        text: ${gqlString(post.text)}
        channelId: ${gqlString(channelId)}
        schedulingType: automatic
        mode: customScheduled
        dueAt: ${gqlString(post.dueAt)}
        assets: [{ image: { url: ${gqlString(post.imageUrl)} } }]
        metadata: { instagram: { type: post, shouldShareToFeed: true } }
      }) {
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message }
      }
    }`);
    if (!data.createPost?.post) {
      throw new Error(data.createPost?.message || 'Buffer returned no created post');
    }
    return data.createPost.post;
  }
}

export function formatSummary({ dryRun, result }) {
  const lines = [
    `## Buffer campaign — ${dryRun ? 'Dry run' : 'Live refill'}`,
    '',
    `- Existing posts inspected: ${result.existingPosts.length}`,
    `- ${dryRun ? 'Would queue' : 'Queued'}: ${dryRun ? result.planned.length : result.created.length}`,
    `- Planned: ${result.planned.length}`,
    `- Created: ${result.created.length}`,
    `- Skipped: ${(result.skipped || []).length}`,
    `- Failed: ${(result.failed || []).length}`,
  ];
  if (result.planned.length) {
    lines.push('', '### Planned campaign posts');
    for (const post of result.planned) lines.push(`- ${post.id} — ${post.dueAt}`);
  }
  if (result.created.length) {
    lines.push('', '### Created Buffer posts');
    for (const post of result.created) lines.push(`- ${post.campaignId} — Buffer ${post.bufferPostId}`);
  }
  return `${lines.join('\n')}\n`;
}

export function formatFailureSummary(error) {
  const queued = Array.isArray(error.createdPosts) ? error.createdPosts.length : 'unknown';
  const lines = [
    '## Buffer campaign — Failed',
    '',
    `- Queued before failure: ${queued}`,
    '- Skipped: unknown',
    '- Failed: 1',
  ];
  if (error.failedCampaignId) lines.push(`- Failed campaign entry: ${error.failedCampaignId}`);
  lines.push('', error.message);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const dryRun = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const client = new BufferClient({ token: process.env.BUFFER_API_KEY });
  const result = await runRefill({ client, campaign: defaultCampaign, dryRun });
  const summary = formatSummary({ dryRun, result });
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const failure = formatFailureSummary(error);
    process.stderr.write(failure);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, failure);
    process.exitCode = 1;
  });
}
