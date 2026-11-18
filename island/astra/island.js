// Seeded, faceted geology and vegetation. Every primitive is batched into one mesh.
export function islandMesh(){
  let seed=857, data=[];
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const tau=2*Math.PI;
  function tri(a,b,c,hex,shade=1){
    const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
    const col=[16,8,0].map(bits=>((hex>>bits)&255)*shade/255);
    for(const p of [a,b,c])data.push(...p.slice(0,3),...n.map(x=>x/l),...col,p[3]||0);
  }
  function layers(rows,colors,variation=.05){
    let n=rows[0].length;
    for(let k=1;k<rows.length;k++) for(let i=0;i<n;i++){
      let j=(i+1)%n,lo=rows[k-1],hi=rows[k],c=colors[k-1],s=1+(rnd()-.5)*variation;
      tri(lo[i],hi[i],hi[j],c,s);tri(lo[i],hi[j],lo[j],c,s);
    }
    const top=rows.at(-1),mid=[0,0,0];for(const p of top)for(let j=0;j<3;j++)mid[j]+=p[j]/n;
    for(let i=0;i<n;i++)tri(mid,top[(i+1)%n],top[i],colors.at(-1));
  }
  function drum(x,y,z,rb,rt,h,c,n=14){
    const ring=(r,dy)=>Array.from({length:n},(_,i)=>[x+r*Math.cos(tau*i/n),y+dy,z+r*Math.sin(tau*i/n)]);
    layers([ring(rb,0),ring(rt,h)],[c],.035);
  }
  function land(x,z,rx,rz,profile,colors,n,rough){
    const phase=rnd()*tau, points=Array.from({length:n},(_,i)=>{
      let a=tau*i/n,r=1+.06*Math.cos(3*a+phase)+.045*Math.sin(5*a-phase)+rnd()*.048;
      return [Math.cos(a)*r,Math.sin(a)*r,rnd()-.5];
    });
    layers(profile.map(([s,y],k)=>points.map(([dx,dz,r])=>[x+rx*s*dx+.04*k,y+r*rough,z+rz*s*dz])),colors,.18);
  }
  land(0,.2,7.6,5.05,[[1.04,-.6],[1,.1],[.94,.36],[.79,.66],[.58,.92]],[0xbfa780,0xf4d9a3,0xf5dda8,0xddc99a],64,.13);
  const rock=[0x67585b,0x94776a,0xb6927a,0xc19e84,0x748546];
  land(.1,-1.05,5.3,2.95,[[1,-.14],[1.03,1.2],[.95,2.85],[.83,3.18],[.77,3.83],[.72,4.02]],rock,32,1);
  land(2,-1,2.65,2.12,[[1,2.9],[.98,4.12],[.89,4.48],[.83,5.13],[.77,5.28]],rock.slice(1),22,.41);
  for(let i=0;i<44;i++){
    let a=rnd()*tau,r=.83+rnd()*.25,s=.15+rnd()**2*1.12;
    land(Math.cos(a)*7.65*r,Math.sin(a)*4.5*r,s,s*(.61+rnd()*.46),[[1,-.23],[1,.16],[.75,s*.7+.13],[.42,s*.85+.14]],rock.slice(0,3),7,.28);
  }
  for(const [x,z,s,h] of [[-6.7,-1.8,1.32,3.5],[-7.9,-2,.82,2.35],[7,-2.8,1.05,1.8]]){
    land(x,z,s,s*.78,[[1,-.3],[1.03,h*.38],[.82,h*.73],[.6,h],[.51,h+.13]],rock,10,.54);
  }
  for(let i=0;i<128;i++){
    const a=rnd()*tau,r=Math.sqrt(rnd()),s=.25+rnd()*.69, high=i<65;
    let x=high?.22+Math.cos(a)*3.78*r:Math.cos(a)*5.55,y=high?3.9:.59,z=high?-1.05+Math.sin(a)*1.95*r:Math.sin(a)*2.68;
    const c=[0x5a8149,0x427447,0x768e47,0x396c4b][i%4];
    land(x,z,s,s*.83,[[.6,y-.18],[1,y+s*.22],[.61,y+s*.67],[.16,y+s*.82]],[c,c,c],7,.17);
  }
  function palm(x,y,z,h,lean){
    const bend=rnd()*tau,trunk=[];
    for(let j=0;j<=7;j++){
      let f=j/7,r=h*(.034-.021*f);
      trunk.push(Array.from({length:7},(_,i)=>[x+lean*Math.cos(bend)*f*f+r*Math.cos(tau*i/7),y+h*f,z+lean*Math.sin(bend)*f*f+r*Math.sin(tau*i/7)]));
    }
    layers(trunk,Array.from({length:7},(_,i)=>i%3?0xa98a61:0x8f7353));
    const cx=x+lean*Math.cos(bend),cy=y+h,cz=z+lean*Math.sin(bend),phase=rnd()*tau;
    for(let k=0;k<12;k++){
      const a=k*2.4+phase,dx=Math.cos(a),dz=Math.sin(a),len=h*(.42+.18*rnd()),rise=k>8?.38:.23,drop=k>8?.23:.56;
      const green=[0x367750,0x498851,0x728e46,0x28684c,0x639651][k%5];
      function leaf(u,width){
        return [cx+len*(dx*u-dz*width),cy+len*(rise*Math.sin(u*Math.PI)-drop*u*u-Math.abs(width)*.48),cz+len*(dz*u+dx*width),u];
      }
      for(let j=0;j<10;j++)for(let side of [-1,1]){
        let u=j/10,v=(j+1)/10,w=side*(.02+.115*Math.sin(Math.PI*(u+.05)));
        let p=leaf(u,0),q=leaf(v,0),tip=leaf(Math.min(1,v+.075),w),base=leaf(u+.016,w*.52);
        tri(p,q,tip,green,side===1?1.08:.9);tri(p,tip,base,green);
      }
    }
  }
  [[-4.8,.61,1.58,3.85,1.1],[-3.85,.65,2.03,3.17,.65],[-5.2,.58,.72,2.72,.57],[4.95,.52,1.51,3.32,1],[5.56,.5,.85,2.56,.65],[-1.8,3.98,-1.01,3.07,.72],[-2.85,3.91,-.53,2.51,.62],[.03,4,-2.08,2.47,.65],[-.8,.68,2.73,2.31,.54]].forEach(p=>palm(...p));
  const x=2.05,z=-1.03,y=5.23;
  drum(x,y-.21,z,.86,.83,.36,0xd2b38e);
  let yy=y+.15;
  for(const [rb,rt,h,c] of [[.57,.53,.76,0xfbebcb],[.53,.49,.53,0xb14f36],[.49,.4,1.28,0xfff1d4],[.4,.38,.48,0xb65239],[.38,.36,.31,0xf2dfb7],[.5,.56,.15,0x394b48]]){
    drum(x,yy,z,rb,rt,h,c);yy+=h;
  }
  for(let i=0;i<10;i++){let a=tau*i/10;drum(x+.49*Math.cos(a),yy,z+.49*Math.sin(a),.019,.019,.24,0x374c47,5)}
  drum(x,yy+.24,z,.52,.52,.033,0x394d49);
  drum(x,yy,z,.31,.31,.67,0xf5cc88,10);
  for(let i=0;i<8;i++){let a=tau*i/8;drum(x+.32*Math.cos(a),yy,z+.32*Math.sin(a),.03,.03,.7,0x344c48,5)}
  drum(x,yy+.65,z,.49,.48,.09,0x354b47);drum(x,yy+.74,z,.5,.057,.34,0x984c38);drum(x,yy+1.07,z,.043,.014,.22,0x344642);
  for(const [dy,w,h] of [[.15,.22,.45],[1.58,.16,.24],[2.43,.12,.18]]){
    let zz=z+.57-dy*.064,p=[x-w/2,y+dy,zz],q=[x+w/2,y+dy,zz],r=[q[0],q[1]+h,zz],s=[p[0],r[1],zz];
    tri(p,q,r,0x344745);tri(p,r,s,0x344745);
  }
  // Broken buttresses and scree interrupt the main escarpment.
  for(let i=0;i<26;i++){
    const a=rnd()*tau,bx=.12+5.14*Math.cos(a),bz=-1.05+2.9*Math.sin(a);
    let h=.62+rnd()**1.4*2.22,s=.22+rnd()*.47;
    land(bx,bz,s,s*.75,[[1.28,.48],[1,.84],[.69,h+.45],[.32,h+.62]],rock.slice(0,3),6,.36);
  }
  // Wing tips animate in the vertex shader, with an independent orbit per tern.
  for(let i=0;i<5;i++)for(let side of [-1,1]){
    let shift=2+i*.7;
    tri([0,0,.15,shift],[side*.31,.10,.02,shift],[side*.69,.035,-.13,shift],0x594f4e);
    tri([0,0,.15,shift],[side*.69,.035,-.13,shift],[side*.27,.042,-.12,shift],0x594f4e);
  }
  return {vertices:new Float32Array(data),lamp:[x,yy+.39,z]};
}
