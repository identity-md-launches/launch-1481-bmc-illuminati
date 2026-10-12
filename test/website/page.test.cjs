const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {createHash,webcrypto}=require('node:crypto');
const {Provider,ROOT}=require('./harness.cjs');
class Element {
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.children=[];this.listeners=new Map();this.attributes={};
  this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.value='';
  const classes=new Set();this.classList={add:c=>classes.add(c),contains:c=>classes.has(c),toggle:(c,value)=>value?classes.add(c):classes.delete(c)};
 }
 append(...nodes){this.children.push(...nodes);}
 appendChild(node){this.append(node);return node;}
 prepend(node){this.children.unshift(node);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(event,fn){this.listeners.set(event,fn);}
 querySelector(selector){return selector==='[data-bmc-mint-link]'?this.children.find(c=>c.attributes?.['data-bmc-mint-link']!==undefined):null;}
}
function page(provider){
 const html=fs.readFileSync(path.join(ROOT,'website/mint/index.html'),'utf8'),nodes=new Map();
 for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const element=new Element(match[1]);element.id=match[2];element.disabled=/\sdisabled(?:[\s>])/.test(match[0]);element.hidden=/\shidden(?:[\s>])/.test(match[0]);
  element.src=/src="([^"]+)"/.exec(match[0])?.[1];nodes.set(element.id,element);
 }
 const events=new Map(),document={getElementById:id=>{assert.ok(nodes.has(id),`missing #${id}`);return nodes.get(id);},createElement:tag=>new Element(tag)};
 const sandbox={document,ethereum:provider,TextEncoder,TextDecoder,crypto:webcrypto,atob,Event,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setInterval:()=>{},setTimeout,
  addEventListener:(event,fn)=>events.set(event,fn),dispatchEvent:()=>{}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const file of ['config.js','pass-abi.js','bmc-abi.js','mint-client.js','app.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,'website',file),'utf8'),sandbox,{filename:file});
 return{nodes,events,sandbox};
}
test('mint page initializes offline, disables real buttons, and issues no connection prompt on load',async()=>{
 const provider=new Provider(),{nodes}=page(provider);
 assert.equal(provider.calls.length,0);
 assert.equal(nodes.get('mint-genesis').disabled,true);assert.equal(nodes.get('mint-mystery').disabled,true);
 assert.match(nodes.get('launch-title').textContent,/BMC PASS — Coming Soon/);
 assert.equal(nodes.get('supply').textContent,'— / 500');assert.equal(nodes.get('remaining').textContent,'—');
 await nodes.get('connect').onclick();assert.match(nodes.get('network').textContent,/Ethereum Mainnet/);
 assert.match(nodes.get('balance').textContent,/BMC/);assert.equal(nodes.get('account').textContent,provider.account);
 await nodes.get('mint-genesis').onclick();nodes.get('risk-accepted').checked=true;await nodes.get('mint-mystery').onclick();
 assert.equal(provider.sent.length,0);
 nodes.get('disconnect').onclick();assert.equal(nodes.get('account').textContent,'No wallet connected');
});
test('UI displays wallet refusals, absent wallets and wrong-network warnings safely',async()=>{
 const {nodes:absent}=page(null);await absent.get('connect').onclick();assert.match(absent.get('message').textContent,/No injected wallet/);
 const provider=new Provider();provider.reject='connect';const{nodes}=page(provider);
 await nodes.get('connect').onclick();assert.match(nodes.get('message').textContent,/rejected/i);
 provider.reject=null;provider.chain='0x38';await nodes.get('connect').onclick();
 assert.match(nodes.get('network').textContent,/Wrong network/);assert.equal(nodes.get('switch-network').hidden,false);
 assert.equal(nodes.get('mint-genesis').disabled,true);assert.equal(nodes.get('balance').textContent,'—');
});
test('all 77 previews use exact IPFS filenames and failures are visible without substitution',()=>{
 const{nodes}=page(null);const figures=nodes.get('gallery').children;assert.equal(figures.length,77);
 for(let i=0;i<77;i++){
  const image=figures[i].children[0];assert.equal(image.src,`https://silver-active-lungfish-941.mypinata.cloud/ipfs/bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u/genesis-${String(i+1).padStart(2,'0')}.png`);
 }
 const image=figures[4].children[0],original=image.src;image.listeners.get('error')();
 assert.equal(image.src,original);assert.match(nodes.get('artwork-status').textContent,/Unable to load: genesis-05.png/);
 nodes.get('legendary').listeners.get('error')();assert.equal(nodes.get('hero-art-error').hidden,false);
});
test('published homepage application, styles and assets remain byte-for-byte intact',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/website-preservation.json')));
 for(const asset of report.preservedAssets){
  const bytes=fs.readFileSync(path.join(ROOT,'website',asset.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.path);
 }
 let html=fs.readFileSync(path.join(ROOT,'website/index.html'),'utf8');
 html=html.replace('    <link rel="stylesheet" href="./mint-nav.css" />\n    <script defer src="./mint-nav.js"></script>\n','');
 assert.equal(createHash('sha256').update(html).digest('hex'),report.originalIndexSha256);
 const app=fs.readFileSync(path.join(ROOT,'website/assets/index-C3VUAmkN.js'),'utf8');
 for(const route of ['/pass','/swap','/staking','/burns','/dashboard','/community'])assert.ok(app.includes(route));
});
test('navigation integration adds exactly one functional link and preserves the original actions',()=>{
 const actions=new Element(),original=new Element('button');actions.append(original);
 const document={querySelector:selector=>selector==='.header-actions'?actions:null,getElementById:()=>new Element(),createElement:tag=>new Element(tag)};
 let observe;
 const sandbox={document,MutationObserver:class{constructor(fn){observe=fn;}observe(){}}};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'website/mint-nav.js'),'utf8'),sandbox);
 observe();observe();assert.equal(actions.children.length,2);assert.equal(actions.children[1],original);
 assert.equal(actions.children[0].textContent,'MINT BMC PASS');assert.equal(actions.children[0].href,'./mint/');
});
test('public page never calls the deterministic ABI or claims tamper-proof randomness',()=>{
 const html=fs.readFileSync(path.join(ROOT,'website/mint/index.html'),'utf8');
 assert.match(html,/not cryptographically manipulation-resistant/);assert.match(html,/not Chainlink VRF/);
 assert.match(html,/This is not guaranteed fairness or tamper-proof randomness/);
 assert.match(html,/<button[^>]+id="mint-genesis"[^>]+disabled/);
 assert.match(html,/<button[^>]+id="mint-mystery"[^>]+disabled/);
 for(const match of html.matchAll(/(?:src|href)="(\.\.[^"]+)"/g)){
  if(match[1].includes('#'))continue;
  assert.ok(fs.existsSync(path.resolve(ROOT,'website/mint',match[1])),`missing asset ${match[1]}`);
 }
});
