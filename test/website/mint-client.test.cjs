const {test}=require('node:test');
const assert=require('node:assert/strict');
const {API,BUILD,TOKEN,CONFIG,ACCOUNT,OTHER,PASS,word,liveConfig,fixture}=require('./harness.cjs');

test('shipped config is pre-launch: connection and balance work; forced handlers cannot transact',async()=>{
 const {client,provider}=fixture(CONFIG);await client.connect(provider);
 assert.equal(client.live,false);assert.equal(client.state.balance,provider.balance);assert.equal(client.state.stats,null);
 for(const kind of ['genesis','mystery'])await assert.rejects(()=>client.mint(kind),/Coming Soon/);
 assert.equal(provider.sent.length,0);assert.equal(provider.calls.some(c=>c.method.includes('sign')),false);
 assert.equal(provider.calls.some(c=>c.method==='eth_call'&&c.params[0].to===PASS),false);
});
test('an NFT address alone cannot activate minting',async()=>{
 const {client,provider}=fixture({...CONFIG,PASS_ADDRESS:PASS,MODE:'LIVE'});await client.connect(provider);
 await assert.rejects(()=>client.mint('genesis'),/Coming Soon/);assert.equal(provider.sent.length,0);
});
test('every launch condition must be affirmative',()=>{
 const good=liveConfig();assert.equal(API.configuredLive(good,BUILD),true);
 for(const key of Object.keys(good.LAUNCH)) {
   const bad={...good,LAUNCH:{...good.LAUNCH,[key]:typeof good.LAUNCH[key]==='boolean'?false:''}};
   assert.equal(API.configuredLive(bad,BUILD),false,key);
 }
 for(const address of ['',API.BMC,'0x'+'0'.repeat(40),'0x'+'0'.repeat(36)+'dEaD','junk']) assert.equal(API.configuredLive({...good,PASS_ADDRESS:address},BUILD),false);
 assert.equal(API.configuredLive({...good,CHAIN_ID:56},BUILD),false);
 assert.equal(API.configuredLive({...good,GENESIS_CID:'wrong'},BUILD),false);
 assert.equal(API.configuredLive(good,{...BUILD,design:'deterministic'}),false);
});
test('selectors and argument bounds come from the compiled ABI',()=>{
 assert.equal(API.calldata(TOKEN,'approve(address,uint256)',[PASS,API.GENESIS]),'0x095ea7b3'+PASS.slice(2).padStart(64,'0')+word(API.GENESIS).slice(2));
 assert.equal(API.calldata(BUILD,'mintMystery()'),'0x9aa0c9be');
 assert.throws(()=>API.calldata(BUILD,'mintMystery()',[1]));
 assert.throws(()=>API.calldata(BUILD,'finalizeReveals(uint256)',[1]));
 assert.throws(()=>API.calldata(TOKEN,'approve(address,uint256)',['',1]));
 assert.throws(()=>API.calldata(TOKEN,'approve(address,uint256)',[PASS,2n**256n]));
 assert.throws(()=>API.uint('0x'));
 assert.throws(()=>API.decodeString('0x'));
});
test('connection refusal, no wallet, and empty account list are handled',async()=>{
 const {client,provider}=fixture();await assert.rejects(()=>client.connect(null),/No injected/);
 provider.reject='connect';await assert.rejects(()=>client.connect(provider),{code:4001});assert.equal(client.state.account,null);
 provider.reject=null;provider.account=null;await client.connect(provider);assert.equal(client.state.ready,false);
});
test('wrong chain blocks all writes even if cached chain was mainnet',async()=>{
 const {client,provider}=fixture();await client.connect(provider);provider.chain='0x38';
 await assert.rejects(()=>client.mint('genesis'),/Wrong network/);assert.equal(provider.sent.length,0);assert.equal(client.state.ready,false);
});
test('chain change and account events clear stale balances and listener registration is singular',async()=>{
 const {client,provider}=fixture();await client.connect(provider);await client.connect(provider);
 assert.equal(provider.listenerCount('accountsChanged'),1);
 provider.chain='0x38';provider.emit('chainChanged','0x38');assert.equal(client.state.balance,null);assert.equal(client.state.ready,false);
 provider.account=null;provider.emit('accountsChanged',[]);assert.equal(client.state.account,null);
 client.disconnect();assert.equal(provider.listenerCount('accountsChanged'),0);assert.equal(client.state.stats,null);
});
test('disconnection during approval stops minting and retains submitted hash',async()=>{
 const {client,provider}=fixture();await client.connect(provider);
 provider.onReceipt=stage=>{if(stage==='approval')provider.emit('disconnect',{code:4900});};
 await assert.rejects(()=>client.mint('genesis'),/Wallet changed/);assert.equal(provider.sent.length,1);assert.ok(client.state.pending);
});
test('wrong bytecode, zero code, token decimals and inconsistent supply fail closed',async()=>{
 for(const change of [p=>p.code='0x',p=>p.code='0x1234',p=>p.decimals=6n,p=>p.remainingStandard=422n]){
  const {client,provider}=fixture();change(provider);await client.connect(provider);assert.equal(client.state.ready,false);
  await assert.rejects(()=>client.mint('genesis'));assert.equal(provider.sent.length,0);
 }
});
test('insufficient balance sends no approval',async()=>{
 const {client,provider}=fixture();provider.balance=API.GENESIS-1n;await client.connect(provider);
 await assert.rejects(()=>client.mint('genesis'),/Insufficient BMC/);assert.equal(provider.sent.length,0);
});
test('exact approval is confirmed before mint, then minted NFT is displayed',async()=>{
 const {client,provider,events}=fixture();await client.connect(provider);await client.mint('genesis');
 assert.equal(provider.sent.length,2);assert.equal(provider.sent[0].to,API.BMC);
 assert.equal(BigInt('0x'+provider.sent[0].data.slice(74)),API.GENESIS);
 assert.equal(provider.sent[1].to,PASS);assert.equal(provider.sent[1].chainId,'0x1');
 assert.equal(client.state.minted.id,1n);assert.match(client.state.minted.metadata.image,/genesis-01.png$/);
 assert.equal(client.state.pending,null);assert.equal(client.state.allowance,0n);
 assert.deepEqual(events.map(e=>e.stage+':'+e.status),['approval:pending','approval:confirmed','mint:pending','mint:confirmed']);
});
test('sufficient allowance skips approval',async()=>{
 const {client,provider}=fixture();provider.allowance=API.GENESIS;await client.connect(provider);await client.mint('genesis');
 assert.equal(provider.sent.length,1);assert.equal(provider.sent[0].stage,'mint');
});
test('Mystery uses exact 350k approval, its own mint ABI, then a separate reveal after the next block',async()=>{
 const {client,provider,events}=fixture();provider.minted=40n;await client.connect(provider);await client.mint('mystery');
 assert.equal(BigInt('0x'+provider.sent[0].data.slice(74)),API.MYSTERY);
 assert.equal(provider.sent[1].data,'0x9aa0c9be');assert.equal(client.state.minted.id,41n);
 assert.equal(provider.sent.length,3);assert.equal(provider.sent[2].to,PASS);
 assert.equal(provider.sent[2].data,API.calldata(BUILD,'reveal(uint256)',[1n]));
 assert.equal(provider.pendingCount,0n);assert.equal(client.state.minted.pending,false);assert.equal(client.state.pending,null);
 assert.deepEqual(events.map(e=>e.stage+':'+e.status),['approval:pending','approval:confirmed','mint:pending','mint:confirmed','reveal:pending','reveal:confirmed']);
});
test('a reveal that stays pending leaves the pass marked unrevealed and locks the page without resending',async()=>{
 const {client,provider,storage,config}=fixture();provider.minted=40n;provider.allowance=API.MYSTERY;await client.connect(provider);
 provider.onReceipt=stage=>{if(stage==='mint')provider.pending=true;};
 await assert.rejects(()=>client.mint('mystery'),/still pending/);
 assert.equal(provider.sent.length,2);assert.equal(client.state.pending.stage,'reveal');assert.equal(client.state.pending.tokenId,'41');
 assert.equal(client.state.minted.pending,true);assert.ok(client.state.minted.metadata);
 await assert.rejects(()=>client.mint('mystery'),/already in progress/);await assert.rejects(()=>client.reveal(),/already in progress/);
 const recovered=fixture(config,{storage}).client;await recovered.connect(provider);assert.equal(recovered.state.pending.stage,'reveal');
 provider.pending=false;await recovered.checkPending();assert.equal(recovered.state.pending,null);assert.equal(provider.sent.length,2);
 assert.equal(recovered.state.minted.id,41n);assert.equal(recovered.state.minted.pending,false);
});
test('Reveal pending settles everyone ahead in mint order and sends nothing when nothing is pending',async()=>{
 const {client,provider}=fixture();provider.minted=45n;provider.pendingCount=5n;provider.remainingStandard=423n;await client.connect(provider);
 assert.equal(client.state.stats.pending,5n);await client.reveal();
 assert.equal(provider.sent.length,1);assert.equal(provider.sent[0].data,API.calldata(BUILD,'reveal(uint256)',[5n]));assert.equal(provider.pendingCount,0n);
 await client.reveal();assert.equal(provider.sent.length,1);assert.match(client.state.message,/No passes are waiting/);
});
test('minting closed on the NFT contract blocks every write even with a fully authorized configuration',async()=>{
 const {client,provider}=fixture();provider.open=false;await client.connect(provider);
 assert.equal(client.state.stats.open,false);
 for(const kind of ['genesis','mystery'])await assert.rejects(()=>client.mint(kind),/not opened minting/);
 assert.equal(provider.sent.length,0);
});
test('a pending-count that does not reconcile with the inventory fails closed',async()=>{
 const {client,provider}=fixture();provider.minted=45n;provider.pendingCount=6n;await client.connect(provider);
 assert.equal(client.state.ready,false);await assert.rejects(()=>client.mint('mystery'));assert.equal(provider.sent.length,0);
});
test('wrong phase and sold out cannot request approval',async()=>{
 for(const [minted,kind] of [[0n,'mystery'],[40n,'genesis'],[500n,'mystery']]){
  const {client,provider}=fixture();provider.minted=minted;if(minted===500n){provider.remainingGenesis=0n;provider.remainingStandard=0n;}
  await client.connect(provider);await assert.rejects(()=>client.mint(kind));assert.equal(provider.sent.length,0);
 }
});
test('rejected, reverted, or ineffectual approval never sends a mint',async()=>{
 for(const change of [p=>p.reject='approval',p=>p.revert='approval',p=>p.ignoreApproval=true]){
  const {client,provider}=fixture();change(provider);await client.connect(provider);await assert.rejects(()=>client.mint('genesis'));
  assert.equal(provider.sent.some(t=>t.stage==='mint'),false);assert.equal(client.state.busy,false);
 }
});
test('rejected and reverted mint do not claim an NFT or silently resend',async()=>{
 for(const change of [p=>p.reject='mint',p=>p.revert='mint']){
  const {client,provider}=fixture();change(provider);await client.connect(provider);await assert.rejects(()=>client.mint('genesis'));
  assert.equal(client.state.minted,null);assert.equal(provider.sent.filter(t=>t.stage==='mint').length,provider.reject?0:1);
 }
});
test('changed account, chain, phase, balance or code after approval stops the mint',async()=>{
 for(const change of [p=>p.account=OTHER,p=>p.chain='0x38',p=>p.minted=40n,p=>p.balance=0n,p=>p.code='0x12']){
  const {client,provider}=fixture();await client.connect(provider);provider.onReceipt=stage=>{if(stage==='approval')change(provider);};
  await assert.rejects(()=>client.mint('genesis'));assert.equal(provider.sent.length,1);
 }
});
test('pending approval stays locked across refresh; recheck does not automatically mint',async()=>{
 const {client,provider,storage,config}=fixture();provider.pending=true;await client.connect(provider);
 await assert.rejects(()=>client.mint('genesis'),/still pending/);assert.equal(provider.sent.length,1);assert.ok(client.state.pending);
 await assert.rejects(()=>client.mint('genesis'),/already in progress/);
 const recovered=fixture(config,{storage}).client;await recovered.connect(provider);assert.ok(recovered.state.pending);
 provider.pending=false;await recovered.checkPending();assert.equal(recovered.state.pending,null);assert.equal(provider.sent.length,1);
});
test('pending mint recheck displays its NFT without sending a new transaction',async()=>{
 const {client,provider}=fixture();provider.allowance=API.GENESIS;provider.pending=true;await client.connect(provider);
 await assert.rejects(()=>client.mint('genesis'),/still pending/);assert.equal(client.state.pending.stage,'mint');
 provider.pending=false;await client.checkPending();assert.equal(client.state.minted.id,1n);assert.equal(provider.sent.length,1);
});
test('a reorg keeps pending lock until receipt is canonical again',async()=>{
 const {client,provider}=fixture();provider.reorg=true;await client.connect(provider);
 await assert.rejects(()=>client.mint('genesis'),/still pending/);assert.ok(client.state.pending);assert.equal(provider.sent.length,1);
 provider.reorg=false;await client.checkPending();assert.equal(client.state.pending,null);assert.equal(provider.sent.length,1);
});
test('simulation reverts stop before opening corresponding wallet transaction',async()=>{
 for(const stage of ['approval','mint']){
  const {client,provider}=fixture();provider.simulateFail=stage;await client.connect(provider);
  await assert.rejects(()=>client.mint('genesis'),/simulation reverted/);
  assert.equal(provider.sent.some(t=>t.stage===stage),false);
 }
});
test('double click cannot run concurrent approval/mint flows',async()=>{
 const {client,provider}=fixture();await client.connect(provider);
 const first=client.mint('genesis');await assert.rejects(()=>client.mint('genesis'),/already in progress/);await first;assert.equal(provider.sent.length,2);
});
test('unsafe metadata is rejected without replacing the actual artwork',async()=>{
 const {client,provider}=fixture();await client.connect(provider);provider.metadata={name:'NFT',image:'javascript:alert(1)'};
 await assert.rejects(()=>client.lookup(1),/Unexpected artwork/);
 provider.metadata={name:'NFT',image:'data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')};
 assert.match((await client.lookup(41)).image,/^data:image\/svg\+xml;base64,/);
});
test('accountsChanged emitted during wallet connection does not lose the connected session',async()=>{
 const {client,provider}=fixture();provider.onCall=method=>{if(method==='eth_requestAccounts')provider.emit('accountsChanged',[provider.account]);};
 await client.connect(provider);assert.equal(client.state.account,ACCOUNT);assert.equal(client.state.chainId,'0x1');assert.equal(client.state.ready,true);
});
test('closing the connection while the wallet prompt is open cannot reconnect it later',async()=>{
 const {client,provider}=fixture();provider.onCall=method=>{if(method==='eth_requestAccounts')client.disconnect();};
 await client.connect(provider);assert.equal(client.state.account,null);assert.equal(client.provider,null);
});
test('mint-client public API still refuses the retired VRF finalization ABI',()=>{
 assert.throws(()=>API.calldata(BUILD,'finalizeReveals(uint256)',[1]));assert.throws(()=>API.calldata(BUILD,'rawFulfillRandomWords(uint256,uint256[])',[1,[]]));
});
test('gas estimate includes room for a different next-block Mystery storage branch',async()=>{
 const {client,provider}=fixture();provider.minted=40n;await client.connect(provider);await client.mint('mystery');
 const tx=provider.sent.find(t=>t.stage==='mint');assert.ok(BigInt(tx.gas)>=BigInt('0x60000')+50000n);
});
