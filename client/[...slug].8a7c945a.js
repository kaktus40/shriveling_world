import{S as t,i as s,s as e,c as a,a as c,m as n,t as o,b as r,d as f,G as i,e as l,w as m,g as h,h as $,k as d,x as u,l as p,n as _}from"./client.a6b4b3c0.js";import{M as S}from"./menu.e6904254.js";function g(t){let s,e,a,c=t[0].html+"";return{c(){s=l("aside"),e=m(),a=l("article"),this.h()},l(t){s=h(t,"ASIDE",{id:!0,class:!0}),$(s).forEach(d),e=u(t),a=h(t,"ARTICLE",{id:!0,class:!0}),$(a).forEach(d),this.h()},h(){p(s,"id","toc"),p(s,"class","svelte-1mpyt2k"),p(a,"id","content"),p(a,"class","svelte-1mpyt2k")},m(t,n){_(t,s,n),_(t,e,n),_(t,a,n),a.innerHTML=c},p(t,s){1&s&&c!==(c=t[0].html+"")&&(a.innerHTML=c)},d(t){t&&d(s),t&&d(e),t&&d(a)}}}function w(t){let s,e;return s=new S({props:{$$slots:{default:[g]},$$scope:{ctx:t}}}),{c(){a(s.$$.fragment)},l(t){c(s.$$.fragment,t)},m(t,a){n(s,t,a),e=!0},p(t,[e]){const a={};9&e&&(a.$$scope={dirty:e,ctx:t}),s.$set(a)},i(t){e||(o(s.$$.fragment,t),e=!0)},o(t){r(s.$$.fragment,t),e=!1},d(t){f(s,t)}}}async function b({params:t}){const s=await this.fetch(`marks/${t.slug.join("/")}.json`);return{article:await s.json()}}function j(t,s,e){let{article:a}=s;const c={tocSelector:"#toc",contentSelector:"#content",headingSelector:"h1, h2, h3"};return i((async()=>{await Promise.all([import("./tocbot.d38ac79f.js"),]).then((function(t){return t[0]})),window.tocbot.init(c)})),t.$$set=t=>{"article"in t&&e(0,a=t.article)},[a]}export default class extends t{constructor(t){super(),s(this,t,j,w,e,{article:0})}}export{b as preload};
