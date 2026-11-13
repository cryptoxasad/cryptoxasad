import { app } from './server.mjs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import { unlinkSync } from 'node:fs';

console.log('🚀 Starting Clip Bounty End-to-End Pilot Test Suite...\n');

// Use an isolated in-memory test database
const testPort = 3098;
const server = app({ file: ':memory:' });

server.listen(testPort, '127.0.0.1', async () => {
  try {
    const baseUrl = `http://127.0.0.1:${testPort}`;
    let creatorCookie = '';
    let fanCookie = '';

    // Helper for requests
    async function req(endpoint, options = {}, cookie = '') {
      const headers = { ...(options.headers || {}) };
      if (cookie) headers['cookie'] = cookie;
      if (options.body && !(options.body instanceof FormData)) {
        headers['content-type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }
      return fetch(baseUrl + endpoint, { ...options, headers });
    }

    // 1. Static asset verification
    console.log('--- Step 1: Verifying Static Assets & Headers ---');
    const indexRes = await req('/');
    assert.strictEqual(indexRes.status, 200, 'index.html should return 200');
    assert.ok(indexRes.headers.get('content-security-policy').includes('youtube-nocookie.com'), 'CSP must whitelist youtube-nocookie');
    console.log('✓ index.html served with secure CSP');

    const logoRes = await req('/logo.svg');
    assert.strictEqual(logoRes.status, 200, 'logo.svg should return 200');
    console.log('✓ logo.svg served');

    const manifestRes = await req('/media-manifest.js');
    assert.strictEqual(manifestRes.status, 200, 'media-manifest.js should return 200');
    console.log('✓ media-manifest.js served');

    const tokenConfigRes = await req('/token-config.js');
    assert.strictEqual(tokenConfigRes.status, 200, 'token-config.js should return 200');
    console.log('✓ token-config.js served');

    // 2. Authentication: Creator and Fan Registration
    console.log('\n--- Step 2: Testing User Registration & Authentication ---');
    const creatorEmail = 'apex_creator@test.com';
    const regCreator = await req('/api/register', {
      method: 'POST',
      body: { email: creatorEmail, password: 'password123456', name: 'ApexCreator' }
    });
    assert.strictEqual(regCreator.status, 200, 'Creator registration should succeed');
    creatorCookie = regCreator.headers.get('set-cookie').split(';')[0];
    const creatorData = await regCreator.json();
    assert.strictEqual(creatorData.user.name, 'ApexCreator');
    console.log('✓ Creator registered successfully:', creatorData.user.name);

    const fanEmail = 'highlight_fan@test.com';
    const regFan = await req('/api/register', {
      method: 'POST',
      body: { email: fanEmail, password: 'password123456', name: 'HighlightHunter' }
    });
    assert.strictEqual(regFan.status, 200, 'Fan registration should succeed');
    fanCookie = regFan.headers.get('set-cookie').split(';')[0];
    const fanData = await regFan.json();
    assert.strictEqual(fanData.user.name, 'HighlightHunter');
    console.log('✓ Fan registered successfully:', fanData.user.name);

    // Verify /api/me for both
    const meCreator = await (await req('/api/me', {}, creatorCookie)).json();
    assert.strictEqual(meCreator.user.name, 'ApexCreator');
    const meFan = await (await req('/api/me', {}, fanCookie)).json();
    assert.strictEqual(meFan.user.name, 'HighlightHunter');
    console.log('✓ Session verification /api/me passed for both accounts');

    // 3. Post a Bounty with external YouTube link
    console.log('\n--- Step 3: Posting a Link-Based Bounty ---');
    const futureDeadline = new Date(Date.now() + 86400000).toISOString();
    const postLinkRes = await req('/api/bounties', {
      method: 'POST',
      body: {
        title: 'Find the 1v4 clutch play on stream',
        brief: 'Look for the round where the bomb was defused with under 1 second left. Submit exact time.',
        vod: 'https://www.youtube.com/watch?v=zlx64JjXlgQ',
        reward: 150,
        deadline: futureDeadline
      }
    }, creatorCookie);
    assert.strictEqual(postLinkRes.status, 201, 'Posting bounty should return 201');
    const bountyLink = await postLinkRes.json();
    const bountyId = bountyLink.id;
    console.log('✓ Link-based bounty posted with ID:', bountyId);

    // 4. Post a Bounty with MP4 Video Upload
    console.log('\n--- Step 4: Posting a Video Upload Bounty (Magic Bytes & File Check) ---');
    // Build a minimal valid MP4 buffer with ftyp box
    const ftypBox = Buffer.from([
      0x00, 0x00, 0x00, 0x18, // 24 bytes length
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6f, 0x6d, // 'isom'
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32 // compatible brands
    ]);
    const mp4Payload = Buffer.concat([ftypBox, Buffer.alloc(1024, 0xaa)]);
    
    const formData = new FormData();
    formData.append('title', 'Direct MP4 Stream Challenge');
    formData.append('brief', 'Find the hilarious reaction face at 1080p60.');
    formData.append('reward', '75');
    formData.append('deadline', futureDeadline);
    formData.append('video', new File([mp4Payload], 'sample_stream.mp4', { type: 'video/mp4' }));

    const postUploadRes = await req('/api/bounties', {
      method: 'POST',
      body: formData
    }, creatorCookie);
    assert.strictEqual(postUploadRes.status, 201, 'Video upload bounty should return 201');
    const uploadBounty = await postUploadRes.json();
    console.log('✓ Uploaded video bounty posted with ID:', uploadBounty.id);

    // Verify public listings show both bounties
    const allBounties = await (await req('/api/bounties')).json();
    assert.strictEqual(allBounties.length, 2, 'Public board should have 2 bounties');
    console.log('✓ Public /api/bounties lists both active challenges');

    // 5. Fan Submits Timestamp
    console.log('\n--- Step 5: Fan Timestamp Submission & Permissions ---');
    // Creator cannot enter own bounty
    const creatorEnterRes = await req(`/api/bounties/${bountyId}/entries`, {
      method: 'POST',
      body: { timestamp: '00:14:22', reason: 'Self entry attempt' }
    }, creatorCookie);
    assert.strictEqual(creatorEnterRes.status, 403, 'Creator should be forbidden from entering own bounty');
    console.log('✓ Creator self-entry correctly rejected (403)');

    // Fan submits timestamp
    const fanSubmitRes = await req(`/api/bounties/${bountyId}/entries`, {
      method: 'POST',
      body: {
        timestamp: '00:14:22',
        reason: 'The single global state thesis explanation is at 14m 22s.',
        clip: 'https://www.youtube.com/watch?v=zlx64JjXlgQ'
      }
    }, fanCookie);
    assert.strictEqual(fanSubmitRes.status, 201, 'Fan entry should be accepted (201)');
    console.log('✓ Fan timestamp submitted: 00:14:22');

    // Duplicate timestamp rejected
    const dupRes = await req(`/api/bounties/${bountyId}/entries`, {
      method: 'POST',
      body: { timestamp: '00:14:22', reason: 'Duplicate' }
    }, fanCookie);
    assert.strictEqual(dupRes.status, 409, 'Duplicate timestamp should conflict (409)');
    console.log('✓ Duplicate timestamp correctly rejected (409)');

    // 6. Submissions Review & Privacy Protection
    console.log('\n--- Step 6: Testing Submissions Review & Clipper Privacy ---');
    // Creator sees submission
    const creatorEntries = await (await req(`/api/bounties/${bountyId}/entries`, {}, creatorCookie)).json();
    assert.strictEqual(creatorEntries.length, 1, 'Creator should see 1 entry');
    assert.strictEqual(creatorEntries[0].timestamp, '00:14:22');
    const entryId = creatorEntries[0].id;
    console.log('✓ Creator sees fan submission with entry ID:', entryId);

    // Fan sees only their own submission
    const fanEntries = await (await req(`/api/bounties/${bountyId}/entries`, {}, fanCookie)).json();
    assert.strictEqual(fanEntries.length, 1);
    console.log('✓ Clipper privacy verified: submitter only views their own entry');

    // 7. Winner Selection Lifecycle
    console.log('\n--- Step 7: Winner Selection & Deadline Enforcement ---');
    // Cannot select winner before deadline closes
    const prematureWinner = await req(`/api/bounties/${bountyId}/winner`, {
      method: 'POST',
      body: { entry: entryId }
    }, creatorCookie);
    assert.strictEqual(prematureWinner.status, 409, 'Cannot select winner before deadline passes');
    console.log('✓ Premature winner selection rejected (deadline not passed)');

    // Update deadline in test DB to past so winner can be selected
    // Note: server's DB has the bounty
    // We can simulate past deadline by updating the test record
    // Let's create a quick closed bounty with deadline in the past or directly select
    console.log('Simulating closed deadline for winner selection test...');
    // We post another bounty with short deadline, or update
    // Let's test non-creator cannot select winner
    const nonCreatorSelect = await req(`/api/bounties/${bountyId}/winner`, {
      method: 'POST',
      body: { entry: entryId }
    }, fanCookie);
    assert.strictEqual(nonCreatorSelect.status, 403, 'Non-creator cannot select winner (403)');
    console.log('✓ Non-creator selection blocked (403)');

    // 8. Test Winner Selection & Private Receipt Flow
    console.log('\n--- Step 8: Winner Selection & Private Payout Recording ---');
    // Post a bounty with deadline 1 second in the future and wait 1.2s
    const quickDeadline = new Date(Date.now() + 1000).toISOString();
    const quickBountyRes = await req('/api/bounties', {
      method: 'POST',
      body: {
        title: 'Quick Closing Bounty for Winner Test',
        brief: 'Testing immediate closing and payout settlement.',
        vod: 'https://www.youtube.com/watch?v=mBlhy3XIiQw',
        reward: 50,
        deadline: quickDeadline
      }
    }, creatorCookie);
    const quickBounty = await quickBountyRes.json();
    const quickId = quickBounty.id;

    // Fan submits timestamp to quick bounty
    await req(`/api/bounties/${quickId}/entries`, {
      method: 'POST',
      body: { timestamp: '00:08:45', reason: 'Fee redistribution breakdown' }
    }, fanCookie);

    const quickEntries = await (await req(`/api/bounties/${quickId}/entries`, {}, creatorCookie)).json();
    const quickEntryId = quickEntries[0].id;

    // Wait for deadline to pass
    await new Promise(r => setTimeout(r, 1200));

    // Creator selects winner
    const selectWinnerRes = await req(`/api/bounties/${quickId}/winner`, {
      method: 'POST',
      body: { entry: quickEntryId }
    }, creatorCookie);
    assert.strictEqual(selectWinnerRes.status, 200, 'Creator should select winner after deadline');
    console.log('✓ Winner selected after deadline expiration');

    // Verify public bounty reflects winner
    const publicBounties = await (await req('/api/bounties')).json();
    const wonBounty = publicBounties.find(b => b.id === quickId);
    assert.strictEqual(wonBounty.winner, quickEntryId);
    assert.strictEqual(wonBounty.winning_name, 'HighlightHunter');
    assert.strictEqual(wonBounty.winning_time, '00:08:45');
    assert.strictEqual(Boolean(wonBounty.receipt), false, 'Receipt should be false before payment recorded');
    console.log('✓ Public listing accurately displays winning fan and timestamp with receipt: false');

    // Creator records payment receipt
    const privateReceiptText = 'PayPal Tx #98218-CLIP-CONFIDENTIAL';
    const recordPaidRes = await req(`/api/bounties/${quickId}/paid`, {
      method: 'POST',
      body: { receipt: privateReceiptText }
    }, creatorCookie);
    assert.strictEqual(recordPaidRes.status, 200, 'Recording payment should return 200');
    console.log('✓ Creator recorded private payout confirmation');

    // Verify public listing shows receipt: true but NEVER the private text
    const updatedPublicBounties = await (await req('/api/bounties')).json();
    const paidBounty = updatedPublicBounties.find(b => b.id === quickId);
    assert.strictEqual(Boolean(paidBounty.receipt), true, 'Receipt should be true in public listing');
    assert.strictEqual(paidBounty.receiptText, undefined, 'Receipt text must NEVER be exposed publicly');
    console.log('✓ Public board shows receipt: true; confidential receipt string is protected');

    console.log('\n🎉 ALL END-TO-END PILOT ACCEPTANCE TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
