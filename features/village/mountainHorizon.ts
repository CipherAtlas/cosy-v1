/** Angular scenery in the sky: no ground, collision, layout placement or camera parallax. */
export const mountainHorizonShader = `
  float mountainPeak(float angle, float frequency, float phase) {
    return 1.-abs(2.*fract((angle*frequency+phase)/6.28318530718)-1.);
  }
  float mountainRidge(float angle, float layer) {
    float phase=layer*1.83;
    return .05+layer*.035+sin(angle*3.+phase)*.028
      +mountainPeak(angle,7.,phase)*.04
      +mountainPeak(angle,13.,-phase*.7)*.085
      +mountainPeak(angle,29.,phase*.4)*.016;
  }
  vec3 mountainHorizon(vec3 sky, vec3 d, float rain, float dusk, float night) {
    vec2 bearing=length(d.xz)>.0001 ? normalize(d.xz) : vec2(0.,1.);
    float angle=atan(bearing.x,bearing.y);
    vec3 mist=mix(vec3(.55,.67,.59),vec3(.38,.37,.45),dusk);
    mist=mix(mist,vec3(.46,.52,.54),rain*.65);
    mist=mix(mist,vec3(.018,.03,.054),night);
    if(d.y<-.06) return mist;
    for(int band=2;band>=0;band--) {
      float layer=float(band);
      vec3 cragPosition=vec3(bearing*50.,layer*11.);
      float crestDetail=noise(cragPosition)*.004+noise(cragPosition*2.2)*.0015;
      float ridge=mountainRidge(angle,layer)+crestDetail;
      if(d.y>ridge+.002) continue;
      float edge=1.-smoothstep(ridge-.001,ridge+.001,d.y);
      float depth=max(ridge-d.y,0.);
      vec3 surface=vec3(bearing*34.,d.y*110.+layer*13.);
      float rockMass=noise(surface), brush=noise(surface*1.7);
      float faceAngle=angle+depth*1.2*sin(angle*13.-layer*1.281);
      float slope=(mountainRidge(faceAngle+.002,layer)-mountainRidge(faceAngle-.002,layer))/.004;
      float illumination=clamp(.52-slope*.58+(rockMass-.5)*.20,.08,.95);
      float planes=.22+smoothstep(.30,.40,illumination)*.32+smoothstep(.64,.74,illumination)*.34;
      float face=mix(illumination,planes,.6);
      // Broad painted planes carry the form; smaller marks stay below their contrast.
      float ravinePhase=angle*53.+depth*27.+rockMass*3.+sin(angle*17.+layer)*2.;
      float ravines=pow(.5+.5*sin(ravinePhase),8.);
      float strata=pow(.5+.5*sin(d.y*160.+rockMass*7.+sin(angle*31.)*2.),12.);
      float relief=.96+(brush-.5)*.12-ravines*.17-strata*.04;
      vec3 shadow=mix(vec3(.12,.24,.20),vec3(.27,.33,.47),layer*.5);
      vec3 light=mix(vec3(.38,.49,.31),vec3(.54,.59,.70),layer*.5);
      float stone=smoothstep(.065,.16,d.y)*(1.-layer*.4);
      shadow=mix(shadow,vec3(.19,.29,.34),stone*.65);
      light=mix(light,vec3(.43,.51,.52),stone*.65);
      vec3 rock=mix(shadow,light,face)*relief;
      rock=mix(rock,rock*vec3(1.2,.85,.82),dusk*.75);
      rock=mix(rock,mist,rain*.42);
      rock=mix(rock,mix(vec3(.009,.017,.029),vec3(.033,.045,.069),layer*.5)*relief,night);
      float snowDepth=.014+rockMass*.018+ravines*.012;
      float snow=smoothstep(.15,.205,ridge)*(1.-smoothstep(snowDepth-.002,snowDepth+.002,depth+(brush-.5)*.005));
      vec3 snowColor=mix(vec3(.88,.88,.75),vec3(.80,.61,.56),dusk);
      snowColor=mix(snowColor,vec3(.50,.57,.60),rain*.6);
      snowColor=mix(snowColor,vec3(.075,.10,.16),night);
      snowColor=mix(snowColor*vec3(.66,.77,.94),snowColor,face);
      rock=mix(rock,snowColor,snow);
      float haze=(1.-smoothstep(-.035,.09,d.y))*.88+layer*.075;
      rock=mix(rock,mist,clamp(haze,0.,.95));
      sky=mix(sky,rock,edge);
    }
    return sky;
  }
`;
