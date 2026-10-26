// Code-generated dance music for Office Audition (no audio files, no licensing).
// A song is a drum machine + bass + chord pad + a seeded pentatonic lead, scheduled on the Web Audio clock
// so every player hears the same beat at the same server time.
export const SONGS=[
  {name:'Monday Morning',th:'เช้าวันจันทร์',bpm:96,bars:26,root:57,prog:[0,5,3,4],level:'ง่าย',fourFloor:false},
  {name:'Payroll Funk',th:'ฟังก์วันเงินเดือนออก',bpm:112,bars:30,root:52,prog:[0,3,5,4],level:'กลาง',fourFloor:false,funk:true},
  {name:'Overtime Rush',th:'โอทีเร่งด่วน',bpm:128,bars:34,root:55,prog:[0,4,5,3],level:'ยาก',fourFloor:true},
];
export const INTRO_BARS=2;
const MAJOR=[0,2,4,5,7,9,11],PENTA=[0,2,4,7,9];
const mtof=m=>440*Math.pow(2,(m-69)/12);
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

export function createMusic(){
  let ctx=null,master=null,noise=null,timer=null,muted=false;
  function init(){
    if(ctx)return ctx;
    ctx=new(window.AudioContext||window.webkitAudioContext)();
    const comp=ctx.createDynamicsCompressor();master=ctx.createGain();master.gain.value=.55;master.connect(comp).connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    return ctx;
  }
  const env=(g,t,a,peak,dec)=>{g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)};
  function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);env(g,t,.003,.9,.18);o.connect(g).connect(master);o.start(t);o.stop(t+.25)}
  function noiseHit(t,hp,dec,peak){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type='highpass';f.frequency.value=hp;env(g,t,.002,peak,dec);s.connect(f).connect(g).connect(master);s.start(t);s.stop(t+dec+.05)}
  function snare(t){noiseHit(t,1500,.16,.35);const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=185;env(g,t,.002,.25,.08);o.connect(g).connect(master);o.start(t);o.stop(t+.12)}
  function tone(t,midi,type,dur,peak,cut){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=mtof(midi);env(g,t,.008,peak,dur);
    if(cut){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;o.connect(f).connect(g)}else o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05)}
  function chordNotes(song,bar){const deg=song.prog[bar%song.prog.length],r=song.root;return[0,2,4].map(i=>r+MAJOR[(deg+i)%7]+12*Math.floor((deg+i)/7))}

  // schedule one 16th-note step of the song
  function step(song,seed,i,t){
    const bar=Math.floor(i/16),s=i%16,intro=bar<INTRO_BARS,last=bar===song.bars-1,chord=chordNotes(song,bar),sd=60/song.bpm/4;
    if(s===0&&last){noiseHit(t,3000,1.2,.35)}
    if(s%4===0&&(song.fourFloor||s===0||s===8||(song.funk&&s===10)))kick(t);
    if(!intro&&(s===4||s===12))snare(t);
    if(s%2===0)noiseHit(t,7000,song.funk&&s===14?.18:.035,.12);
    if(intro)return;
    // bass: root of the chord, octave down, groove varies per song
    const bassPat=song.funk?[0,3,6,8,10,11,14]:song.fourFloor?[0,2,4,6,8,10,12,14]:[0,6,8,11,14];
    if(bassPat.includes(s))tone(t,chord[0]-12,'sawtooth',sd*1.6,.22,700);
    if(s===0)for(const n of chord)tone(t,n,'triangle',sd*14,.045);
    // lead: 2-bar phrases repeat (A A B A) so the tune is catchy
    const phrase=Math.floor((bar-INTRO_BARS)/2)%4,r=rng(seed*31+(phrase===2?2:0)*7+(bar%2)*997+s);
    if(s%2===0&&r()<.55){const k=Math.floor(r()*PENTA.length),oct=r()<.3?24:12;tone(t,song.root+PENTA[k]+oct,'square',sd*1.8,.055)}
  }

  return{
    get ready(){return!!ctx},
    unlock(){init();if(ctx.state==='suspended')ctx.resume()},
    // startServerMs: when bar 0 starts (server clock); nowServerMs(): current server time
    play(song,seed,startServerMs,nowServerMs){
      init();this.stop();
      const sd=60/song.bpm/4,total=song.bars*16,base=ctx.currentTime+(startServerMs-nowServerMs())/1000;
      let next=Math.max(0,Math.ceil((ctx.currentTime-base)/sd));
      timer=setInterval(()=>{if(muted){next=Math.max(next,Math.ceil((ctx.currentTime-base)/sd));return}
        while(next<total&&base+next*sd<ctx.currentTime+.15){const t=base+next*sd;if(t>=ctx.currentTime-.01)step(song,seed,next,t);next++}
        if(next>=total)this.stop()},25);
    },
    stop(){if(timer){clearInterval(timer);timer=null}},
    // short UI blips for key presses and judgments
    blip(kind){if(!ctx||muted)return;const t=ctx.currentTime;
      if(kind==='ok')tone(t,84,'square',.05,.05);else if(kind==='bad')tone(t,40,'sawtooth',.12,.08);
      else if(kind==='perfect'){tone(t,88,'square',.08,.06);tone(t+.06,93,'square',.1,.06)}},
    set muted(v){muted=v},get muted(){return muted},
  };
}
