import assert from 'node:assert/strict';
import test from 'node:test';
import { campaign as fullCampaign } from '../campaigns/instagram-2026/campaign.mjs';

import {
  BufferClient,
  formatSummary,
  normalizeText,
  runRefill,
  selectPostsToCreate,
  validateCampaign,
} from '../scripts/refill-buffer-campaign.mjs';

const hashtags = '#beads #glassbeads #beading #handicraft #womenartisan';

function campaignPost(id, dueAt, text = `Why this matters. ${hashtags}`) {
  return {
    id,
    dueAt,
    text,
    imageUrl: `https://beads.alwintru.com/images/${id}.jpg`,
  };
}

test('validateCampaign accepts unique Monday, Wednesday, and Friday posts at 10:00 WITA', () => {
  const campaign = [
    campaignPost('a', '2026-09-07T02:00:00.000Z'),
    campaignPost('b', '2026-09-09T02:00:00.000Z'),
    campaignPost('c', '2026-09-11T02:00:00.000Z'),
  ];

  assert.deepEqual(validateCampaign(campaign), campaign);
});

test('validateCampaign rejects duplicate dates and missing required hashtags', () => {
  const campaign = [
    campaignPost('a', '2026-09-07T02:00:00.000Z'),
    campaignPost('b', '2026-09-07T02:00:00.000Z', 'Why this matters.'),
  ];

  assert.throws(() => validateCampaign(campaign), /duplicate dueAt.*missing hashtag/s);
});

test('validateCampaign rejects timestamps with nonzero seconds or milliseconds', () => {
  assert.throws(() => validateCampaign([campaignPost('a', '2026-09-07T02:00:01.000Z')]), /invalid WITA schedule/);
  assert.throws(() => validateCampaign([campaignPost('a', '2026-09-07T02:00:00.001Z')]), /invalid WITA schedule/);
});

test('the full campaign contains 52 unique images from September 2 through December 30', () => {
  assert.equal(validateCampaign(fullCampaign).length, 52);
  assert.equal(fullCampaign[0].dueAt, '2026-09-02T02:00:00.000Z');
  assert.equal(fullCampaign.at(-1).dueAt, '2026-12-30T02:00:00.000Z');
  assert.equal(new Set(fullCampaign.map(post => post.imageUrl)).size, 52);
});

test('validateCampaign rejects a repeated image', () => {
  const first = campaignPost('a', '2026-09-07T02:00:00.000Z');
  const second = { ...campaignPost('b', '2026-09-09T02:00:00.000Z'), imageUrl: first.imageUrl };
  assert.throws(() => validateCampaign([first, second]), /duplicate image URL/);
});

test('normalizeText makes whitespace-only caption edits idempotent', () => {
  assert.equal(normalizeText('Why this matters.\n\n#beads  #glassbeads'), 'why this matters. #beads #glassbeads');
});

test('selectPostsToCreate fills only available Free-plan slots', () => {
  const campaign = Array.from({ length: 12 }, (_, index) =>
    campaignPost(String(index), `2026-10-${String(2 + index).padStart(2, '0')}T02:00:00.000Z`),
  );

  for (const scheduledCount of [0, 1, 9, 10]) {
    const existing = Array.from({ length: scheduledCount }, (_, index) => ({
      status: 'scheduled',
      dueAt: `2026-09-${String(2 + index).padStart(2, '0')}T02:00:00.000Z`,
      text: `existing ${index}`,
    }));
    const selected = selectPostsToCreate({
      campaign,
      existingPosts: existing,
      now: new Date('2026-09-30T00:00:00.000Z'),
    });
    assert.equal(selected.length, 10 - scheduledCount);
  }
});

test('selectPostsToCreate counts a post currently sending against Free-plan capacity', () => {
  const campaign = [campaignPost('a', '2026-10-02T02:00:00.000Z')];
  const existingPosts = Array.from({ length: 10 }, (_, index) => ({
    status: index === 0 ? 'sending' : 'scheduled',
    dueAt: `2026-09-${String(2 + index).padStart(2, '0')}T02:00:00.000Z`,
    text: `existing ${index}`,
  }));
  assert.deepEqual(
    selectPostsToCreate({ campaign, existingPosts, now: new Date('2026-09-30T00:00:00.000Z') }),
    [],
  );
});

test('selectPostsToCreate skips matches by due time or normalized caption', () => {
  const campaign = [
    campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`),
    campaignPost('b', '2026-10-05T02:00:00.000Z', `Why B. ${hashtags}`),
    campaignPost('c', '2026-10-07T02:00:00.000Z', `Why C. ${hashtags}`),
  ];
  const existingPosts = [
    { status: 'scheduled', dueAt: campaign[0].dueAt, text: 'edited caption' },
    { status: 'sent', dueAt: '2026-09-01T02:00:00.000Z', text: ` Why B.\n${hashtags} ` },
  ];

  assert.deepEqual(
    selectPostsToCreate({ campaign, existingPosts, now: new Date('2026-09-30T00:00:00.000Z') }).map(post => post.id),
    ['c'],
  );
});

test('selectPostsToCreate reports past-due campaign entries without posting them late', () => {
  const campaign = [
    campaignPost('past', '2026-09-28T02:00:00.000Z'),
    campaignPost('future', '2026-10-02T02:00:00.000Z'),
  ];

  assert.throws(
    () => selectPostsToCreate({ campaign, existingPosts: [], now: new Date('2026-09-30T00:00:00.000Z') }),
    /past-due campaign post: past/,
  );
});

test('selectPostsToCreate halts when Buffer contains a failed campaign post', () => {
  const campaign = [campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`)];
  const existingPosts = [{ status: 'error', dueAt: campaign[0].dueAt, text: campaign[0].text }];

  assert.throws(
    () => selectPostsToCreate({ campaign, existingPosts, now: new Date('2026-09-30T00:00:00.000Z') }),
    /failed campaign post requires review/,
  );
});

test('selectPostsToCreate ignores unrelated failed posts', () => {
  const campaign = [campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`)];
  const existingPosts = [{ status: 'error', dueAt: '2026-09-01T02:00:00.000Z', text: 'unrelated' }];

  assert.deepEqual(
    selectPostsToCreate({ campaign, existingPosts, now: new Date('2026-09-30T00:00:00.000Z') }).map(post => post.id),
    ['a'],
  );
});

test('runRefill dry-run reads Buffer but creates no posts', async () => {
  const created = [];
  const client = {
    async discoverInstagramChannel() { return { organizationId: 'org-1', channelId: 'channel-1' }; },
    async listCampaignPosts() { return []; },
    async validateImageAssets() {},
    async createScheduledImagePost(post) { created.push(post); },
  };
  const campaign = [campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`)];

  const result = await runRefill({ client, campaign, dryRun: true, now: new Date('2026-09-30T00:00:00.000Z') });

  assert.equal(created.length, 0);
  assert.deepEqual(result.planned.map(post => post.id), ['a']);
  assert.deepEqual(result.created, []);
});

test('runRefill live mode creates exact automatic Instagram image posts', async () => {
  const created = [];
  const validated = [];
  const client = {
    async discoverInstagramChannel() { return { organizationId: 'org-1', channelId: 'channel-1' }; },
    async listCampaignPosts() { return []; },
    async validateImageAssets(posts) { validated.push(...posts); },
    async createScheduledImagePost(input) { created.push(input); return { id: 'buffer-1' }; },
  };
  const post = campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`);

  const result = await runRefill({ client, campaign: [post], dryRun: false, now: new Date('2026-09-30T00:00:00.000Z') });

  assert.deepEqual(validated, [post]);
  assert.deepEqual(created, [{ channelId: 'channel-1', post }]);
  assert.deepEqual(result.created, [{ campaignId: 'a', bufferPostId: 'buffer-1' }]);
});

test('runRefill validates the complete selected batch before creating any post', async () => {
  const created = [];
  const campaign = [campaignPost('a', '2026-10-02T02:00:00.000Z'), campaignPost('b', '2026-10-05T02:00:00.000Z')];
  const client = {
    async discoverInstagramChannel() { return { organizationId: 'org-1', channelId: 'channel-1' }; },
    async listCampaignPosts() { return []; },
    async validateImageAssets() { throw new Error('invalid image asset: b'); },
    async createScheduledImagePost(input) { created.push(input); return { id: 'unexpected' }; },
  };
  await assert.rejects(runRefill({ client, campaign, dryRun: false, now: new Date('2026-09-30T00:00:00.000Z') }), /invalid image asset: b/);
  assert.deepEqual(created, []);
});

test('BufferClient discovers one exact Instagram handle across organizations', async () => {
  const responses = [
    { data: { account: { organizations: [{ id: 'org-1' }, { id: 'org-2' }] } } },
    { data: { channels: [{ id: 'other', name: 'other', displayName: 'Other', service: 'instagram' }] } },
    { data: { channels: [{ id: 'target', name: 'alanawinatrudi', displayName: 'AWT', service: 'instagram', isQueuePaused: false, isDisconnected: false, isLocked: false, allowedActions: ['viewPublish'], timezone: 'Asia/Makassar' }] } },
  ];
  const fetchCalls = [];
  const fetchImpl = async (_url, options) => {
    fetchCalls.push(JSON.parse(options.body));
    return { ok: true, async json() { return responses.shift(); } };
  };

  const client = new BufferClient({ token: 'secret', fetchImpl });
  assert.deepEqual(await client.discoverInstagramChannel('alanawinatrudi'), {
    organizationId: 'org-2', channelId: 'target', timezone: 'Asia/Makassar',
  });
  assert.equal(fetchCalls.length, 3);
});

test('BufferClient rejects disconnected, locked, or non-publishable channels', async () => {
  for (const state of [
    { isDisconnected: true, isLocked: false, allowedActions: ['viewPublish'] },
    { isDisconnected: false, isLocked: true, allowedActions: ['viewPublish'] },
    { isDisconnected: false, isLocked: false, allowedActions: ['viewInsights'] },
  ]) {
    const responses = [
      { data: { account: { organizations: [{ id: 'org-1' }] } } },
      { data: { channels: [{ id: 'target', name: 'alanawinatrudi', service: 'instagram', isQueuePaused: false, timezone: 'Asia/Makassar', ...state }] } },
    ];
    const fetchImpl = async () => ({ ok: true, async json() { return responses.shift(); } });
    await assert.rejects(new BufferClient({ token: 'secret', fetchImpl }).discoverInstagramChannel('alanawinatrudi'), /disconnected|locked|Publish access/);
  }
});

test('BufferClient preflights image status, type, dimensions, and 4:5 ratio', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0x46, 0x04, 0x38, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const mediaFetchImpl = async () => ({
    ok: true, status: 200,
    headers: { get(name) { return name.toLowerCase() === 'content-type' ? 'image/jpeg' : null; } },
    async arrayBuffer() { return jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength); },
  });
  const client = new BufferClient({ token: 'secret', fetchImpl: async () => {}, mediaFetchImpl });
  const post = campaignPost('a', '2026-10-02T02:00:00.000Z');
  assert.deepEqual(await client.validateImageAssets([post]), [{ id: 'a', width: 1080, height: 1350 }]);

  const badType = new BufferClient({ token: 'secret', fetchImpl: async () => {}, mediaFetchImpl: async () => ({ ok: true, headers: { get() { return 'text/html'; } } }) });
  await assert.rejects(badType.validateImageAssets([post]), /not an image/);
});

test('BufferClient rejects paused or ambiguous Instagram channels', async () => {
  const responses = [
    { data: { account: { organizations: [{ id: 'org-1' }] } } },
    { data: { channels: [
      { id: 'one', name: 'alanawinatrudi', service: 'instagram', isQueuePaused: false, timezone: 'Asia/Makassar' },
      { id: 'two', name: 'alanawinatrudi', service: 'instagram', isQueuePaused: false, timezone: 'Asia/Makassar' },
    ] } },
  ];
  const fetchImpl = async () => ({ ok: true, async json() { return responses.shift(); } });

  await assert.rejects(
    new BufferClient({ token: 'secret', fetchImpl }).discoverInstagramChannel('alanawinatrudi'),
    /expected exactly one.*found 2/,
  );
});

test('BufferClient creates a custom-scheduled automatic Instagram feed image', async () => {
  let request;
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, async json() { return { data: { createPost: { post: { id: 'post-1', dueAt: '2026-10-02T02:00:00.000Z' } } } }; } };
  };
  const client = new BufferClient({ token: 'secret', fetchImpl });
  const post = campaignPost('a', '2026-10-02T02:00:00.000Z', `Why A. ${hashtags}`);

  assert.deepEqual(await client.createScheduledImagePost({ channelId: 'channel-1', post }), {
    id: 'post-1', dueAt: post.dueAt,
  });
  assert.match(request.query, /schedulingType:\s*automatic/);
  assert.match(request.query, /mode:\s*customScheduled/);
  assert.match(request.query, /type:\s*post/);
  assert.match(request.query, /shouldShareToFeed:\s*true/);
  assert.match(request.query, /2026-10-02T02:00:00\.000Z/);
  assert.match(request.query, /https:\/\/beads\.alwintru\.com\/images\/a\.jpg/);
});

test('BufferClient combines the entire live queue with campaign-period history', async () => {
  const responses = [
    { data: { posts: { edges: [
      { node: { id: 'outside', text: 'unrelated', dueAt: '2027-01-01T02:00:00.000Z', status: 'scheduled', channelId: 'channel-1' } },
      { node: { id: 'same', text: 'campaign', dueAt: '2026-10-02T02:00:00.000Z', status: 'scheduled', channelId: 'channel-1' } },
    ], pageInfo: { hasNextPage: false, endCursor: null } } } },
    { data: { posts: { edges: [
      { node: { id: 'same', text: 'campaign', dueAt: '2026-10-02T02:00:00.000Z', status: 'scheduled', channelId: 'channel-1' } },
      { node: { id: 'sent', text: 'campaign sent', dueAt: '2026-09-02T02:00:00.000Z', status: 'sent', channelId: 'channel-1' } },
    ], pageInfo: { hasNextPage: false, endCursor: null } } } },
  ];
  const fetchImpl = async () => ({ ok: true, async json() { return responses.shift(); } });
  const campaign = [
    campaignPost('a', '2026-09-02T02:00:00.000Z'),
    campaignPost('b', '2026-12-30T02:00:00.000Z'),
  ];

  const posts = await new BufferClient({ token: 'secret', fetchImpl }).listCampaignPosts({
    organizationId: 'org-1', channelId: 'channel-1', campaign,
  });

  assert.deepEqual(posts.map(post => post.id), ['outside', 'same', 'sent']);
});

test('BufferClient surfaces GraphQL and typed mutation errors', async () => {
  const graphQlFailure = async () => ({ ok: true, async json() { return { errors: [{ message: 'Not authorized' }] }; } });
  await assert.rejects(
    new BufferClient({ token: 'secret', fetchImpl: graphQlFailure }).discoverInstagramChannel('alanawinatrudi'),
    /Not authorized/,
  );

  const typedFailure = async () => ({ ok: true, async json() { return { data: { createPost: { message: 'Post limit reached' } } }; } });
  await assert.rejects(
    new BufferClient({ token: 'secret', fetchImpl: typedFailure }).createScheduledImagePost({
      channelId: 'channel-1', post: campaignPost('a', '2026-10-02T02:00:00.000Z'),
    }),
    /Post limit reached/,
  );
});

test('formatSummary reports dry-run plans and live creations without secrets', () => {
  const post = campaignPost('a', '2026-10-02T02:00:00.000Z');
  const dry = formatSummary({ dryRun: true, result: { planned: [post], created: [], existingPosts: [] } });
  assert.match(dry, /Dry run/);
  assert.match(dry, /a.*2026-10-02T02:00:00\.000Z/);

  const live = formatSummary({
    dryRun: false,
    result: { planned: [post], created: [{ campaignId: 'a', bufferPostId: 'buffer-1' }], existingPosts: [] },
  });
  assert.match(live, /Live refill/);
  assert.match(live, /Created: 1/);
  assert.match(live, /Skipped: 0/);
  assert.match(live, /Failed: 0/);
  assert.doesNotMatch(live, /secret|Bearer/);
});
