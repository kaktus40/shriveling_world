import{S as t,i as e,s,c as a,a as c,m as n,t as r,b as o,d as f,G as i,e as l,w as m,g as h,h as u,k as $,x as d,l as p,n as _}from"./client.7ec37c78.js";import{M as S}from"./menu.3306987a.js";function g(t){let e,s,a,c=t[0].html+"";return{c(){e=l("aside"),s=m(),a=l("article"),this.h()},l(t){e=h(t,"ASIDE",{id:!0,class:!0}),u(e).forEach($),s=d(t),a=h(t,"ARTICLE",{id:!0,class:!0}),u(a).forEach($),this.h()},h(){p(e,"id","toc"),p(e,"class","svelte-1mpyt2k"),p(a,"id","content"),p(a,"class","svelte-1mpyt2k")},m(t,n){_(t,e,n),_(t,s,n),_(t,a,n),a.innerHTML=c},p(t,e){1&e&&c!==(c=t[0].html+"")&&(a.innerHTML=c)},d(t){t&&$(e),t&&$(s),t&&$(a)}}}function w(t){let e,s;return e=new S({props:{$$slots:{default:[g]},$$scope:{ctx:t}}}),{c(){a(e.$$.fragment)},l(t){c(e.$$.fragment,t)},m(t,a){n(e,t,a),s=!0},p(t,[s]){const a={};9&s&&(a.$$scope={dirty:s,ctx:t}),e.$set(a)},i(t){s||(r(e.$$.fragment,t),s=!0)},o(t){o(e.$$.fragment,t),s=!1},d(t){f(e,t)}}}async function j({params:t}){const e=await this.fetch(`marks/${t.slug.join("/")}.json`);return{article:await e.json()}}function x(t,e,s){let{article:a}=e;const c={tocSelector:"#toc",contentSelector:"#content",headingSelector:"h1, h2, h3"};return i((async()=>{await Promise.all([import("./tocbot.40c0bafe.js"),__inject_styles(["client-325e7710.css","menu-178d3906.css"])]).then((function(t){return t[0]})).then((function(t){return t.t})),window.tocbot.init(c)})),t.$$set=t=>{"article"in t&&s(0,a=t.article)},[a]}export default class extends t{constructor(t){super(),e(this,t,x,w,s,{article:0})}}export{j as preload};

import __inject_styles from './inject_styles.5607aec6.js';