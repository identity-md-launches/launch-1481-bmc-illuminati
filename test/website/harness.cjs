const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {EventEmitter} = require('node:events');
const ROOT = path.resolve(__dirname, '../..');
const context = vm.createContext({window: {}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'website/config.js'), 'utf8'), context);
require('../../website/pass-abi.js');
require('../../website/bmc-abi.js');
const API = require('../../website/mint-client.js');
const BUILD = global.BMC_PASS_BUILD, TOKEN = global.BMC_TOKEN_BUILD;
const CONFIG = context.window.BMC_PASS_CONFIG;
// Isolated test fixtures only. No deployment or production configuration uses these addresses.
const ACCOUNT = '0x' + '11'.repeat(20), OTHER = '0x' + '22'.repeat(20), PASS = '0x' + '33'.repeat(20);
const CODE = '0x6001600055';
const HASH = '0x' + 'ab'.repeat(32);
const word = n => '0x' + BigInt(n).toString(16).padStart(64,'0');
function str(s) {
  const hex = Buffer.from(s).toString('hex');
  return word(32) + word(hex.length / 2).slice(2) + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
}
function liveConfig() {
  return {...CONFIG, MODE:'LIVE', PASS_ADDRESS: PASS, LAUNCH: {...CONFIG.LAUNCH,
    SOURCE_REPOSITORY:'https://example.test/reviewed-source', SOURCE_COMMIT:'a'.repeat(40),
    CONFIRMED_ABI_SHA256:BUILD.abiSha256, REVIEWED_RUNTIME_SHA256:createHash('sha256').update(Buffer.from(CODE.slice(2),'hex')).digest('hex'),
    EXPLORER_VERIFIED:true, SECURITY_FINDINGS_ADDRESSED:true, DEPLOYED_MINT_AND_BURN_VALIDATED:true,
    PUBLIC_MINT_AUTHORIZATION:'Test fixture: local simulation only',
  }};
}
class MemoryStorage {
  constructor(){this.values=new Map();}
  getItem(key){return this.values.get(key) || null;}
  setItem(key,value){this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
class Provider extends EventEmitter {
  constructor() {
    super(); this.calls=[]; this.sent=[]; this.account=ACCOUNT; this.chain='0x1'; this.code=CODE;
    this.balance=API.GENESIS * 1000n; this.allowance=0n; this.minted=0n;
    this.remainingGenesis=37n; this.remainingStandard=423n; this.decimals=18n; this.pendingCount=0n; this.open=true;
    this.receipts=new Map(); this.pending=false; this.reject=null; this.revert=null; this.metadata=null;
    this.onReceipt=null; this.beforeSend=null; this.onCall=null;
  }
  get price(){return this.minted>=500n?0n:this.minted<40n?API.GENESIS:API.MYSTERY;}
  async request({method,params=[]}) {
    this.calls.push({method,params});
    if(this.onCall) await this.onCall(method,params);
    if(method==='eth_requestAccounts' || method==='eth_accounts') {
      if(method==='eth_requestAccounts' && this.reject==='connect') throw Object.assign(new Error('User rejected'),{code:4001});
      return this.account?[this.account]:[];
    }
    if(method==='eth_chainId') return this.chain;
    if(method==='wallet_switchEthereumChain'){this.chain=params[0].chainId;this.emit('chainChanged',this.chain);return null;}
    if(method==='eth_getCode') return this.code;
    if(method==='eth_estimateGas') return '0x60000';
    if(method==='eth_blockNumber') return '0x10';
    if(method==='eth_getBlockByNumber') return {hash:this.reorg?'0x'+'cd'.repeat(32):HASH};
    if(method==='eth_call') return this.read(params[0]);
    if(method==='eth_sendTransaction') {
      const tx=params[0], stage=tx.to.toLowerCase()===API.BMC?'approval':tx.data.startsWith('0x'+BUILD.selectors['reveal(uint256)'])?'reveal':'mint';
      if(this.beforeSend) this.beforeSend(stage);
      if(this.reject===stage) throw Object.assign(new Error('User rejected'),{code:4001});
      const hash=word(this.sent.length+1); this.sent.push({...tx,hash,stage}); return hash;
    }
    if(method==='eth_getTransactionReceipt') {
      if(this.pending) return null;
      const tx=this.sent.find(t=>t.hash===params[0]);
      if(!tx) return null;
      if(!this.receipts.has(tx.hash)) {
        const status=this.revert===tx.stage?'0x0':'0x1';
        let logs=[];
        if(status==='0x1') {
          if(tx.stage==='approval' && !this.ignoreApproval) this.allowance=BigInt('0x'+tx.data.slice(74,138));
          if(tx.stage==='mint') {
            const price=this.price; ++this.minted;
            this.allowance-=price;this.balance-=price;
            if(this.minted>40n)++this.pendingCount;
            logs=[{address:PASS,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',word(0),word(BigInt(tx.from)),word(this.minted)],data:'0x'}];
          }
          if(tx.stage==='reveal'){let n=BigInt('0x'+tx.data.slice(10));if(n>this.pendingCount)n=this.pendingCount;this.pendingCount-=n;this.remainingStandard-=n;}
        }
        const receipt={transactionHash:tx.hash,from:tx.from,to:tx.to,blockNumber:'0xe',blockHash:HASH,status,logs};
        this.receipts.set(tx.hash,receipt);
        if(this.onReceipt) this.onReceipt(tx.stage,receipt);
      }
      return this.receipts.get(tx.hash);
    }
    throw new Error('Unexpected RPC '+method);
  }
  read(tx) {
    const token=tx.to.toLowerCase()===API.BMC;
    const sig=Object.entries(token?TOKEN.selectors:BUILD.selectors).find(([k,v])=>'0x'+v===tx.data.slice(0,10))?.[0];
    if(token) {
      if(sig==='decimals()') return word(this.decimals);
      if(sig==='balanceOf(address)') return word(this.balance);
      if(sig==='allowance(address,address)') return word(this.allowance);
      if(sig==='approve(address,uint256)') { if(this.simulateFail==='approval') throw new Error('Approval simulation reverted'); return word(1); }
    } else {
      const values={'BMC()':BigInt(API.BMC),'MAX_SUPPLY()':500n,'GENESIS_PRICE()':API.GENESIS,'MYSTERY_PRICE()':API.MYSTERY,
        'supportsInterface(bytes4)':1n,'totalMinted()':this.minted,'remainingSupply()':500n-this.minted,
        'totalBurned()':(this.minted<40n?this.minted:40n)*API.GENESIS+(this.minted>40n?this.minted-40n:0n)*API.MYSTERY,
        'currentPrice()':this.price,'remainingMysteryGenesis()':this.remainingGenesis,'remainingMysteryStandard()':this.remainingStandard,
        'pendingReveals()':this.pendingCount,'mintingOpen()':this.open?1n:0n,'tierOf(uint256)':this.pendingCount>0n?0n:3n,'reveal(uint256)':this.pendingCount};
      if(sig in values) return word(values[sig]);
      if(sig==='genesisImagesCID()') return str(API.CID);
      if(sig==='name()') return str('BMC Illuminati Pass');
      if(sig==='symbol()') return str('BMCPASS');
      if(sig==='tokenURI(uint256)') {
        const data=this.metadata || {name:`BMC Illuminati Pass #${this.minted}`,image:`ipfs://${API.CID}/genesis-01.png`};
        return str('data:application/json;base64,'+Buffer.from(JSON.stringify(data)).toString('base64'));
      }
      if(['mintGenesis()','mintMystery()'].includes(sig)){if(this.simulateFail==='mint')throw new Error('Mint simulation reverted');return word(this.minted+1n);}
    }
    throw new Error('Unexpected eth_call '+sig);
  }
}
function fixture(config=liveConfig(), options={}) {
  const provider=new Provider(), events=[], storage=options.storage || new MemoryStorage();
  const client=new API.MintClient(config, BUILD, TOKEN, {pollMs:1,maxPolls:2,sleep:async()=>{},storage,onTransaction:e=>events.push(e),...options});
  return {client,provider,events,storage,config};
}
module.exports={API,BUILD,TOKEN,CONFIG,ACCOUNT,OTHER,PASS,CODE,word,str,liveConfig,fixture,Provider,MemoryStorage,ROOT};
