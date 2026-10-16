import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewAuth, memoryStorage, validateCredentials, passwordQuality, safeDestination, SESSION_KEY, IDLE_LIMIT } from '../src/auth/service.js';
import { authPage, onboardingPage, authTitles } from '../src/auth/pages.js';
import { securitySettings } from '../src/auth/security.js';
const sample = { name:'Alex Morgan',email:'alex@example.com',password:'Sample-Password123',terms:'on' };
function fixture() {
  let time = 1800000000000;
  const local = memoryStorage(), tab = memoryStorage();
  const client = createPreviewAuth({local,tab,now:()=>time});
  return {client,local,tab,advance(ms){time+=ms},time:()=>time};
}

test('sign-up validates inputs and requires successful email verification',()=>{
  const {client}=fixture();
  assert(client.beginSignUp({...sample,terms:false}).errors.terms);
  assert(client.beginSignUp({...sample,password:'short'}).errors.password);
  assert(client.beginSignUp({...sample,email:'wrong'}).errors.email);
  assert(client.beginSignUp(sample).challenge);
  assert.equal(client.getSession(),null);
  assert.throws(()=>client.verifyEmail('000000'),/does not match/);
  assert.equal(client.getSession(),null);
  const session=client.verifyEmail('246810');
  assert.equal(session.user.email,sample.email);
  assert.equal(session.user.verified,true);
  assert.equal(session.user.onboardingComplete,false);
  assert.throws(()=>client.verifyEmail('246810'),/expired/);
});
test('onboarding persists identity, preferences, and the completion boundary',()=>{
  const {client,local,tab}=fixture();
  client.beginSignUp(sample); client.verifyEmail('246810');
  const result=client.completeOnboarding({name:'Alex',timezone:'UTC',source:'Both',risk:.5,markets:['Forex'],email:'injected@other.example',id:'other'});
  assert.equal(result.user.id,'preview:alex%40example.com');
  assert.equal(result.user.email,sample.email);
  assert.equal(result.user.onboardingComplete,true);
  const newClient=createPreviewAuth({local,tab,now:()=>result.lastActiveAt});
  assert.equal(newClient.getSession().user.timezone,'UTC');
});
test('passwords are absent from all persisted state',()=>{
  const {client,local,tab}=fixture();
  client.beginSignUp(sample); client.verifyEmail('246810'); client.completeOnboarding({name:'Alex'});
  const keys=['edgebook.auth.preview.profiles.v1','edgebook.auth.preview.challenge.v1',SESSION_KEY];
  for(const storage of [local,tab])for(const key of keys){const text=storage.getItem(key)||'';assert(!text.includes(sample.password));assert(!text.includes('"password"'));}
});
test('tab-only and remembered sessions have distinct lifetimes',()=>{
  const {client,local,tab,time}=fixture();
  client.signIn({email:'trader@edgebook.demo',password:'sample'});
  assert(tab.getItem(SESSION_KEY)); assert.equal(local.getItem(SESSION_KEY),null);
  assert.equal(createPreviewAuth({local,tab:memoryStorage(),now:time}).getSession(),null);
  client.signIn({email:'trader@edgebook.demo',password:'sample',remember:true});
  assert(local.getItem(SESSION_KEY)); assert.equal(tab.getItem(SESSION_KEY),null);
  assert(createPreviewAuth({local,tab:memoryStorage(),now:time}).getSession());
});
test('idle expiry and activity touch are enforced at the boundary',()=>{
  const f=fixture(); f.client.enterDemo();
  f.advance(IDLE_LIMIT-1); assert(f.client.getSession());
  f.advance(1); assert.equal(f.client.getSession(),null);
  f.client.enterDemo(); f.advance(IDLE_LIMIT-1000); f.client.getSession({touch:true});
  f.advance(2000); assert(f.client.getSession());
});
test('verification expiry and resend cooldown have honest recovery states',()=>{
  const f=fixture();f.client.beginSignUp(sample);
  assert.throws(()=>f.client.resend(),/30 seconds/);
  f.advance(30000);assert(f.client.resend());
  f.advance(10*60000);assert.throws(()=>f.client.verifyEmail('246810'),/expired/);
});
test('password reset handles mismatches, one-time links, and signed-out state',()=>{
  const f=fixture();f.client.enterDemo();
  assert.throws(()=>f.client.requestReset('wrong'),/valid email/);
  f.client.requestReset(sample.email);
  assert(f.client.resetPassword({password:sample.password,confirmPassword:'different'}).errors.confirmPassword);
  assert(f.client.getChallenge());
  assert(f.client.resetPassword({password:sample.password,confirmPassword:sample.password}).success);
  assert.equal(f.client.getSession(),null);assert.equal(f.client.getChallenge(),null);
  assert.throws(()=>f.client.resetPassword({password:sample.password,confirmPassword:sample.password}),/expired/);
});
test('reset-link expiry prevents submitting an old preview',()=>{
  const f=fixture();f.client.requestReset(sample.email);f.advance(30*60000);
  assert.throws(()=>f.client.resetPassword({password:sample.password,confirmPassword:sample.password}),/expired/);
});
test('second-step preview gates entry until a valid sample code',()=>{
  const f=fixture();f.client.enterDemo();f.client.setMfa(true);f.client.signOut();
  const result=f.client.signIn({email:'trader@edgebook.demo',password:'sample'});
  assert.equal(result.challenge.type,'mfa');assert.equal(f.client.getSession(),null);
  assert.throws(()=>f.client.verifyMfa('000000'),/preview verification/);
  assert(f.client.verifyMfa('246810').user.mfa);
  f.client.setMfa(false);f.client.signOut();
  assert(f.client.signIn({email:'trader@edgebook.demo',password:'sample'}).session);
});
test('sign-out clears preview sessions without erasing workspace data',()=>{
  const f=fixture();f.local.setItem('edgebook.workspace.v1','journal-data');f.client.enterDemo();f.client.signOut();
  assert.equal(f.client.getSession(),null);assert.equal(f.local.getItem('edgebook.workspace.v1'),'journal-data');
});
test('malformed session data and external redirects are rejected',()=>{
  const f=fixture();f.local.setItem(SESSION_KEY,'{bad');assert.equal(f.client.getSession(),null);
  f.local.setItem(SESSION_KEY,JSON.stringify({mode:'preview',user:{id:'demo',email:'demo@example.com'}}));assert.equal(f.client.getSession(),null);
  assert.equal(safeDestination('https://outside.example',['overview','trades']),'overview');
  assert.equal(safeDestination('//outside.example',['overview','trades']),'overview');
  assert.equal(safeDestination('trades',['overview','trades']),'trades');
});
test('password feedback and sign-in/sign-up validation differ appropriately',()=>{
  assert.equal(passwordQuality('Short1').valid,false);
  assert.equal(passwordQuality(sample.password).valid,true);
  assert.equal(passwordQuality(sample.password).score,4);
  assert.deepEqual(validateCredentials({email:sample.email,password:'sample'}),{});
  assert(validateCredentials({...sample,name:' '},{signup:true}).name);
});
test('all auth, onboarding, and security screens render readable preview states',()=>{
  const state={route:'sign-in',values:{email:'test@example.com'},errors:{},busy:false,message:'',onboardingStep:0,onboarding:{name:'Alex',timezone:'UTC',intention:'Build consistency and discipline',source:'Both',markets:['Forex','Gold'],risk:.5,start:'demo'},challenge:{email:'test@example.com'}};
  for(const route of Object.keys(authTitles)){
    const html=authPage({...state,route});assert(!html.includes('undefined'),route);assert(!html.includes('NaN'),route);
    assert(html.includes('UI/UX preview'),route);assert(html.includes('Passwords are never stored or sent'),route);
  }
  for(const onboardingStep of [0,1,2]){const html=onboardingPage({...state,onboardingStep});assert(!html.includes('undefined'));assert(html.includes('auth-onboarding-form'));}
  const html=authPage({...state,route:'sign-up',values:{name:'<script>alert(1)</script>',email:'x@example.com'}});
  assert(!html.includes('<script>alert(1)</script>'));assert(html.includes('&lt;script&gt;'));
  const security=securitySettings({user:{name:'Alex',email:sample.email,mfa:true}},{name:'Alex'});
  assert(security.includes('role="switch" aria-checked="true"'));assert(security.includes('No real account'));
});
