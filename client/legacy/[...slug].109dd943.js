import{r as t,_ as n,a as e,b as r,c,i as a,d as s,S as o,s as f,e as i,f as u,m as l,g as p,t as h,h as m,j as d,N as $,k as v,D as _,n as y,o as b,q as x,E as S,u as g,v as j}from"./client.bbb42da4.js";import{_ as w}from"./asyncToGenerator.5229e80b.js";import{M as E}from"./menu.48b079d6.js";function R(t){var n=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Date.prototype.toString.call(Reflect.construct(Date,[],(function(){}))),!0}catch(t){return!1}}();return function(){var c,a=e(t);if(n){var s=e(this).constructor;c=Reflect.construct(a,arguments,s)}else c=a.apply(this,arguments);return r(this,c)}}function k(t){var n,e,r,c=t[0].html+"";return{c:function(){n=v("aside"),e=_(),r=v("article"),this.h()},l:function(t){n=y(t,"ASIDE",{id:!0,class:!0}),b(n).forEach(x),e=S(t),r=y(t,"ARTICLE",{id:!0,class:!0}),b(r).forEach(x),this.h()},h:function(){g(n,"id","toc"),g(n,"class","svelte-1mpyt2k"),g(r,"id","content"),g(r,"class","svelte-1mpyt2k")},m:function(t,a){j(t,n,a),j(t,e,a),j(t,r,a),r.innerHTML=c},p:function(t,n){1&n&&c!==(c=t[0].html+"")&&(r.innerHTML=c)},d:function(t){t&&x(n),t&&x(e),t&&x(r)}}}function T(t){var n,e;return n=new E({props:{$$slots:{default:[k]},$$scope:{ctx:t}}}),{c:function(){i(n.$$.fragment)},l:function(t){u(n.$$.fragment,t)},m:function(t,r){l(n,t,r),e=!0},p:function(t,e){var r=p(e,1)[0],c={};9&r&&(c.$$scope={dirty:r,ctx:t}),n.$set(c)},i:function(t){e||(h(n.$$.fragment,t),e=!0)},o:function(t){m(n.$$.fragment,t),e=!1},d:function(t){d(n,t)}}}function D(t){return I.apply(this,arguments)}function I(){return(I=w(t.mark((function n(e){var r,c,a;return t.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return r=e.params,t.next=3,this.fetch("marks/".concat(r.slug.join("/"),".json"));case 3:return c=t.sent,t.next=6,c.json();case 6:return a=t.sent,t.abrupt("return",{article:a});case 8:case"end":return t.stop()}}),n,this)})))).apply(this,arguments)}function P(n,e,r){var c=e.article,a={tocSelector:"#toc",contentSelector:"#content",headingSelector:"h1, h2, h3"};return $(w(t.mark((function n(){return t.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,Promise.all([import("./tocbot.970bfe5a.js"),__inject_styles(["client-325e7710.css"])]).then((function(t){return t[0]})).then((function(t){return t.t}));case 2:window.tocbot.init(a);case 3:case"end":return t.stop()}}),n)})))),n.$$set=function(t){"article"in t&&r(0,c=t.article)},[c]}var A=function(t){n(r,o);var e=R(r);function r(t){var n;return c(this,r),n=e.call(this),a(s(n),t,P,T,f,{article:0}),n}return r}();export default A;export{D as preload};

import __inject_styles from './inject_styles.fe622066.js';