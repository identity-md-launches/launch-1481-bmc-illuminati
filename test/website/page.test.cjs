const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {ROOT,CONFIG,API,BUILD}=require('./harness.cjs');

test('inherited compiled application, CSS and identity assets remain intact and all routes remain represented',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/website-preservation.json')));
 for(const asset of report.preservedAssets){
  const bytes=fs.readFileSync(path.join(ROOT,'website',asset.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.path);
 }
 const app=fs.readFileSync(path.join(ROOT,'website/site.js'),'utf8');
 for(const route of ['/pass','/swap','/staking','/burns','/dashboard','/community'])assert.ok(app.includes('"'+route+'"'),route);
});
test('production root and mint pages declare share metadata, strict script CSP and valid relative local assets',()=>{
 for(const file of ['index.html','mint/index.html']){
  const html=fs.readFileSync(path.join(ROOT,'dist',file),'utf8');
  for(const marker of ['<title>','name="description"','property="og:title"','property="og:image"','rel="icon"','Content-Security-Policy'])assert.ok(html.includes(marker),`${file}: ${marker}`);
  assert.match(html,/script-src 'self';/);assert.doesNotMatch(html,/script-src[^;]*(unsafe-inline|unsafe-eval|https:)/);
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   if(/^(https?:|#|data:)/.test(match[1]))continue;
   assert.ok(!match[1].startsWith('/'),'asset URL must work below a static subpath');
   const local=match[1].split(/[?#]/)[0];assert.ok(fs.existsSync(path.resolve(ROOT,'dist',path.dirname(file),local)),match[1]);
  }
  for(const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.match(match[0],/rel="noopener noreferrer"/);
 }
});
test('shipped production is gated by the deployment conflict and contains no staking or community stand-ins',()=>{
 assert.equal(CONFIG.MODE,'PRE_LAUNCH');assert.equal(CONFIG.DEPLOYMENT_CONFLICT,true);assert.equal(API.configuredLive(CONFIG,BUILD),false);
 assert.equal(CONFIG.STAKING.address,null);assert.equal(CONFIG.STAKING.enabled,false);
 assert.equal(CONFIG.COMMUNITY.x,null);assert.equal(CONFIG.COMMUNITY.telegram,null);
 const html=fs.readFileSync(path.join(ROOT,'dist/mint/index.html'),'utf8');
 for(const id of ['mint-genesis','mint-mystery','reveal-pending'])assert.match(html,new RegExp(`<button[^>]*id="${id}"[^>]*disabled`));
 assert.match(html,/not cryptographically manipulation-resistant/);assert.match(html,/8,191/);
});
test('runtime pins are backed by recorded public bytes and artwork previews cover every immutable original',()=>{
 const bytes=JSON.parse(fs.readFileSync(path.join(ROOT,'test/website/fixtures/runtime.json')));
 assert.equal(createHash('sha256').update(Buffer.from(bytes.pass.slice(2),'hex')).digest('hex'),CONFIG.READ_RUNTIME_SHA256);
 assert.equal(createHash('sha256').update(Buffer.from(bytes.bmc.slice(2),'hex')).digest('hex'),CONFIG.BMC_RUNTIME_SHA256);
 const previews=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/artwork-previews.json'))),originals=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/genesis-verification.json')));
 assert.equal(previews.images.length,77);
 for(let i=0;i<77;i++){
  const preview=previews.images[i];assert.equal(preview.originalSha256,originals.images[i].sha256);
  const source=fs.readFileSync(path.join(ROOT,'website/artwork/genesis',preview.file));
  assert.equal(createHash('sha256').update(source).digest('hex'),preview.previewSha256);
  assert.deepEqual(source,fs.readFileSync(path.join(ROOT,'dist/artwork/genesis',preview.file)));
 }
 for(let i=1;i<=12;i++)assert.match(fs.readFileSync(path.join(ROOT,`dist/artwork/standard/standard-${i}.svg`),'utf8'),/^<svg/);
});
