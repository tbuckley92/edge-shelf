import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPair,SignJWT} from 'jose';import {verifyIdentityToken} from '../server/auth.mjs';import {randomToken} from '../server/security.mjs';
test('OIDC verifier accepts signed identity and rejects wrong signature, expiry, issuer, audience, nonce',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const other=await generateKeyPair('RS256');
 const c={issuer:'https://shopify.com/authentication/110118535493',clientId:'test-client'},nonce=randomToken();
 const sign=(overrides={},key=privateKey)=>new SignJWT({nonce,...overrides}).setProtectedHeader({alg:'RS256'}).setSubject('customer-subject').setIssuer(overrides.iss||c.issuer).setAudience(overrides.aud||c.clientId).setIssuedAt().setExpirationTime(overrides.exp||'1h').sign(key);
 const good=await sign();assert.equal((await verifyIdentityToken(good,publicKey,c,nonce)).sub,'customer-subject');
 for(const token of [await sign({},other.privateKey),await sign({exp:Math.floor(Date.now()/1000)-120}),await sign({iss:'https://evil'}),await sign({aud:'other'}),await sign({nonce:randomToken()})])await assert.rejects(verifyIdentityToken(token,publicKey,c,nonce));
});
