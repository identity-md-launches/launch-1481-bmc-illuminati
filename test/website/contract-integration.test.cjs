/* Actual compiled bytecode + actual UI transaction client, isolated Anvil only; no external RPC. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {API,BUILD,TOKEN,ROOT,MemoryStorage,liveConfig,word}=require('./harness.cjs');
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}

test('offline Anvil: exact approvals, real burnFrom and all 500 real contract mints through the UI ABI', {timeout:60000}, async()=>{
 const port=await freePort();
 const anvil=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','1','--silent'],{stdio:['ignore','pipe','pipe']});
 let exited=null;anvil.on('error',e=>exited=e);anvil.on('exit',code=>exited=new Error(`anvil exited ${code}`));
 let counter=1;
 const rpc=async(method,params=[])=>{
  const response=await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:counter++,method,params})});
  const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});return result.result;
 };
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(exited)throw exited;
   try{await rpc('eth_chainId');ready=true;break;}catch{await new Promise(r=>setTimeout(r,20));}
  }
  assert.ok(ready,'Anvil did not start');
  const mined=async(hash)=>{
   for(let i=0;i<20;i++){
    await rpc('evm_mine');
    const receipt=await rpc('eth_getTransactionReceipt',[hash]);
    // Two more blocks: Anvil may seal the transaction in the first evm_mine, and a Mystery reveal needs the block after the mint block to be final.
    if(receipt){await rpc('evm_mine');await rpc('evm_mine');return receipt;}
    await new Promise(r=>setTimeout(r,10));
   }
   throw new Error('Local transaction did not mine');
  };
  const [account]=await rpc('eth_accounts');
  const mock=JSON.parse(fs.readFileSync(path.join(ROOT,'out/MockBMC.sol/MockBMC.json')));
  const passArtifact=JSON.parse(fs.readFileSync(path.join(ROOT,'out/BMCIlluminatiPass.sol/BMCIlluminatiPass.json')));
  // Local test chain only: emulate the existing BMC at its specified address, without a key.
  await rpc('anvil_setCode',[API.BMC,mock.deployedBytecode.object]);
  const creation=passArtifact.bytecode.object+word(BigInt(account)).slice(2)+word(BigInt(API.BMC)).slice(2);
  const deployment=await rpc('eth_sendTransaction',[{from:account,data:creation,gas:'0x989680'}]);
  const deployed=await mined(deployment);assert.equal(deployed.status,'0x1');
  const pass=deployed.contractAddress;
  // Chain id 1: the launch gate is closed until the explicit owner (the deploying test account) opens it once.
  assert.equal(await rpc('eth_call',[{to:pass,data:API.calldata(BUILD,'mintingOpen()')},'latest']),word(0));
  await mined(await rpc('eth_sendTransaction',[{from:account,to:pass,data:API.calldata(BUILD,'openMinting()'),gas:'0xf4240'}]));
  assert.equal(await rpc('eth_call',[{to:pass,data:API.calldata(BUILD,'mintingOpen()')},'latest']),word(1));
  const mintData='0x'+mock.methodIdentifiers['mint(address,uint256)']+word(BigInt(account)).slice(2)+word(201000000n*10n**18n).slice(2);
  await mined(await rpc('eth_sendTransaction',[{from:account,to:API.BMC,data:mintData,gas:'0xf4240'}]));
  const config=liveConfig();config.PASS_ADDRESS=pass;config.LAUNCH.REVIEWED_RUNTIME_SHA256=await API.sha256Hex(await rpc('eth_getCode',[pass,'latest']));
  const sends=[];
  const provider={async request({method,params=[]}){
   if(method==='eth_requestAccounts')return [account];
   if(method==='eth_sendTransaction'){
    sends.push(params[0]);
    const tx={...params[0]};if(!tx.gas)tx.gas='0x'+(BigInt(await rpc('eth_estimateGas',[tx]))*3n/2n+50000n).toString(16);
    const hash=await rpc(method,[tx]);assert.equal((await mined(hash)).status,'0x1');return hash;
   }
   return rpc(method,params);
  }};
  const client=new API.MintClient(config,BUILD,TOKEN,{storage:new MemoryStorage(),maxPolls:3,pollMs:1,confirmTransaction:async()=>true});
  await client.connect(provider);assert.equal(client.state.ready,true);
  await client.mint('genesis');
  assert.equal(client.state.minted.id,1n);assert.match(client.state.minted.metadata.image,/genesis-01.png$/);
  assert.equal(sends.length,2);assert.equal(sends[0].data,API.calldata(TOKEN,'approve(address,uint256)',[pass,API.GENESIS]));
  assert.equal(client.state.allowance,0n);
  // Fill the remaining Genesis supply with the same exact approval/mint calls (no UI polling overhead).
  for(let i=1;i<40;i++){
   await provider.request({method:'eth_sendTransaction',params:[{from:account,to:API.BMC,data:API.calldata(TOKEN,'approve(address,uint256)',[pass,API.GENESIS])}]});
   await provider.request({method:'eth_sendTransaction',params:[{from:account,to:pass,data:API.calldata(BUILD,'mintGenesis()')}]});
  }
  await client.mint('mystery');assert.equal(client.state.minted.pending,true);await client.reveal();assert.equal(client.state.minted.id,41n);assert.ok(client.state.minted.metadata);
  assert.equal(client.state.minted.pending,false);assert.equal(sends.length,83);assert.equal(sends[82].to,pass);assert.equal(sends[82].data,API.calldata(BUILD,'reveal(uint256)',[1n]));
  assert.equal(client.state.stats.burned,40350000n*10n**18n);assert.equal(client.state.stats.pending,0n);
  const art=new Set();let genesis=0,standard=0;
  // Mint the entire inventory to verify the UI metadata decoder against real PNG and SVG tokenURIs.
  for(let id=41;id<=500;id++){
   if(id>41){
    await provider.request({method:'eth_sendTransaction',params:[{from:account,to:API.BMC,data:API.calldata(TOKEN,'approve(address,uint256)',[pass,API.MYSTERY])}]});
    await provider.request({method:'eth_sendTransaction',params:[{from:account,to:pass,data:API.calldata(BUILD,'mintMystery()')}]});
    // Unrevealed until the next block's hash exists; the mined() helper advanced the chain past it.
    assert.equal(await rpc('eth_call',[{to:pass,data:API.calldata(BUILD,'tierOf(uint256)',[id])},'latest']),word(0));
    await provider.request({method:'eth_sendTransaction',params:[{from:account,to:pass,data:API.calldata(BUILD,'reveal(uint256)',[1n])}]});
   }
   const data=await client.lookup(id);assert.equal(art.has(data.image),false,'duplicate artwork');art.add(data.image);
   if(data.image.startsWith('data:image/svg+xml;base64,')){
    ++standard;assert.match(Buffer.from(data.image.split(',')[1],'base64').toString(),/<svg/);
   }else{++genesis;assert.match(data.image,/genesis-(4[1-9]|[5-6][0-9]|7[0-7])\.png$/);}
  }
  await client.refresh();assert.equal(client.state.stats.minted,500n);assert.equal(client.state.stats.remaining,0n);
  assert.equal(client.state.stats.burned,201000000n*10n**18n);assert.equal(client.state.balance,0n);
  assert.equal(genesis,37);assert.equal(standard,423);
  assert.equal(await rpc('eth_call',[{to:API.BMC,data:API.calldata(TOKEN,'totalSupply()')},'latest']),word(0));
  assert.equal(await rpc('eth_call',[{to:API.BMC,data:API.calldata(TOKEN,'balanceOf(address)',[pass])},'latest']),word(0));
  const before=sends.length;await assert.rejects(()=>client.mint('mystery'),/500 passes/);assert.equal(sends.length,before);
 }finally{anvil.kill('SIGTERM');}
});
