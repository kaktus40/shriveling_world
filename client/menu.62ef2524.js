import{S as a,i as e,s,p as t,g as r,h as l,k as i,l as o,q as n,n as c,o as f,r as h,u,v as p,e as v,f as d,c as m,w as x,j as $,a as g,x as j,m as E,t as z,y as b,z as w,b as y,d as L,A,B as D,C as I,D as B,E as U}from"./client.c6631c63.js";function C(a){let e,s,u;return{c(){e=t("svg"),s=t("path"),this.h()},l(a){e=r(a,"svg",{"aria-hidden":!0,class:!0,role:!0,xmlns:!0,viewBox:!0},1);var t=l(e);s=r(t,"path",{fill:!0,d:!0},1),l(s).forEach(i),t.forEach(i),this.h()},h(){o(s,"fill","currentColor"),o(s,"d",a[0]),o(e,"aria-hidden","true"),o(e,"class",u=n(a[1])+" svelte-1d15yci"),o(e,"role","img"),o(e,"xmlns","http://www.w3.org/2000/svg"),o(e,"viewBox",a[2])},m(a,t){c(a,e,t),f(e,s)},p(a,[t]){1&t&&o(s,"d",a[0]),2&t&&u!==(u=n(a[1])+" svelte-1d15yci")&&o(e,"class",u),4&t&&o(e,"viewBox",a[2])},i:h,o:h,d(a){a&&i(e)}}}function F(a,e,s){let{icon:t}=e,r=[],l="",i="";return a.$$set=a=>{s(4,e=u(u({},e),p(a))),"icon"in a&&s(3,t=a.icon)},a.$$.update=()=>{8&a.$$.dirty&&s(2,i="0 0 "+t.icon[0]+" "+t.icon[1]),s(1,l="fa-svelte "+(e.class?e.class:"")),8&a.$$.dirty&&s(0,r=t.icon[4])},e=p(e),[r,l,i,t]}class M extends a{constructor(a){super(),e(this,a,F,C,s,{icon:3})}}var N="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function T(a,e,s){return a(s={path:e,exports:{},require:function(a,e){return S(null==e&&s.path)}},s.exports),s.exports}function S(){throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs")}var q=T((function(a,e){Object.defineProperty(e,"__esModule",{value:!0});var s="caret-down",t=[],r="f0d7",l="M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z";e.definition={prefix:"fas",iconName:s,icon:[320,512,t,r,l]},e.faCaretDown=e.definition,e.prefix="fas",e.iconName=s,e.width=320,e.height=512,e.ligatures=t,e.unicode=r,e.svgPathData=l}));function H(a){const e=a-1;return e*e*e+1}function P(a,{delay:e=0,duration:s=400,easing:t=H}){const r=getComputedStyle(a),l=+r.opacity,i=parseFloat(r.height),o=parseFloat(r.paddingTop),n=parseFloat(r.paddingBottom),c=parseFloat(r.marginTop),f=parseFloat(r.marginBottom),h=parseFloat(r.borderTopWidth),u=parseFloat(r.borderBottomWidth);return{delay:e,duration:s,easing:t,css:a=>`overflow: hidden;opacity: ${Math.min(20*a,1)*l};height: ${a*i}px;padding-top: ${a*o}px;padding-bottom: ${a*n}px;margin-top: ${a*c}px;margin-bottom: ${a*f}px;border-top-width: ${a*h}px;border-bottom-width: ${a*u}px;`}}function W(a){let e,s,t,n,u,p,A,D,I,B,U,C,F,N,T,S,H,W,_,k,O,V,Y,G,J,K,Q,R,X,Z,aa,ea,sa,ta,ra,la,ia,oa,na,ca,fa,ha,ua,pa,va,da,ma,xa,$a,ga,ja,Ea,za,ba,wa,ya,La;return p=new M({props:{icon:q.faCaretDown}}),G=new M({props:{icon:q.faCaretDown}}),oa=new M({props:{icon:q.faCaretDown}}),{c(){e=v("nav"),s=v("ul"),t=v("li"),n=v("a"),u=d("Shriveling the world\n\t\t\t\t\t"),m(p.$$.fragment),A=x(),D=v("ul"),I=v("li"),B=v("a"),U=d("Blog"),C=x(),F=v("li"),N=v("a"),T=d("github"),S=x(),H=v("li"),W=v("a"),_=d("other resources"),k=x(),O=v("li"),V=v("a"),Y=d("application\n\t\t\t\t\t"),m(G.$$.fragment),J=x(),K=v("ul"),Q=v("li"),R=v("a"),X=d("Help"),Z=x(),aa=v("li"),ea=v("a"),sa=d("Dev Docs"),ta=x(),ra=v("li"),la=v("a"),ia=d("User Doc\n\t\t\t\t\t"),m(oa.$$.fragment),na=x(),ca=v("ul"),fa=v("li"),ha=v("a"),ua=d("Basic Usage tutorial"),pa=x(),va=v("li"),da=v("a"),ma=d("UI variables explanation"),xa=x(),$a=v("li"),ga=v("a"),ja=d("Datasets explanation"),Ea=x(),za=v("li"),ba=v("a"),wa=d("Blender tutorial"),this.h()},l(a){e=r(a,"NAV",{class:!0,role:!0});var o=l(e);s=r(o,"UL",{class:!0});var c=l(s);t=r(c,"LI",{class:!0,"aria-haspopup":!0});var f=l(t);n=r(f,"A",{href:!0,class:!0});var h=l(n);u=$(h,"Shriveling the world\n\t\t\t\t\t"),g(p.$$.fragment,h),h.forEach(i),A=j(f),D=r(f,"UL",{class:!0,"aria-label":!0});var v=l(D);I=r(v,"LI",{class:!0});var d=l(I);B=r(d,"A",{href:!0,class:!0});var m=l(B);U=$(m,"Blog"),m.forEach(i),d.forEach(i),C=j(v),F=r(v,"LI",{class:!0});var x=l(F);N=r(x,"A",{href:!0,class:!0});var E=l(N);T=$(E,"github"),E.forEach(i),x.forEach(i),S=j(v),H=r(v,"LI",{class:!0});var z=l(H);W=r(z,"A",{href:!0,class:!0});var b=l(W);_=$(b,"other resources"),b.forEach(i),z.forEach(i),v.forEach(i),f.forEach(i),k=j(c),O=r(c,"LI",{class:!0,"aria-haspopup":!0});var w=l(O);V=r(w,"A",{href:!0,class:!0});var y=l(V);Y=$(y,"application\n\t\t\t\t\t"),g(G.$$.fragment,y),y.forEach(i),J=j(w),K=r(w,"UL",{class:!0,"aria-label":!0});var L=l(K);Q=r(L,"LI",{class:!0});var M=l(Q);R=r(M,"A",{href:!0,class:!0});var q=l(R);X=$(q,"Help"),q.forEach(i),M.forEach(i),L.forEach(i),w.forEach(i),Z=j(c),aa=r(c,"LI",{class:!0});var P=l(aa);ea=r(P,"A",{href:!0,class:!0});var ya=l(ea);sa=$(ya,"Dev Docs"),ya.forEach(i),P.forEach(i),ta=j(c),ra=r(c,"LI",{class:!0,"aria-haspopup":!0});var La=l(ra);la=r(La,"A",{href:!0,class:!0});var Aa=l(la);ia=$(Aa,"User Doc\n\t\t\t\t\t"),g(oa.$$.fragment,Aa),Aa.forEach(i),na=j(La),ca=r(La,"UL",{class:!0,"aria-label":!0});var Da=l(ca);fa=r(Da,"LI",{class:!0});var Ia=l(fa);ha=r(Ia,"A",{href:!0,class:!0});var Ba=l(ha);ua=$(Ba,"Basic Usage tutorial"),Ba.forEach(i),Ia.forEach(i),pa=j(Da),va=r(Da,"LI",{class:!0});var Ua=l(va);da=r(Ua,"A",{href:!0,class:!0});var Ca=l(da);ma=$(Ca,"UI variables explanation"),Ca.forEach(i),Ua.forEach(i),xa=j(Da),$a=r(Da,"LI",{class:!0});var Fa=l($a);ga=r(Fa,"A",{href:!0,class:!0});var Ma=l(ga);ja=$(Ma,"Datasets explanation"),Ma.forEach(i),Fa.forEach(i),Ea=j(Da),za=r(Da,"LI",{class:!0});var Na=l(za);ba=r(Na,"A",{href:!0,class:!0});var Ta=l(ba);wa=$(Ta,"Blender tutorial"),Ta.forEach(i),Na.forEach(i),Da.forEach(i),La.forEach(i),c.forEach(i),o.forEach(i),this.h()},h(){o(n,"href","./"),o(n,"class","svelte-1iz8jx2"),o(B,"href","#0"),o(B,"class","svelte-1iz8jx2"),o(I,"class","menu-item svelte-1iz8jx2"),o(N,"href","#0"),o(N,"class","svelte-1iz8jx2"),o(F,"class","menu-item svelte-1iz8jx2"),o(W,"href","#0"),o(W,"class","svelte-1iz8jx2"),o(H,"class","menu-item svelte-1iz8jx2"),o(D,"class","sub-menu svelte-1iz8jx2"),o(D,"aria-label","submenu"),o(t,"class","menu-item svelte-1iz8jx2"),o(t,"aria-haspopup","true"),o(V,"href","app"),o(V,"class","svelte-1iz8jx2"),o(R,"href","#0"),o(R,"class","svelte-1iz8jx2"),o(Q,"class","menu-item svelte-1iz8jx2"),o(K,"class","sub-menu svelte-1iz8jx2"),o(K,"aria-label","submenu"),o(O,"class","menu-item svelte-1iz8jx2"),o(O,"aria-haspopup","true"),o(ea,"href","doc"),o(ea,"class","svelte-1iz8jx2"),o(aa,"class","menu-item svelte-1iz8jx2"),o(la,"href","#0"),o(la,"class","svelte-1iz8jx2"),o(ha,"href","#0"),o(ha,"class","svelte-1iz8jx2"),o(fa,"class","menu-item svelte-1iz8jx2"),o(da,"href","#0"),o(da,"class","svelte-1iz8jx2"),o(va,"class","menu-item svelte-1iz8jx2"),o(ga,"href","#0"),o(ga,"class","svelte-1iz8jx2"),o($a,"class","menu-item svelte-1iz8jx2"),o(ba,"href","#0"),o(ba,"class","svelte-1iz8jx2"),o(za,"class","menu-item svelte-1iz8jx2"),o(ca,"class","sub-menu svelte-1iz8jx2"),o(ca,"aria-label","submenu"),o(ra,"class","menu-item svelte-1iz8jx2"),o(ra,"aria-haspopup","true"),o(s,"class","svelte-1iz8jx2"),o(e,"class","menu svelte-1iz8jx2"),o(e,"role","navigation")},m(a,r){c(a,e,r),f(e,s),f(s,t),f(t,n),f(n,u),E(p,n,null),f(t,A),f(t,D),f(D,I),f(I,B),f(B,U),f(D,C),f(D,F),f(F,N),f(N,T),f(D,S),f(D,H),f(H,W),f(W,_),f(s,k),f(s,O),f(O,V),f(V,Y),E(G,V,null),f(O,J),f(O,K),f(K,Q),f(Q,R),f(R,X),f(s,Z),f(s,aa),f(aa,ea),f(ea,sa),f(s,ta),f(s,ra),f(ra,la),f(la,ia),E(oa,la,null),f(ra,na),f(ra,ca),f(ca,fa),f(fa,ha),f(ha,ua),f(ca,pa),f(ca,va),f(va,da),f(da,ma),f(ca,xa),f(ca,$a),f($a,ga),f(ga,ja),f(ca,Ea),f(ca,za),f(za,ba),f(ba,wa),La=!0},p:h,i(a){La||(z(p.$$.fragment,a),z(G.$$.fragment,a),z(oa.$$.fragment,a),b((()=>{ya||(ya=w(e,P,{delay:250,duration:600},!0)),ya.run(1)})),La=!0)},o(a){y(p.$$.fragment,a),y(G.$$.fragment,a),y(oa.$$.fragment,a),ya||(ya=w(e,P,{delay:250,duration:600},!1)),ya.run(0),La=!1},d(a){a&&i(e),L(p),L(G),L(oa),a&&ya&&ya.end()}}}function _(a){let e,s,t,n,f,h=a[0]&&W();const u=a[4].default,p=A(u,a,a[3],null);return{c(){h&&h.c(),e=x(),s=v("main"),p&&p.c(),this.h()},l(a){h&&h.l(a),e=j(a),s=r(a,"MAIN",{class:!0});var t=l(s);p&&p.l(t),t.forEach(i),this.h()},h(){o(s,"class","svelte-1iz8jx2")},m(r,l){h&&h.m(r,l),c(r,e,l),c(r,s,l),p&&p.m(s,null),t=!0,n||(f=D(s,"mousemove",a[1]),n=!0)},p(a,[s]){a[0]?h?(h.p(a,s),1&s&&z(h,1)):(h=W(),h.c(),z(h,1),h.m(e.parentNode,e)):h&&(I(),y(h,1,1,(()=>{h=null})),B()),p&&p.p&&8&s&&U(p,u,a,a[3],s,null,null)},i(a){t||(z(h),z(p,a),t=!0)},o(a){y(h),y(p,a),t=!1},d(a){h&&h.d(a),a&&i(e),a&&i(s),p&&p.d(a),n=!1,f()}}}function k(a,e,s){let{$$slots:t={},$$scope:r}=e,{fixed:l=!0}=e,i=!0;return a.$$set=a=>{"fixed"in a&&s(2,l=a.fixed),"$$scope"in a&&s(3,r=a.$$scope)},[i,function(a){s(0,i=!!l||a.clientY<80)},l,r,t]}class O extends a{constructor(a){super(),e(this,a,k,_,s,{fixed:2})}}export{O as M,N as a,S as b,T as c};
