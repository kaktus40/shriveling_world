import{S as e,i as t,s as a,c as n,b as i,m as r,t as s,g as o,h as f,G as l,j as d,k as c,l as h,n as u,o as w,e as m,p as b,f as k,r as v,H as g,a as p,d as y,C as _,I as x,J as B}from"./client.19c5fbc1.js";import{c as A,M as S}from"./menu.72a7fc17.js";var C=A((function(e,t){var a="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;function n(e,t){return Object.prototype.hasOwnProperty.call(e,t)}t.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var a=t.shift();if(a){if("object"!=typeof a)throw new TypeError(a+"must be non-object");for(var i in a)n(a,i)&&(e[i]=a[i])}}return e},t.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var i={arraySet:function(e,t,a,n,i){if(t.subarray&&e.subarray)e.set(t.subarray(a,a+n),i);else for(var r=0;r<n;r++)e[i+r]=t[a+r]},flattenChunks:function(e){var t,a,n,i,r,s;for(n=0,t=0,a=e.length;t<a;t++)n+=e[t].length;for(s=new Uint8Array(n),i=0,t=0,a=e.length;t<a;t++)r=e[t],s.set(r,i),i+=r.length;return s}},r={arraySet:function(e,t,a,n,i){for(var r=0;r<n;r++)e[i+r]=t[a+r]},flattenChunks:function(e){return[].concat.apply([],e)}};t.setTyped=function(e){e?(t.Buf8=Uint8Array,t.Buf16=Uint16Array,t.Buf32=Int32Array,t.assign(t,i)):(t.Buf8=Array,t.Buf16=Array,t.Buf32=Array,t.assign(t,r))},t.setTyped(a)}));var z=function(e,t,a,n){for(var i=65535&e|0,r=e>>>16&65535|0,s=0;0!==a;){a-=s=a>2e3?2e3:a;do{r=r+(i=i+t[n++]|0)|0}while(--s);i%=65521,r%=65521}return i|r<<16|0};var $=function(){for(var e,t=[],a=0;a<256;a++){e=a;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[a]=e}return t}();var E=function(e,t,a,n){var i=$,r=n+a;e^=-1;for(var s=n;s<r;s++)e=e>>>8^i[255&(e^t[s])];return-1^e},j=function(e,t){var a,n,i,r,s,o,f,l,d,c,h,u,w,m,b,k,v,g,p,y,_,x,B,A,S;a=e.state,n=e.next_in,A=e.input,i=n+(e.avail_in-5),r=e.next_out,S=e.output,s=r-(t-e.avail_out),o=r+(e.avail_out-257),f=a.dmax,l=a.wsize,d=a.whave,c=a.wnext,h=a.window,u=a.hold,w=a.bits,m=a.lencode,b=a.distcode,k=(1<<a.lenbits)-1,v=(1<<a.distbits)-1;e:do{w<15&&(u+=A[n++]<<w,w+=8,u+=A[n++]<<w,w+=8),g=m[u&k];t:for(;;){if(u>>>=p=g>>>24,w-=p,0===(p=g>>>16&255))S[r++]=65535&g;else{if(!(16&p)){if(0==(64&p)){g=m[(65535&g)+(u&(1<<p)-1)];continue t}if(32&p){a.mode=12;break e}e.msg="invalid literal/length code",a.mode=30;break e}y=65535&g,(p&=15)&&(w<p&&(u+=A[n++]<<w,w+=8),y+=u&(1<<p)-1,u>>>=p,w-=p),w<15&&(u+=A[n++]<<w,w+=8,u+=A[n++]<<w,w+=8),g=b[u&v];a:for(;;){if(u>>>=p=g>>>24,w-=p,!(16&(p=g>>>16&255))){if(0==(64&p)){g=b[(65535&g)+(u&(1<<p)-1)];continue a}e.msg="invalid distance code",a.mode=30;break e}if(_=65535&g,w<(p&=15)&&(u+=A[n++]<<w,(w+=8)<p&&(u+=A[n++]<<w,w+=8)),(_+=u&(1<<p)-1)>f){e.msg="invalid distance too far back",a.mode=30;break e}if(u>>>=p,w-=p,_>(p=r-s)){if((p=_-p)>d&&a.sane){e.msg="invalid distance too far back",a.mode=30;break e}if(x=0,B=h,0===c){if(x+=l-p,p<y){y-=p;do{S[r++]=h[x++]}while(--p);x=r-_,B=S}}else if(c<p){if(x+=l+c-p,(p-=c)<y){y-=p;do{S[r++]=h[x++]}while(--p);if(x=0,c<y){y-=p=c;do{S[r++]=h[x++]}while(--p);x=r-_,B=S}}}else if(x+=c-p,p<y){y-=p;do{S[r++]=h[x++]}while(--p);x=r-_,B=S}for(;y>2;)S[r++]=B[x++],S[r++]=B[x++],S[r++]=B[x++],y-=3;y&&(S[r++]=B[x++],y>1&&(S[r++]=B[x++]))}else{x=r-_;do{S[r++]=S[x++],S[r++]=S[x++],S[r++]=S[x++],y-=3}while(y>2);y&&(S[r++]=S[x++],y>1&&(S[r++]=S[x++]))}break}}break}}while(n<i&&r<o);n-=y=w>>3,u&=(1<<(w-=y<<3))-1,e.next_in=n,e.next_out=r,e.avail_in=n<i?i-n+5:5-(n-i),e.avail_out=r<o?o-r+257:257-(r-o),a.hold=u,a.bits=w},I=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],D=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],U=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],P=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64],O=function(e,t,a,n,i,r,s,o){var f,l,d,c,h,u,w,m,b,k=o.bits,v=0,g=0,p=0,y=0,_=0,x=0,B=0,A=0,S=0,z=0,$=null,E=0,j=new C.Buf16(16),O=new C.Buf16(16),T=null,N=0;for(v=0;v<=15;v++)j[v]=0;for(g=0;g<n;g++)j[t[a+g]]++;for(_=k,y=15;y>=1&&0===j[y];y--);if(_>y&&(_=y),0===y)return i[r++]=20971520,i[r++]=20971520,o.bits=1,0;for(p=1;p<y&&0===j[p];p++);for(_<p&&(_=p),A=1,v=1;v<=15;v++)if(A<<=1,(A-=j[v])<0)return-1;if(A>0&&(0===e||1!==y))return-1;for(O[1]=0,v=1;v<15;v++)O[v+1]=O[v]+j[v];for(g=0;g<n;g++)0!==t[a+g]&&(s[O[t[a+g]]++]=g);if(0===e?($=T=s,u=19):1===e?($=I,E-=257,T=D,N-=257,u=256):($=U,T=P,u=-1),z=0,g=0,v=p,h=r,x=_,B=0,d=-1,c=(S=1<<_)-1,1===e&&S>852||2===e&&S>592)return 1;for(;;){w=v-B,s[g]<u?(m=0,b=s[g]):s[g]>u?(m=T[N+s[g]],b=$[E+s[g]]):(m=96,b=0),f=1<<v-B,p=l=1<<x;do{i[h+(z>>B)+(l-=f)]=w<<24|m<<16|b|0}while(0!==l);for(f=1<<v-1;z&f;)f>>=1;if(0!==f?(z&=f-1,z+=f):z=0,g++,0==--j[v]){if(v===y)break;v=t[a+s[g]]}if(v>_&&(z&c)!==d){for(0===B&&(B=_),h+=p,A=1<<(x=v-B);x+B<y&&!((A-=j[x+B])<=0);)x++,A<<=1;if(S+=1<<x,1===e&&S>852||2===e&&S>592)return 1;i[d=z&c]=_<<24|x<<16|h-r|0}}return 0!==z&&(i[h+z]=v-B<<24|64<<16|0),o.bits=_,0};function T(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function N(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new C.Buf16(320),this.work=new C.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function R(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=1,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new C.Buf32(852),t.distcode=t.distdyn=new C.Buf32(592),t.sane=1,t.back=-1,0):-2}function V(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,R(e)):-2}function G(e,t){var a,n;return e&&e.state?(n=e.state,t<0?(a=0,t=-t):(a=1+(t>>4),t<48&&(t&=15)),t&&(t<8||t>15)?-2:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=a,n.wbits=t,V(e))):-2}function H(e,t){var a,n;return e?(n=new N,e.state=n,n.window=null,0!==(a=G(e,t))&&(e.state=null),a):-2}var J,K,M=!0;function q(e){if(M){var t;for(J=new C.Buf32(512),K=new C.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(O(1,e.lens,0,288,J,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;O(2,e.lens,0,32,K,0,e.work,{bits:5}),M=!1}e.lencode=J,e.lenbits=9,e.distcode=K,e.distbits=5}function F(e,t,a,n){var i,r=e.state;return null===r.window&&(r.wsize=1<<r.wbits,r.wnext=0,r.whave=0,r.window=new C.Buf8(r.wsize)),n>=r.wsize?(C.arraySet(r.window,t,a-r.wsize,r.wsize,0),r.wnext=0,r.whave=r.wsize):((i=r.wsize-r.wnext)>n&&(i=n),C.arraySet(r.window,t,a-n,i,r.wnext),(n-=i)?(C.arraySet(r.window,t,a-n,n,0),r.wnext=n,r.whave=r.wsize):(r.wnext+=i,r.wnext===r.wsize&&(r.wnext=0),r.whave<r.wsize&&(r.whave+=i))),0}var L={inflateReset:V,inflateReset2:G,inflateResetKeep:R,inflateInit:function(e){return H(e,15)},inflateInit2:H,inflate:function(e,t){var a,n,i,r,s,o,f,l,d,c,h,u,w,m,b,k,v,g,p,y,_,x,B,A,S=0,$=new C.Buf8(4),I=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return-2;12===(a=e.state).mode&&(a.mode=13),s=e.next_out,i=e.output,f=e.avail_out,r=e.next_in,n=e.input,o=e.avail_in,l=a.hold,d=a.bits,c=o,h=f,x=0;e:for(;;)switch(a.mode){case 1:if(0===a.wrap){a.mode=13;break}for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(2&a.wrap&&35615===l){a.check=0,$[0]=255&l,$[1]=l>>>8&255,a.check=E(a.check,$,2,0),l=0,d=0,a.mode=2;break}if(a.flags=0,a.head&&(a.head.done=!1),!(1&a.wrap)||(((255&l)<<8)+(l>>8))%31){e.msg="incorrect header check",a.mode=30;break}if(8!=(15&l)){e.msg="unknown compression method",a.mode=30;break}if(d-=4,_=8+(15&(l>>>=4)),0===a.wbits)a.wbits=_;else if(_>a.wbits){e.msg="invalid window size",a.mode=30;break}a.dmax=1<<_,e.adler=a.check=1,a.mode=512&l?10:12,l=0,d=0;break;case 2:for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(a.flags=l,8!=(255&a.flags)){e.msg="unknown compression method",a.mode=30;break}if(57344&a.flags){e.msg="unknown header flags set",a.mode=30;break}a.head&&(a.head.text=l>>8&1),512&a.flags&&($[0]=255&l,$[1]=l>>>8&255,a.check=E(a.check,$,2,0)),l=0,d=0,a.mode=3;case 3:for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.head&&(a.head.time=l),512&a.flags&&($[0]=255&l,$[1]=l>>>8&255,$[2]=l>>>16&255,$[3]=l>>>24&255,a.check=E(a.check,$,4,0)),l=0,d=0,a.mode=4;case 4:for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.head&&(a.head.xflags=255&l,a.head.os=l>>8),512&a.flags&&($[0]=255&l,$[1]=l>>>8&255,a.check=E(a.check,$,2,0)),l=0,d=0,a.mode=5;case 5:if(1024&a.flags){for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.length=l,a.head&&(a.head.extra_len=l),512&a.flags&&($[0]=255&l,$[1]=l>>>8&255,a.check=E(a.check,$,2,0)),l=0,d=0}else a.head&&(a.head.extra=null);a.mode=6;case 6:if(1024&a.flags&&((u=a.length)>o&&(u=o),u&&(a.head&&(_=a.head.extra_len-a.length,a.head.extra||(a.head.extra=new Array(a.head.extra_len)),C.arraySet(a.head.extra,n,r,u,_)),512&a.flags&&(a.check=E(a.check,n,u,r)),o-=u,r+=u,a.length-=u),a.length))break e;a.length=0,a.mode=7;case 7:if(2048&a.flags){if(0===o)break e;u=0;do{_=n[r+u++],a.head&&_&&a.length<65536&&(a.head.name+=String.fromCharCode(_))}while(_&&u<o);if(512&a.flags&&(a.check=E(a.check,n,u,r)),o-=u,r+=u,_)break e}else a.head&&(a.head.name=null);a.length=0,a.mode=8;case 8:if(4096&a.flags){if(0===o)break e;u=0;do{_=n[r+u++],a.head&&_&&a.length<65536&&(a.head.comment+=String.fromCharCode(_))}while(_&&u<o);if(512&a.flags&&(a.check=E(a.check,n,u,r)),o-=u,r+=u,_)break e}else a.head&&(a.head.comment=null);a.mode=9;case 9:if(512&a.flags){for(;d<16;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l!==(65535&a.check)){e.msg="header crc mismatch",a.mode=30;break}l=0,d=0}a.head&&(a.head.hcrc=a.flags>>9&1,a.head.done=!0),e.adler=a.check=0,a.mode=12;break;case 10:for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}e.adler=a.check=T(l),l=0,d=0,a.mode=11;case 11:if(0===a.havedict)return e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,a.hold=l,a.bits=d,2;e.adler=a.check=1,a.mode=12;case 12:if(5===t||6===t)break e;case 13:if(a.last){l>>>=7&d,d-=7&d,a.mode=27;break}for(;d<3;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}switch(a.last=1&l,d-=1,3&(l>>>=1)){case 0:a.mode=14;break;case 1:if(q(a),a.mode=20,6===t){l>>>=2,d-=2;break e}break;case 2:a.mode=17;break;case 3:e.msg="invalid block type",a.mode=30}l>>>=2,d-=2;break;case 14:for(l>>>=7&d,d-=7&d;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if((65535&l)!=(l>>>16^65535)){e.msg="invalid stored block lengths",a.mode=30;break}if(a.length=65535&l,l=0,d=0,a.mode=15,6===t)break e;case 15:a.mode=16;case 16:if(u=a.length){if(u>o&&(u=o),u>f&&(u=f),0===u)break e;C.arraySet(i,n,r,u,s),o-=u,r+=u,f-=u,s+=u,a.length-=u;break}a.mode=12;break;case 17:for(;d<14;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(a.nlen=257+(31&l),l>>>=5,d-=5,a.ndist=1+(31&l),l>>>=5,d-=5,a.ncode=4+(15&l),l>>>=4,d-=4,a.nlen>286||a.ndist>30){e.msg="too many length or distance symbols",a.mode=30;break}a.have=0,a.mode=18;case 18:for(;a.have<a.ncode;){for(;d<3;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.lens[I[a.have++]]=7&l,l>>>=3,d-=3}for(;a.have<19;)a.lens[I[a.have++]]=0;if(a.lencode=a.lendyn,a.lenbits=7,B={bits:a.lenbits},x=O(0,a.lens,0,19,a.lencode,0,a.work,B),a.lenbits=B.bits,x){e.msg="invalid code lengths set",a.mode=30;break}a.have=0,a.mode=19;case 19:for(;a.have<a.nlen+a.ndist;){for(;k=(S=a.lencode[l&(1<<a.lenbits)-1])>>>16&255,v=65535&S,!((b=S>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(v<16)l>>>=b,d-=b,a.lens[a.have++]=v;else{if(16===v){for(A=b+2;d<A;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l>>>=b,d-=b,0===a.have){e.msg="invalid bit length repeat",a.mode=30;break}_=a.lens[a.have-1],u=3+(3&l),l>>>=2,d-=2}else if(17===v){for(A=b+3;d<A;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}d-=b,_=0,u=3+(7&(l>>>=b)),l>>>=3,d-=3}else{for(A=b+7;d<A;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}d-=b,_=0,u=11+(127&(l>>>=b)),l>>>=7,d-=7}if(a.have+u>a.nlen+a.ndist){e.msg="invalid bit length repeat",a.mode=30;break}for(;u--;)a.lens[a.have++]=_}}if(30===a.mode)break;if(0===a.lens[256]){e.msg="invalid code -- missing end-of-block",a.mode=30;break}if(a.lenbits=9,B={bits:a.lenbits},x=O(1,a.lens,0,a.nlen,a.lencode,0,a.work,B),a.lenbits=B.bits,x){e.msg="invalid literal/lengths set",a.mode=30;break}if(a.distbits=6,a.distcode=a.distdyn,B={bits:a.distbits},x=O(2,a.lens,a.nlen,a.ndist,a.distcode,0,a.work,B),a.distbits=B.bits,x){e.msg="invalid distances set",a.mode=30;break}if(a.mode=20,6===t)break e;case 20:a.mode=21;case 21:if(o>=6&&f>=258){e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,a.hold=l,a.bits=d,j(e,h),s=e.next_out,i=e.output,f=e.avail_out,r=e.next_in,n=e.input,o=e.avail_in,l=a.hold,d=a.bits,12===a.mode&&(a.back=-1);break}for(a.back=0;k=(S=a.lencode[l&(1<<a.lenbits)-1])>>>16&255,v=65535&S,!((b=S>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(k&&0==(240&k)){for(g=b,p=k,y=v;k=(S=a.lencode[y+((l&(1<<g+p)-1)>>g)])>>>16&255,v=65535&S,!(g+(b=S>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,a.back+=g}if(l>>>=b,d-=b,a.back+=b,a.length=v,0===k){a.mode=26;break}if(32&k){a.back=-1,a.mode=12;break}if(64&k){e.msg="invalid literal/length code",a.mode=30;break}a.extra=15&k,a.mode=22;case 22:if(a.extra){for(A=a.extra;d<A;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.length+=l&(1<<a.extra)-1,l>>>=a.extra,d-=a.extra,a.back+=a.extra}a.was=a.length,a.mode=23;case 23:for(;k=(S=a.distcode[l&(1<<a.distbits)-1])>>>16&255,v=65535&S,!((b=S>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(0==(240&k)){for(g=b,p=k,y=v;k=(S=a.distcode[y+((l&(1<<g+p)-1)>>g)])>>>16&255,v=65535&S,!(g+(b=S>>>24)<=d);){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}l>>>=g,d-=g,a.back+=g}if(l>>>=b,d-=b,a.back+=b,64&k){e.msg="invalid distance code",a.mode=30;break}a.offset=v,a.extra=15&k,a.mode=24;case 24:if(a.extra){for(A=a.extra;d<A;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}a.offset+=l&(1<<a.extra)-1,l>>>=a.extra,d-=a.extra,a.back+=a.extra}if(a.offset>a.dmax){e.msg="invalid distance too far back",a.mode=30;break}a.mode=25;case 25:if(0===f)break e;if(u=h-f,a.offset>u){if((u=a.offset-u)>a.whave&&a.sane){e.msg="invalid distance too far back",a.mode=30;break}u>a.wnext?(u-=a.wnext,w=a.wsize-u):w=a.wnext-u,u>a.length&&(u=a.length),m=a.window}else m=i,w=s-a.offset,u=a.length;u>f&&(u=f),f-=u,a.length-=u;do{i[s++]=m[w++]}while(--u);0===a.length&&(a.mode=21);break;case 26:if(0===f)break e;i[s++]=a.length,f--,a.mode=21;break;case 27:if(a.wrap){for(;d<32;){if(0===o)break e;o--,l|=n[r++]<<d,d+=8}if(h-=f,e.total_out+=h,a.total+=h,h&&(e.adler=a.check=a.flags?E(a.check,i,h,s-h):z(a.check,i,h,s-h)),h=f,(a.flags?l:T(l))!==a.check){e.msg="incorrect data check",a.mode=30;break}l=0,d=0}a.mode=28;case 28:if(a.wrap&&a.flags){for(;d<32;){if(0===o)break e;o--,l+=n[r++]<<d,d+=8}if(l!==(4294967295&a.total)){e.msg="incorrect length check",a.mode=30;break}l=0,d=0}a.mode=29;case 29:x=1;break e;case 30:x=-3;break e;case 31:return-4;case 32:default:return-2}return e.next_out=s,e.avail_out=f,e.next_in=r,e.avail_in=o,a.hold=l,a.bits=d,(a.wsize||h!==e.avail_out&&a.mode<30&&(a.mode<27||4!==t))&&F(e,e.output,e.next_out,h-e.avail_out),c-=e.avail_in,h-=e.avail_out,e.total_in+=c,e.total_out+=h,a.total+=h,a.wrap&&h&&(e.adler=a.check=a.flags?E(a.check,i,h,e.next_out-h):z(a.check,i,h,e.next_out-h)),e.data_type=a.bits+(a.last?64:0)+(12===a.mode?128:0)+(20===a.mode||15===a.mode?256:0),(0===c&&0===h||4===t)&&0===x&&(x=-5),x},inflateEnd:function(e){if(!e||!e.state)return-2;var t=e.state;return t.window&&(t.window=null),e.state=null,0},inflateGetHeader:function(e,t){var a;return e&&e.state?0==(2&(a=e.state).wrap)?-2:(a.head=t,t.done=!1,0):-2},inflateSetDictionary:function(e,t){var a,n=t.length;return e&&e.state?0!==(a=e.state).wrap&&11!==a.mode?-2:11===a.mode&&z(1,t,n,0)!==a.check?-3:F(e,t,n,n)?(a.mode=31,-4):(a.havedict=1,0):-2},inflateInfo:"pako inflate (from Nodeca project)"},Q=!0,W=!0;try{String.fromCharCode.apply(null,[0])}catch(e){Q=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){W=!1}for(var X=new C.Buf8(256),Y=0;Y<256;Y++)X[Y]=Y>=252?6:Y>=248?5:Y>=240?4:Y>=224?3:Y>=192?2:1;X[254]=X[254]=1;function Z(e,t){if(t<65534&&(e.subarray&&W||!e.subarray&&Q))return String.fromCharCode.apply(null,C.shrinkBuf(e,t));for(var a="",n=0;n<t;n++)a+=String.fromCharCode(e[n]);return a}var ee=function(e){var t,a,n,i,r,s=e.length,o=0;for(i=0;i<s;i++)55296==(64512&(a=e.charCodeAt(i)))&&i+1<s&&56320==(64512&(n=e.charCodeAt(i+1)))&&(a=65536+(a-55296<<10)+(n-56320),i++),o+=a<128?1:a<2048?2:a<65536?3:4;for(t=new C.Buf8(o),r=0,i=0;r<o;i++)55296==(64512&(a=e.charCodeAt(i)))&&i+1<s&&56320==(64512&(n=e.charCodeAt(i+1)))&&(a=65536+(a-55296<<10)+(n-56320),i++),a<128?t[r++]=a:a<2048?(t[r++]=192|a>>>6,t[r++]=128|63&a):a<65536?(t[r++]=224|a>>>12,t[r++]=128|a>>>6&63,t[r++]=128|63&a):(t[r++]=240|a>>>18,t[r++]=128|a>>>12&63,t[r++]=128|a>>>6&63,t[r++]=128|63&a);return t},te=function(e){for(var t=new C.Buf8(e.length),a=0,n=t.length;a<n;a++)t[a]=e.charCodeAt(a);return t},ae=function(e,t){var a,n,i,r,s=t||e.length,o=new Array(2*s);for(n=0,a=0;a<s;)if((i=e[a++])<128)o[n++]=i;else if((r=X[i])>4)o[n++]=65533,a+=r-1;else{for(i&=2===r?31:3===r?15:7;r>1&&a<s;)i=i<<6|63&e[a++],r--;r>1?o[n++]=65533:i<65536?o[n++]=i:(i-=65536,o[n++]=55296|i>>10&1023,o[n++]=56320|1023&i)}return Z(o,n)},ne=function(e,t){var a;for((t=t||e.length)>e.length&&(t=e.length),a=t-1;a>=0&&128==(192&e[a]);)a--;return a<0||0===a?t:a+X[e[a]]>t?a:t},ie=0,re=2,se=4,oe=0,fe=1,le=2,de=-5,ce={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"};var he=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0};var ue=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1},we=Object.prototype.toString;function me(e){if(!(this instanceof me))return new me(e);this.options=C.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options;t.raw&&t.windowBits>=0&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(t.windowBits>=0&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),t.windowBits>15&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new he,this.strm.avail_out=0;var a=L.inflateInit2(this.strm,t.windowBits);if(a!==oe)throw new Error(ce[a]);if(this.header=new ue,L.inflateGetHeader(this.strm,this.header),t.dictionary&&("string"==typeof t.dictionary?t.dictionary=ee(t.dictionary):"[object ArrayBuffer]"===we.call(t.dictionary)&&(t.dictionary=new Uint8Array(t.dictionary)),t.raw&&(a=L.inflateSetDictionary(this.strm,t.dictionary))!==oe))throw new Error(ce[a])}me.prototype.push=function(e,t){var a,n,i,r,s,o=this.strm,f=this.options.chunkSize,l=this.options.dictionary,d=!1;if(this.ended)return!1;n=t===~~t?t:!0===t?se:ie,"string"==typeof e?o.input=te(e):"[object ArrayBuffer]"===we.call(e)?o.input=new Uint8Array(e):o.input=e,o.next_in=0,o.avail_in=o.input.length;do{if(0===o.avail_out&&(o.output=new C.Buf8(f),o.next_out=0,o.avail_out=f),(a=L.inflate(o,ie))===le&&l&&(a=L.inflateSetDictionary(this.strm,l)),a===de&&!0===d&&(a=oe,d=!1),a!==fe&&a!==oe)return this.onEnd(a),this.ended=!0,!1;o.next_out&&(0!==o.avail_out&&a!==fe&&(0!==o.avail_in||n!==se&&n!==re)||("string"===this.options.to?(i=ne(o.output,o.next_out),r=o.next_out-i,s=ae(o.output,i),o.next_out=r,o.avail_out=f-r,r&&C.arraySet(o.output,o.output,i,r,0),this.onData(s)):this.onData(C.shrinkBuf(o.output,o.next_out)))),0===o.avail_in&&0===o.avail_out&&(d=!0)}while((o.avail_in>0||0===o.avail_out)&&a!==fe);return a===fe&&(n=se),n===se?(a=L.inflateEnd(this.strm),this.onEnd(a),this.ended=!0,a===oe):n!==re||(this.onEnd(oe),o.avail_out=0,!0)},me.prototype.onData=function(e){this.chunks.push(e)},me.prototype.onEnd=function(e){e===oe&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=C.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg};var be=function(e,t){var a=new me(t);if(a.push(e,!0),a.err)throw a.msg||ce[a.err];return a.result};function ke(e,t,a){const n=e.slice();return n[8]=t[a],n[10]=a,n}function ve(e){let t,a,n,i=e[8]+"";return{c(){t=d("div"),a=c(i),this.h()},l(e){t=h(e,"DIV",{"data-name":!0});var n=u(t);a=w(n,i),n.forEach(m),this.h()},h(){b(t,"data-name",n=e[8])},m(e,n){k(e,t,n),v(t,a)},p(e,r){1&r&&i!==(i=e[8]+"")&&g(a,i),1&r&&n!==(n=e[8])&&b(t,"data-name",n)},d(e){e&&m(t)}}}function ge(e){let t,a,n,i,r,s,o,f=e[0],l=[];for(let t=0;t<f.length;t+=1)l[t]=ve(ke(e,f,t));return{c(){t=d("div"),a=p(),n=d("div");for(let e=0;e<l.length;e+=1)l[e].c();i=p(),r=d("div"),this.h()},l(e){t=h(e,"DIV",{class:!0}),u(t).forEach(m),a=y(e),n=h(e,"DIV",{class:!0});var s=u(n);for(let e=0;e<l.length;e+=1)l[e].l(s);s.forEach(m),i=y(e),r=h(e,"DIV",{class:!0}),u(r).forEach(m),this.h()},h(){b(t,"class","app svelte-1y8o06u"),b(n,"class","dataset svelte-1y8o06u"),b(r,"class","dat svelte-1y8o06u")},m(f,d){k(f,t,d),e[4](t),k(f,a,d),k(f,n,d);for(let e=0;e<l.length;e+=1)l[e].m(n,null);k(f,i,d),k(f,r,d),e[5](r),s||(o=_(r,"click",e[3]),s=!0)},p(e,t){if(1&t){let a;for(f=e[0],a=0;a<f.length;a+=1){const i=ke(e,f,a);l[a]?l[a].p(i,t):(l[a]=ve(i),l[a].c(),l[a].m(n,null))}for(;a<l.length;a+=1)l[a].d(1);l.length=f.length}},d(f){f&&m(t),e[4](null),f&&m(a),f&&m(n),x(l,f),f&&m(i),f&&m(r),e[5](null),s=!1,o()}}}function pe(e){let t,a;return t=new S({props:{fixed:!1,$$slots:{default:[ge]},$$scope:{ctx:e}}}),{c(){n(t.$$.fragment)},l(e){i(t.$$.fragment,e)},m(e,n){r(t,e,n),a=!0},p(e,[a]){const n={};2055&a&&(n.$$scope={dirty:a,ctx:e}),t.$set(n)},i(e){a||(s(t.$$.fragment,e),a=!0)},o(e){o(t.$$.fragment,e),a=!1},d(e){f(t,e)}}}var ye=function(e,t,a,n){return new(a||(a=Promise))((function(i,r){function s(e){try{f(n.next(e))}catch(e){r(e)}}function o(e){try{f(n.throw(e))}catch(e){r(e)}}function f(e){var t;e.done?i(e.value):(t=e.value,t instanceof a?t:new a((function(e){e(t)}))).then(s,o)}f((n=n.apply(e,t||[])).next())}))};function _e(){return ye(this,void 0,void 0,(function*(){const e=yield this.fetch("datasets/datasets.json");return{datasets:yield e.json()}}))}function xe(e,t,a){var n=this&&this.__awaiter||function(e,t,a,n){return new(a||(a=Promise))((function(i,r){function s(e){try{f(n.next(e))}catch(e){r(e)}}function o(e){try{f(n.throw(e))}catch(e){r(e)}}function f(e){var t;e.done?i(e.value):(t=e.value,t instanceof a?t:new a((function(e){e(t)}))).then(s,o)}f((n=n.apply(e,t||[])).next())}))};let i,r,s,{datasets:o}=t;return l((()=>n(void 0,void 0,void 0,(function*(){const e=(yield Promise.all([import("./bigBoard.0f8ed6aa.js"),__inject_styles(["client-325e7710.css","menu-4060ac3b.css"])]).then((function(e){return e[0]}))).default;i=new e(r,s)})))),e.$$set=e=>{"datasets"in e&&a(0,o=e.datasets)},[o,r,s,function(e){return n(this,void 0,void 0,(function*(){const t=e.target.dataset.name;if(void 0!==t){const e=yield fetch("datasets/"+t).then((e=>n(this,void 0,void 0,(function*(){return e.arrayBuffer().then((e=>new Uint8Array(e)))})))),a=JSON.parse(new TextDecoder("utf-8").decode(be(e)));i.cleanAll(a)}}))},function(e){B[e?"unshift":"push"]((()=>{r=e,a(1,r)}))},function(e){B[e?"unshift":"push"]((()=>{s=e,a(2,s)}))}]}export default class extends e{constructor(e){super(),t(this,e,xe,pe,a,{datasets:0})}}export{_e as preload};

import __inject_styles from './inject_styles.5607aec6.js';