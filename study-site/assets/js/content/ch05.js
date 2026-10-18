CSO.register({
  id: 'ch05', num: 5, part: 'II', kind: 'memory', span: 3, cover: 'systolic',
  coverAlt: 'A grid of processing elements with glowing data pulses flowing right and down through it.',
  title: 'Dataflows: who stays and who moves', short: 'Dataflows',
  lectures: [11, 12],
  summary: 'Every MAC needs four memory accesses, so the order in which data moves decides speed and energy. This chapter covers the three kinds of data reuse, the systolic array, and the output-, weight- and input-stationary dataflows with their exact access counts.',
  sections: [
    {
      id: 'bottleneck', title: 'The memory-access bottleneck',
      html: String.raw`
<p>In the worst case every read and write goes to DRAM. Each multiply–accumulate needs <b>four accesses</b>:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 150" width="640" height="150" role="img" aria-label="One MAC reads a weight, an activation and a partial sum, and writes the updated partial sum">
  <g class="t-sm">
    <rect x="10" y="20" width="150" height="110" rx="6" class="f-ms s-m w15"/><text x="85" y="72" text-anchor="middle" class="t-b">DRAM</text><text x="85" y="90" text-anchor="middle" class="t-mut">(worst case)</text>
    <rect x="420" y="40" width="130" height="70" rx="6" class="f-cs s-c w15"/><text x="485" y="72" text-anchor="middle" class="t-b">ALU</text><text x="485" y="90" text-anchor="middle" class="t-mut">multiply + add</text>
    <text x="290" y="30" text-anchor="middle">① read filter weight</text>
    <text x="290" y="60" text-anchor="middle">② read fmap activation</text>
    <text x="290" y="90" text-anchor="middle">③ read partial sum</text>
    <text x="290" y="128" text-anchor="middle" class="t-m">④ write updated partial sum</text>
  </g>
  <path d="M160 36h258M160 66h258M160 96h258" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M418 114h-256" class="s-m w15" marker-end="url(#arr-m)"/>
</svg></div></figure>
<div class="formula"><span class="fl">AlexNet worst case</span><div class="fm">\[ 724\text{M MACs} \times 4 = 2896\text{M DRAM accesses} \]</div><span class="fn">The target is to replace as many of these as possible with on-chip reuse.</span></div>`
    },
    {
      id: 'reuse', title: 'Three kinds of data reuse',
      html: String.raw`
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 220" width="720" height="220" role="img" aria-label="Convolutional reuse, fmap reuse and filter reuse">
  <g class="t-sm">
    <text x="110" y="18" text-anchor="middle" class="t-b">Convolutional reuse</text>
    <rect x="40" y="40" width="120" height="120" class="f-surf s-line w1"/>
    <rect x="50" y="50" width="70" height="70" class="f-none s-c w2"/><rect x="70" y="60" width="70" height="70" class="f-none s-m w2 dash"/>
    <text x="110" y="182" text-anchor="middle" class="t-mut">CONV layers only</text>
    <text x="110" y="200" text-anchor="middle">reuse activations and weights</text>

    <text x="360" y="18" text-anchor="middle" class="t-b">Fmap reuse</text>
    <rect x="300" y="60" width="70" height="70" class="f-ms s-m w15"/><text x="335" y="100" text-anchor="middle">fmap</text>
    <rect x="400" y="36" width="34" height="34" class="f-vs s-v w1"/><rect x="400" y="80" width="34" height="34" class="f-vs s-v w1"/><rect x="400" y="124" width="34" height="34" class="f-vs s-v w1"/>
    <text x="448" y="57" class="t-mut">filter 1</text><text x="448" y="101" class="t-mut">filter 2</text><text x="448" y="145" class="t-mut">filter M</text>
    <text x="360" y="182" text-anchor="middle" class="t-mut">CONV and FC layers</text>
    <text x="360" y="200" text-anchor="middle">same input used by many filters</text>

    <text x="610" y="18" text-anchor="middle" class="t-b">Filter reuse</text>
    <rect x="540" y="80" width="34" height="34" class="f-vs s-v w15"/><text x="557" y="134" text-anchor="middle" class="t-mut">filter</text>
    <rect x="610" y="36" width="50" height="34" class="f-ms s-m w1"/><rect x="610" y="80" width="50" height="34" class="f-ms s-m w1"/><rect x="610" y="124" width="50" height="34" class="f-ms s-m w1"/>
    <text x="668" y="57" class="t-mut">fmap 1</text><text x="668" y="101" class="t-mut">fmap 2</text><text x="668" y="145" class="t-mut">fmap N</text>
    <text x="610" y="182" text-anchor="middle" class="t-mut">CONV and FC, batch N &gt; 1</text>
    <text x="610" y="200" text-anchor="middle">same weights across N inputs</text>
  </g>
  <path d="M370 95 L 398 53 M370 95 L 398 97 M370 95 L 398 141" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M574 97 L 608 53 M574 97 L 608 97 M574 97 L 608 141" class="s-mut w1" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>Left: overlapping windows share activations, and the same filter slides over them. Middle: one fmap meets many filters. Right: one filter meets many fmaps in a batch.</figcaption></figure>
<div class="box exam" data-t="Headline number"><p>If <b>all</b> reuse were exploited, AlexNet's DRAM accesses would fall from <b>2896M to 61M</b> (a best-case, hypothetical figure, about 47× fewer).</p></div>`
    },
    {
      id: 'systolic', title: 'Systolic dataflow',
      html: String.raw`
<p>Take a 4×4 by 4×4 matrix multiplication C = A × B on a 4×4 grid of <b>processing elements (PEs)</b>. Each PE is a MAC: it multiplies the two numbers arriving at it, adds the product to its stored value (initially 0), and passes the numbers on.</p>
<ul>
<li>Rows of <b>A</b> flow in from the left, each row delayed by one cycle more than the row above (padded with leading zeros).</li>
<li>Columns of <b>B</b> flow in from the top, skewed the same way.</li>
<li>Every clock cycle every PE multiplies its incoming pair and accumulates. PE(1,1) has C₁₁ = a₁₁b₁₁ + a₁₂b₂₁ + a₁₃b₃₁ + a₁₄b₄₁ after 4 cycles; PE(4,4) starts at cycle 7, and everything is done after cycle 10.</li>
</ul>
<div class="formula"><span class="fl">Latency of an N×N systolic matmul</span><div class="fm">\[ T = 3N - 2 \text{ cycles} \qquad (N = 4 \Rightarrow 10) \]</div></div>
<div data-w="systolic" data-o='{"N":4}'></div>
<div class="box insight" data-t="Why systolic arrays are everywhere"><p><b>Seamless pipelining</b>: the next multiplication (D = E × F) can stream in right behind the current one, so the array never sits idle. This is the basis of the TPU and of recent NPUs from AMD, Qualcomm and Intel.</p></div>`
    },
    {
      id: 'taxonomy', title: 'Spatial architectures and the three stationary dataflows',
      html: String.raw`
<p>A typical accelerator has a <b>global buffer</b> feeding an array of PEs. Each PE has small local buffers (weights, input activations, output activations/partial sums) next to its MAC. A <b>dataflow</b> decides which data type stays put in the PE and which ones move.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 244" width="720" height="244" role="img" aria-label="Output, weight and input stationary architectures compared">
  <g class="t-sm">
    <g transform="translate(10,0)">
      <text x="110" y="16" text-anchor="middle" class="t-b t-c">Output stationary</text>
      <rect x="10" y="28" width="200" height="30" rx="4" class="f-panel s-line w1"/><text x="110" y="48" text-anchor="middle">global buffer</text>
      <g class="f-surf s-line w1"><rect x="14" y="110" width="40" height="44" rx="4"/><rect x="64" y="110" width="40" height="44" rx="4"/><rect x="114" y="110" width="40" height="44" rx="4"/><rect x="164" y="110" width="40" height="44" rx="4"/></g>
      <g class="f-c"><rect x="24" y="124" width="20" height="18" rx="2"/><rect x="74" y="124" width="20" height="18" rx="2"/><rect x="124" y="124" width="20" height="18" rx="2"/><rect x="174" y="124" width="20" height="18" rx="2"/></g>
      <text x="110" y="196" text-anchor="middle">stays: <tspan class="t-c t-b">psum</tspan></text>
      <text x="110" y="214" text-anchor="middle" class="t-mut">weights broadcast,</text><text x="110" y="230" text-anchor="middle" class="t-mut">inputs reused spatially</text>
    </g>
    <g transform="translate(250,0)">
      <text x="110" y="16" text-anchor="middle" class="t-b t-v">Weight stationary</text>
      <rect x="10" y="28" width="200" height="30" rx="4" class="f-panel s-line w1"/><text x="110" y="48" text-anchor="middle">global buffer</text>
      <g class="f-surf s-line w1"><rect x="14" y="110" width="40" height="44" rx="4"/><rect x="64" y="110" width="40" height="44" rx="4"/><rect x="114" y="110" width="40" height="44" rx="4"/><rect x="164" y="110" width="40" height="44" rx="4"/></g>
      <g class="f-v"><rect x="24" y="124" width="20" height="18" rx="2"/><rect x="74" y="124" width="20" height="18" rx="2"/><rect x="124" y="124" width="20" height="18" rx="2"/><rect x="174" y="124" width="20" height="18" rx="2"/></g>
      <text x="110" y="196" text-anchor="middle">stays: <tspan class="t-v t-b">weight</tspan></text>
      <text x="110" y="214" text-anchor="middle" class="t-mut">inputs broadcast, psums</text><text x="110" y="230" text-anchor="middle" class="t-mut">accumulate PE → PE</text>
    </g>
    <g transform="translate(490,0)">
      <text x="110" y="16" text-anchor="middle" class="t-b t-m">Input stationary</text>
      <rect x="10" y="28" width="200" height="30" rx="4" class="f-panel s-line w1"/><text x="110" y="48" text-anchor="middle">global buffer</text>
      <g class="f-surf s-line w1"><rect x="14" y="110" width="40" height="44" rx="4"/><rect x="64" y="110" width="40" height="44" rx="4"/><rect x="114" y="110" width="40" height="44" rx="4"/><rect x="164" y="110" width="40" height="44" rx="4"/></g>
      <g class="f-m"><rect x="24" y="124" width="20" height="18" rx="2"/><rect x="74" y="124" width="20" height="18" rx="2"/><rect x="124" y="124" width="20" height="18" rx="2"/><rect x="174" y="124" width="20" height="18" rx="2"/></g>
      <text x="110" y="196" text-anchor="middle">stays: <tspan class="t-m t-b">input</tspan></text>
      <text x="110" y="214" text-anchor="middle" class="t-mut">weights unicast, psums</text><text x="110" y="230" text-anchor="middle" class="t-mut">accumulate spatially</text>
    </g>
  </g>
  <path d="M120 58 L 44 106 M120 58 L 94 106 M120 58 L 144 106 M120 58 L 194 106" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M360 58 L 284 106 M360 58 L 334 106 M360 58 L 384 106 M360 58 L 434 106" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M304 160 q 25 22 50 0 M354 160 q 25 22 50 0 M404 160 q 25 22 50 0" class="f-none s-c w15" marker-end="url(#arr-c)"/>
  <path d="M524 58 v 48 M574 58 v 48 M624 58 v 48 M674 58 v 48" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M544 160 q 25 22 50 0 M594 160 q 25 22 50 0 M644 160 q 25 22 50 0" class="f-none s-c w15" marker-end="url(#arr-c)"/>
</svg></div>
<figcaption>Each dataflow keeps one data type in the PEs (the coloured square) to minimize the energy of reading and writing that type.</figcaption></figure>
<p>For the 1-D convolution used throughout these lectures, with input I[H], weights W[R] and outputs O[E] where E = H − R + 1, the three dataflows are <b>just loop orders</b> of the same computation. There are no constraints on permuting the loops.</p>
<div class="grid3">
<pre><code><span class="tok-c">// Output stationary</span>
<span class="tok-k">for</span> (e=0; e&lt;E; e++)
 <span class="tok-k">for</span> (r=0; r&lt;R; r++)
  O[e] += I[e+r]*W[r];</code></pre>
<pre><code><span class="tok-c">// Weight stationary</span>
<span class="tok-k">for</span> (r=0; r&lt;R; r++)
 <span class="tok-k">for</span> (e=0; e&lt;E; e++)
  O[e] += I[e+r]*W[r];</code></pre>
<pre><code><span class="tok-c">// Input stationary</span>
<span class="tok-k">for</span> (h=0; h&lt;H; h++)
 <span class="tok-k">for</span> (r=0; r&lt;R; r++)
  O[h-r] += I[h]*W[r];</code></pre>
</div>
<p>(For IS, the update only happens when 0 ≤ h − r &lt; E.)</p>
<div data-w="dataflow"></div>`
    },
    {
      id: 'os', title: 'Output stationary (OS)',
      html: String.raw`
<p><b>Goal: minimize partial-sum read/write energy</b> by accumulating locally. Filter weights are broadcast (multicast) and activations are reused spatially across the PE array. The output index is the outer loop.</p>
<h3>Reference pattern</h3>
<p>Plotting which index is touched at each iteration (H = 12, R = 4, E = 9) shows the character of each dataflow:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 730 270" width="730" height="270" role="img" aria-label="Index versus time for weights, inputs and outputs under OS and WS">
<rect x="110" y="30" width="190" height="70" class="f-panel"/><polyline points="114.0,96.0 119.2,75.3 124.4,54.7 129.6,34.0 134.8,96.0 140.0,75.3 145.2,54.7 150.4,34.0 155.6,96.0 160.8,75.3 166.0,54.7 171.2,34.0 176.4,96.0 181.6,75.3 186.8,54.7 192.0,34.0 197.2,96.0 202.4,75.3 207.6,54.7 212.8,34.0 218.0,96.0 223.2,75.3 228.4,54.7 233.6,34.0 238.8,96.0 244.0,75.3 249.2,54.7 254.4,34.0 259.6,96.0 264.8,75.3 270.0,54.7 275.2,34.0 280.4,96.0 285.6,75.3 290.8,54.7 296.0,34.0" class="f-none s-v w15"/><text x="205" y="20" text-anchor="middle" class="t-sm t-b t-v">weight index</text><rect x="315" y="30" width="190" height="70" class="f-panel"/><polyline points="319.0,96.0 324.2,90.4 329.4,84.7 334.6,79.1 339.8,90.4 345.0,84.7 350.2,79.1 355.4,73.5 360.6,84.7 365.8,79.1 371.0,73.5 376.2,67.8 381.4,79.1 386.6,73.5 391.8,67.8 397.0,62.2 402.2,73.5 407.4,67.8 412.6,62.2 417.8,56.5 423.0,67.8 428.2,62.2 433.4,56.5 438.6,50.9 443.8,62.2 449.0,56.5 454.2,50.9 459.4,45.3 464.6,56.5 469.8,50.9 475.0,45.3 480.2,39.6 485.4,50.9 490.6,45.3 495.8,39.6 501.0,34.0" class="f-none s-m w15"/><text x="410" y="20" text-anchor="middle" class="t-sm t-b t-m">input index</text><rect x="520" y="30" width="190" height="70" class="f-panel"/><polyline points="524.0,96.0 529.2,96.0 534.4,96.0 539.6,96.0 544.8,88.3 550.0,88.3 555.2,88.3 560.4,88.3 565.6,80.5 570.8,80.5 576.0,80.5 581.2,80.5 586.4,72.8 591.6,72.8 596.8,72.8 602.0,72.8 607.2,65.0 612.4,65.0 617.6,65.0 622.8,65.0 628.0,57.3 633.2,57.3 638.4,57.3 643.6,57.3 648.8,49.5 654.0,49.5 659.2,49.5 664.4,49.5 669.6,41.8 674.8,41.8 680.0,41.8 685.2,41.8 690.4,34.0 695.6,34.0 700.8,34.0 706.0,34.0" class="f-none s-c w15"/><text x="615" y="20" text-anchor="middle" class="t-sm t-b t-c">output index</text><text x="10" y="70" class="t-md t-b">OS</text><text x="10" y="88" class="t-sm t-mut">e outer, r inner</text><rect x="110" y="150" width="190" height="70" class="f-panel"/><polyline points="114.0,216.0 119.2,216.0 124.4,216.0 129.6,216.0 134.8,216.0 140.0,216.0 145.2,216.0 150.4,216.0 155.6,216.0 160.8,195.3 166.0,195.3 171.2,195.3 176.4,195.3 181.6,195.3 186.8,195.3 192.0,195.3 197.2,195.3 202.4,195.3 207.6,174.7 212.8,174.7 218.0,174.7 223.2,174.7 228.4,174.7 233.6,174.7 238.8,174.7 244.0,174.7 249.2,174.7 254.4,154.0 259.6,154.0 264.8,154.0 270.0,154.0 275.2,154.0 280.4,154.0 285.6,154.0 290.8,154.0 296.0,154.0" class="f-none s-v w15"/><rect x="315" y="150" width="190" height="70" class="f-panel"/><polyline points="319.0,216.0 324.2,210.4 329.4,204.7 334.6,199.1 339.8,193.5 345.0,187.8 350.2,182.2 355.4,176.5 360.6,170.9 365.8,210.4 371.0,204.7 376.2,199.1 381.4,193.5 386.6,187.8 391.8,182.2 397.0,176.5 402.2,170.9 407.4,165.3 412.6,204.7 417.8,199.1 423.0,193.5 428.2,187.8 433.4,182.2 438.6,176.5 443.8,170.9 449.0,165.3 454.2,159.6 459.4,199.1 464.6,193.5 469.8,187.8 475.0,182.2 480.2,176.5 485.4,170.9 490.6,165.3 495.8,159.6 501.0,154.0" class="f-none s-m w15"/><rect x="520" y="150" width="190" height="70" class="f-panel"/><polyline points="524.0,216.0 529.2,208.3 534.4,200.5 539.6,192.8 544.8,185.0 550.0,177.3 555.2,169.5 560.4,161.8 565.6,154.0 570.8,216.0 576.0,208.3 581.2,200.5 586.4,192.8 591.6,185.0 596.8,177.3 602.0,169.5 607.2,161.8 612.4,154.0 617.6,216.0 622.8,208.3 628.0,200.5 633.2,192.8 638.4,185.0 643.6,177.3 648.8,169.5 654.0,161.8 659.2,154.0 664.4,216.0 669.6,208.3 674.8,200.5 680.0,192.8 685.2,185.0 690.4,177.3 695.6,169.5 700.8,161.8 706.0,154.0" class="f-none s-c w15"/><text x="10" y="190" class="t-md t-b">WS</text><text x="10" y="208" class="t-sm t-mut">r outer, e inner</text><text x="420" y="262" text-anchor="middle" class="t-sm t-mut">time (loop iteration) →, H = 12, R = 4, E = 9</text>
</svg></div>
<figcaption>OS: one output is reused R times (a staircase), all weights are reused over and over (sawtooth 0, 1, 2, 3, 0, 1, …), and inputs form a sliding window of size R. WS: one weight is reused E times, inputs form a large sliding window of size E, and outputs sweep a fixed window of size E again and again.</figcaption></figure>
<h3>Buffer accesses in OS</h3>
<p>MACs = E·R; weight reads = E·R; input reads = E·R; <b>output reads = 0</b>; output writes = E. Each output is written once, when it is finished.</p>
<h3>Mapping OS onto the array</h3>
<p>Weights are <b>broadcast to all PEs</b> (each PE has W[0..3] when needed). Inputs are distributed by sliding window: P0 gets I[0..3], P1 gets I[1..4], and so on. The PEs work in parallel: <b>P0 computes O[0], P1 computes O[1]</b>, each keeping its own psum locally.</p>
<h3>2-D convolution in OS</h3>
<p>For a 3×3 input with 3 channels and eight 2×2×3 filters: finish <b>all partial sums for one output pixel</b> (all filter positions and all channels) before moving the window to the next output.</p>`
    },
    {
      id: 'ws', title: 'Weight stationary (WS)',
      html: String.raw`
<p><b>Goal: minimize weight read energy</b>, maximizing convolutional and filter reuse of weights. Weights are stored in the PE array and <b>do not move until every computation that needs them is finished</b>. Activations are broadcast and partial sums are accumulated spatially across the array. In the loop nest, just swap the loops: the weight index goes outside.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 730 190" width="730" height="190" role="img" aria-label="WS: weights fixed in P0 to P3, inputs broadcast, partial sums passed from PE to PE">
  <g class="t-sm">
    <rect x="200" y="10" width="300" height="30" rx="4" class="f-ms s-m w1"/><text x="350" y="30" text-anchor="middle">inputs broadcast: I[0], I[1], I[2], …</text>
    <g class="f-surf s-line w1"><rect x="80" y="80" width="100" height="56" rx="6"/><rect x="230" y="80" width="100" height="56" rx="6"/><rect x="380" y="80" width="100" height="56" rx="6"/><rect x="530" y="80" width="100" height="56" rx="6"/></g>
    <text x="130" y="100" text-anchor="middle" class="t-b">P0</text><text x="280" y="100" text-anchor="middle" class="t-b">P1</text><text x="430" y="100" text-anchor="middle" class="t-b">P2</text><text x="580" y="100" text-anchor="middle" class="t-b">P3</text>
    <text x="130" y="124" text-anchor="middle" class="t-v t-b">W0</text><text x="280" y="124" text-anchor="middle" class="t-v t-b">W1</text><text x="430" y="124" text-anchor="middle" class="t-v t-b">W2</text><text x="580" y="124" text-anchor="middle" class="t-v t-b">W3</text>
    <text x="680" y="112" class="t-c">psum</text>
    <text x="350" y="166" text-anchor="middle">O[0] = I[0]W[0] + I[1]W[1] + I[2]W[2] + I[3]W[3]</text>
    <text x="350" y="184" text-anchor="middle" class="t-mut">psums are read from and written to the global buffer</text>
  </g>
  <path d="M260 40 L 140 78 M320 40 L 280 78 M380 40 L 430 78 M440 40 L 570 78" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M180 108h48M330 108h48M480 108h48M630 108h44" class="s-c w2" marker-end="url(#arr-c)"/>
</svg></div>
<figcaption>Spatial accumulation: each PE adds its product to the psum arriving from the left and passes it on. Likewise O[6] = I[6]W[0] + I[7]W[1] + I[8]W[2] + I[9]W[3].</figcaption></figure>
<p>In 2-D, WS fixes one weight (say the top-left weight of each filter), multiplies it with <b>every input pixel it ever touches</b> to produce psums for many outputs, and only then moves to the next weight.</p>
<h3>Example: NVIDIA's NVDLA</h3>
<p>The NVIDIA Deep Learning Accelerator (released 29 September 2017, open at nvdla.org, used in Jetson Orin/Nano) is weight stationary. Its headless core contains:</p>
<div class="grid2">
<ul>
<li><b>Convolution buffer</b> (the global buffer)</li>
<li><b>Convolution core</b>: an M × C array of MACs, columns = output channels, rows = input channels</li>
<li>Activation engine (SDP), pooling engine (PDP)</li>
</ul>
<ul>
<li>Local response normalization (CDP)</li>
<li>Reshape (RUBIK) and bridge DMA</li>
<li>Configuration interface and memory interface blocks</li>
</ul>
</div>`
    },
    {
      id: 'is', title: 'Input stationary (IS) and the cost table',
      html: String.raw`
<p><b>Goal: minimize activation read energy.</b> Each input stays in a PE until it is no longer needed, maximizing convolutional and fmap reuse of activations. Weights are unicast and psums are accumulated spatially across the array.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>1-D conv, W ≈ E</th><th>OS</th><th>WS</th><th>IS</th><th>Ideal minimum</th></tr></thead>
<tbody>
<tr><td>MACs</td><td>E·R</td><td>E·R</td><td>E·R</td><td>E·R</td></tr>
<tr><td>Weight reads</td><td>E·R</td><td><b>R</b></td><td>E·R</td><td>R</td></tr>
<tr><td>Input reads</td><td>E·R</td><td>E·R</td><td><b>E</b></td><td>E</td></tr>
<tr><td>Output reads</td><td><b>0</b></td><td>E·R</td><td>E·R</td><td>0</td></tr>
<tr><td>Output writes</td><td><b>E</b></td><td>E·R</td><td>E·R</td><td>E</td></tr>
</tbody></table></div>
<div class="box exam" data-t="How to remember the table"><p>Each dataflow reaches the minimum for <b>exactly the data type it keeps stationary</b> and pays E·R for the others. The ideal column, the best of all worlds, is probably not reachable; later accelerators (Eyeriss's row stationary, next chapter) try to get close.</p></div>`
    }
  ],
  takeaways: [
    'Each MAC needs 4 memory accesses (weight, activation, psum read, psum write); AlexNet worst case is 2896M DRAM accesses.',
    'Convolutional reuse (conv only), fmap reuse and filter reuse (batch > 1) could cut AlexNet to 61M accesses.',
    'A systolic array streams A rightward and B downward with skew; an N×N matmul takes 3N − 2 cycles and pipelines seamlessly.',
    'OS keeps psums in PEs (output writes = E, output reads = 0); weights are broadcast.',
    'WS keeps weights in PEs (weight reads = R); inputs are broadcast and psums accumulate PE to PE. NVDLA is WS.',
    'IS keeps inputs in PEs (input reads ≈ E); weights are unicast.',
    'The three dataflows are just different loop orders of the same 1-D convolution.'
  ],
  numbers: [
    ['Memory accesses per MAC', '4', 'read weight, activation, psum; write psum'],
    ['AlexNet worst-case DRAM accesses', '2896M', '724M MACs × 4'],
    ['AlexNet with all reuse', '61M', 'hypothetical best case'],
    ['Systolic N×N latency', '3N − 2 cycles', '10 cycles for 4×4'],
    ['NVDLA release', '29 Sep 2017', 'weight stationary, nvdla.org']
  ],
  quiz: [
    { q: 'How many memory accesses does one MAC need in the worst case?', num: 4, tol: 0, why: 'Read weight, read activation, read partial sum, write partial sum.' },
    { q: 'Which reuse type exists only in convolutional layers?', o: ['Fmap reuse', 'Filter reuse', 'Convolutional reuse', 'Batch reuse'], a: 2, why: 'Sliding, overlapping windows exist only in conv layers.' },
    { q: 'Filter reuse requires…', o: ['stride 1', 'batch size N > 1', 'a 1×1 filter', 'an FC layer'], a: 1, why: 'The same filter weights are reused across several input fmaps of a batch.' },
    { q: 'How many cycles does a 4×4 systolic array need for a 4×4 × 4×4 matmul?', num: 10, tol: 0, why: '3N − 2 = 10; PE(4,4) starts at cycle 7 and needs 4 cycles.' },
    { q: 'In output stationary dataflow, how many times are outputs (psums) read from the buffer?', o: ['0', 'E', 'E·R', 'R'], a: 0, why: 'Psums stay in the PE until the output is finished, then written once.' },
    { q: 'Which dataflow reads each weight only R times in total?', o: ['OS', 'WS', 'IS', 'None'], a: 1, why: 'Weights stay in the PEs until all their computations are done.' },
    { q: 'In WS, how are partial sums accumulated?', o: ['Locally in one PE', 'Spatially, passed from PE to PE', 'In DRAM only', 'They are not needed'], a: 1, why: 'Each PE adds its product to the psum arriving from its neighbour and passes it on.' },
    { q: 'NVDLA uses which dataflow?', o: ['Output stationary', 'Weight stationary', 'Input stationary', 'Row stationary'], a: 1, why: 'Its convolution core is an M × C MAC array holding weights.' },
    { q: 'What changes between OS and WS in the 1-D loop nest?', o: ['The arithmetic', 'Only the loop order', 'The filter size', 'The number of MACs'], a: 1, why: 'OS puts the output index outside; WS puts the weight index outside.' },
    { q: 'In the OS reference pattern, the weight index over time looks like…', o: ['A staircase', 'A sawtooth 0,1,2,3,0,1,…', 'A constant', 'Random'], a: 1, why: 'All weights are reused for every output in turn.' }
  ],
  cards: [
    { f: 'Four accesses per MAC', b: 'Read weight, read activation, read psum, write psum. AlexNet: 724M × 4 = 2896M.' },
    { f: 'Convolutional reuse', b: 'CONV only: overlapping windows reuse activations and weights.' },
    { f: 'Fmap vs filter reuse', b: 'Fmap: one input used by many filters. Filter: one filter used on many inputs (batch > 1).' },
    { f: 'Systolic array', b: 'A flows right, B flows down, skewed; each PE multiplies and accumulates. 3N − 2 cycles; pipelines seamlessly.' },
    { f: 'Output stationary', b: 'Psums stay in PEs. Output reads 0, writes E; weights and inputs E·R. Weights broadcast.' },
    { f: 'Weight stationary', b: 'Weights stay in PEs (reads = R). Inputs broadcast; psums accumulate PE→PE. Example: NVDLA.' },
    { f: 'Input stationary', b: 'Inputs stay in PEs (reads ≈ E). Weights unicast; psums accumulate spatially.' },
    { f: 'Ideal dataflow', b: 'Weights R, inputs E, output reads 0, writes E: best of all worlds, probably not possible.' }
  ]
});
