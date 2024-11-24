async function z(F){try{console.log("[generator] Starting MHTML generation");let J=await A(F);console.log("[generator] Collected resources:",J.length);let k=Q(F);console.log("[generator] Created header:",k);let O=j(F);console.log("[generator] Main content length:",O.length);let K=J.map(q);console.log("[generator] Resource parts:",K.length);let V=[k,`--REPUBFOX-MHTML-BOUNDARY\r
${O}`,...K.map((f)=>`--REPUBFOX-MHTML-BOUNDARY\r
${f}`),`--REPUBFOX-MHTML-BOUNDARY--\r
`].join(`\r
`);return console.log("[generator] MHTML structure (first 500 chars):",V.substring(0,500)),new TextEncoder().encode(V)}catch(J){throw console.error("[generator] Error generating MHTML:",J),J}}function Q(F){let J=F.location.href,k=["From: Saved by RepubFox","Subject: "+F.title,"Date: "+new Date().toUTCString(),"MIME-Version: 1.0",'Content-Type: multipart/related; boundary="REPUBFOX-MHTML-BOUNDARY"',"Snapshot-Content-Location: "+J].join(`\r
`);return console.log("[generator] Header created:",k),k+`\r
\r
`}function S(F){console.log("[generator] Original text sample (first 1000 chars):",F.slice(0,1000));let J=F.replace(/\r\n|\n|\r/g,`\r
`),O=new TextEncoder().encode(J),K="";for(let W=0;W<O.length;W++){let $=O[W];if($===void 0)continue;if($>=33&&$<=126&&$!==61||$===32&&W+1<O.length&&O[W+1]!==13&&O[W+1]!==10||$===9&&W+1<O.length&&O[W+1]!==13&&O[W+1]!==10)K+=String.fromCharCode($);else K+="="+$.toString(16).toUpperCase().padStart(2,"0")}let Z=76,V=[],Y="";for(let W=0;W<K.length;){if(K[W]==="="&&W+2<K.length){let $=K.slice(W,W+3);if(Y.length>=Z-$.length){V.push(Y+"="),Y="";continue}Y+=$,W+=3;continue}if(Y.length>=Z-1){V.push(Y+"="),Y="";continue}Y+=K[W],W++}if(Y)V.push(Y);let f=V.join(`\r
`);return console.log("[generator] Encoded text sample (first 1000 chars):",f.slice(0,1000)),f}function j(F){let J=F.location.href,k=`<meta name="mhtml-location" content="${J}">`,O=`<base href="${J}">`,K=F.documentElement.outerHTML;if(!K.includes("<head"))K=K.replace("<html","<html><head></head>");K=K.replace(/<head[^>]*>/,`$&${k}${O}`),K=`<!DOCTYPE html>
${K}`;let Z=S(K),V=["Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: quoted-printable","Content-Location: "+J,"",Z].join(`\r
`);return console.log("[generator] Main content created with Content-Type: text/html"),console.log("[generator] Content length:",Z.length),V}function q(F){let k=[`Content-Type: ${F.contentType.includes("charset=")?F.contentType:`${F.contentType}; charset=utf-8`}`,"Content-Transfer-Encoding: base64","Content-Location: "+F.url,"",F.content].join(`\r
`);return console.log("[generator] Resource part created for:",F.url),k}async function A(F){let J=[],k=new Set,O=F.getElementsByTagName("img");for(let Z of O){let V=Z.src;if(V&&!V.startsWith("data:")&&!k.has(V))try{let f=await(await fetch(V)).blob(),$=(await B(f)).split(",")[1];if($)J.push({url:V,content:$,contentType:f.type||"application/octet-stream"}),k.add(V)}catch(Y){console.warn(`Failed to fetch image: ${V}`,Y)}}let K=F.styleSheets;for(let Z of K)if(Z.href&&!k.has(Z.href))try{let Y=await(await fetch(Z.href)).text();J.push({url:Z.href,content:btoa(Y),contentType:"text/css"}),k.add(Z.href)}catch(V){console.warn(`Failed to fetch stylesheet: ${Z.href}`,V)}return J}function B(F){return new Promise((J,k)=>{let O=new FileReader;O.onloadend=()=>J(O.result),O.onerror=k,O.readAsDataURL(F)})}console.log("[content] Content script loaded");browser.runtime.onMessage.addListener((F,J)=>{if(console.log("[content] Received message",{type:F.type,sender:J}),F.type==="capture-mhtml")try{return console.log("[content] Starting MHTML capture..."),console.log("[content] Document title:",document.title),console.log("[content] Document URL:",document.location.href),console.log("[content] Document has images:",document.getElementsByTagName("img").length),console.log("[content] Document has stylesheets:",document.styleSheets.length),z(document).then((k)=>{return console.log("[content] MHTML capture completed, size:",k.byteLength),{success:!0,data:k}}).catch((k)=>{return console.error("[content] MHTML capture failed:",k),{success:!1,error:k instanceof Error?k.message:String(k)}})}catch(k){return console.error("[content] MHTML capture failed (sync):",k),Promise.resolve({success:!1,error:k instanceof Error?k.message:String(k)})}return console.log("[content] Unhandled message type:",F.type),Promise.resolve(void 0)});
