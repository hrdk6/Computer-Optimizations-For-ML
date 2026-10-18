CSO.register({
  id: 'ch06', num: 6, part: 'II', kind: 'memory', span: 5, cover: 'accel',
  coverAlt: 'A chip floorplan seen from above: a grid of compute tiles surrounded by large glowing memory banks.',
  title: 'CNN accelerators: the DianNao family and Eyeriss', short: 'CNN accelerators',
  lectures: [13, 14, 15, 16, 17],
  summary: 'Why DNNs get their own chips, and what the classic designs teach: DianNao\'s tiling and split buffers, DaDianNao\'s tiles, eDRAM and mesh network, ShiDianNao near the sensor, Eyeriss\'s row-stationary dataflow and run-length coding, and Eyeriss v2\'s hierarchical mesh. One lesson repeats: memory, not arithmetic, dominates area and power.',
  sections: [
    {
      id: 'why', title: 'Why build an accelerator?',
      html: String.raw`
<div class="grid3">
  <div class="tile"><h4>CPU</h4><p>Limited parallelism: an octa-core CPU with 16 threads runs at most about 16 tasks at once.</p></div>
  <div class="tile"><h4>GPU</h4><p>Built for pixel-parallel graphics (SIMD-like: one instruction, many data). DNNs are parallel matrix multiplications too, so GPUs are used for both training and inference. Drawback: <b>limited memory</b> (about 80–100 GB at most), while state-of-the-art weights alone take tens of GB, plus activations, plus gradients in training.</p></div>
  <div class="tile"><h4>Accelerator</h4><p><b>Application specific</b>, tailored only for DNNs, and mostly for <b>inference</b>: train once on GPUs, infer many times (for example the image processing unit in a phone).</p></div>
</div>
<p>An accelerator must beat CPUs and GPUs on the three metrics that matter: <b>inference latency, energy and area</b>, all kept in check together. The course follows four classic designs: DianNao (ASPLOS 2014), DaDianNao (MICRO 2014, "a machine-learning supercomputer"), ShiDianNao (ISCA 2015, vision processing close to the sensor) and Eyeriss (MIT, IEEE JSSC 2016/17).</p>`
    },
    {
      id: 'tiling', title: 'DianNao, part 1: tiling to fit in L1',
      html: String.raw`
<p>DianNao ("computer" in Mandarin) is one of the earliest DNN accelerators. Its first idea is software-visible: <b>tile</b> the classifier, convolutional and pooling layers so they use less memory bandwidth.</p>
<p>A classifier (FC) layer with T<sub>in</sub> input neurons, activations a[j], T<sub>out</sub> output neurons, weights w[i][j] and sums s[i]:</p>
<pre><code><span class="tok-k">for</span> (i = 0; i &lt; Tout; i++)
  <span class="tok-k">for</span> (j = 0; j &lt; Tin; j++)
    s[i] += a[j] * w[i][j];</code></pre>
<div class="formula"><span class="fl">Memory accesses of the naive classifier layer</span><div class="fm">\[ \underbrace{T_{in}\,T_{out}}_{\text{activations}} + \underbrace{T_{in}\,T_{out}}_{\text{weights}} + \underbrace{T_{out}}_{\text{sums}} \]</div></div>
<p>T<sub>in</sub> can be anywhere from 10 to 100,000. With 100,000 inputs × 4 B = 400 KB, the inputs do not fit in L1. So:</p>
<ol><li>Divide the input neurons into <b>tiles</b> that fit in L1.</li><li>Compute each tile's contribution to <b>all</b> outputs.</li><li>Accumulate those partial sums.</li></ol>
<div class="grid2">
  <div class="box insight" data-t="Gain"><p>Each activation a[j] is fetched from main memory far fewer times.</p></div>
  <div class="box exam" data-t="Cost"><p>Partial sums s[i] are fetched more often, but that is cheap because T<sub>out</sub> is small.</p></div>
</div>
<p>Conv and pooling layers tile their input and output fmaps the same way. Pooling has no kernels, so tiling cannot cut its bandwidth drastically (input tiling still helps). DianNao's bandwidth chart for CLASS1, CONV3, CONV5 and POOL3 shows: originally about half the bandwidth is inputs and half synapses (weights); after tiling the input bandwidth almost vanishes; adding L2 reuse cuts the synapse bandwidth further. <b>Same computation, less memory bandwidth, less latency.</b></p>`
    },
    {
      id: 'arch', title: 'DianNao, part 2: the hardware',
      html: String.raw`
<p>The <b>naive</b> hardware would lay every neuron (logic) and synapse (latch/RAM) out on silicon. Data travels very short distances, so it is fast, but the area explodes with the number of neurons: as layers grow from 32×32 to 512×512, critical path grows roughly linearly while <b>area and energy grow explosively</b>. Billions of parameters are impossible this way. DianNao instead time-shares a small datapath:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 280" width="720" height="280" role="img" aria-label="DianNao: NBin, SB and NBout buffers feeding the three-stage NFU, with a control processor and DMAs">
  <g class="t-sm">
    <rect x="10" y="40" width="110" height="200" rx="6" class="f-panel s-line w1"/><text x="65" y="135" text-anchor="middle" class="t-b">Memory</text><text x="65" y="152" text-anchor="middle" class="t-mut">interface</text>
    <rect x="150" y="40" width="60" height="44" rx="4" class="f-panel s-line w1"/><text x="180" y="66" text-anchor="middle">DMA</text>
    <rect x="150" y="118" width="60" height="44" rx="4" class="f-panel s-line w1"/><text x="180" y="144" text-anchor="middle">DMA</text>
    <rect x="150" y="196" width="60" height="44" rx="4" class="f-panel s-line w1"/><text x="180" y="222" text-anchor="middle">DMA</text>
    <rect x="240" y="40" width="110" height="44" rx="4" class="f-ms s-m w15"/><text x="295" y="60" text-anchor="middle" class="t-b">NBin</text><text x="295" y="76" text-anchor="middle" class="t-mut">input neurons</text>
    <rect x="240" y="118" width="110" height="44" rx="4" class="f-ms s-m w15"/><text x="295" y="138" text-anchor="middle" class="t-b">SB</text><text x="295" y="154" text-anchor="middle" class="t-mut">synapses (weights)</text>
    <rect x="240" y="196" width="110" height="44" rx="4" class="f-ms s-m w15"/><text x="295" y="216" text-anchor="middle" class="t-b">NBout</text><text x="295" y="232" text-anchor="middle" class="t-mut">outputs / psums</text>
    <rect x="390" y="40" width="300" height="140" rx="6" class="f-none s-c w15 dash"/><text x="540" y="32" text-anchor="middle" class="t-c t-b">Neural Functional Unit (NFU)</text>
    <rect x="400" y="70" width="88" height="90" rx="4" class="f-cs s-c w1"/><text x="444" y="108" text-anchor="middle" class="t-b">NFU-1</text><text x="444" y="126" text-anchor="middle" class="t-mut">multipliers</text>
    <rect x="496" y="70" width="88" height="90" rx="4" class="f-cs s-c w1"/><text x="540" y="108" text-anchor="middle" class="t-b">NFU-2</text><text x="540" y="126" text-anchor="middle" class="t-mut">adder tree</text>
    <rect x="592" y="70" width="88" height="90" rx="4" class="f-cs s-c w1"/><text x="636" y="108" text-anchor="middle" class="t-b">NFU-3</text><text x="636" y="126" text-anchor="middle" class="t-mut">non-linear</text>
    <rect x="390" y="210" width="300" height="40" rx="4" class="f-vs s-v w1"/><text x="540" y="235" text-anchor="middle">Control processor (CP) + instructions</text>
  </g>
  <path d="M120 62h28M120 140h28M120 218h28M210 62h28M210 140h28M210 218h28M350 62 L 398 90 M350 140 L 398 130 M488 115h6M584 115h6" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M680 160 C 690 200, 420 200, 352 218" class="f-none s-m w15" marker-end="url(#arr-m)"/>
  <path d="M352 226 C 380 226, 520 200, 540 162" class="f-none s-m w1 dash" marker-end="url(#arr-m)"/>
</svg></div>
<figcaption>DianNao. Dashed copper arrow: NBout feeds partial sums back to the adder tree instead of spilling them to main memory.</figcaption></figure>
<div class="grid2">
  <div class="tile"><h4>Split buffers</h4><p>Three separate scratchpads (NBin, SB, NBout) instead of one cache: fewer conflicts, shorter access time, and each can have its own width so different data widths are read at once.</p></div>
  <div class="tile"><h4>NBout is a circular buffer</h4><p>Partial sums are pushed into NBout rather than sent to main memory and fetched back. Outputs leave NBout only after all inputs are integrated; this pairs naturally with tiling.</p></div>
  <div class="tile"><h4>NFU-1: 16-bit fixed point</h4><p>16-bit fixed-point multipliers instead of 32-bit floating point, with almost the same error on the benchmarks. A 16-bit truncated fixed-point multiplier takes <b>1309 µm² and 576 µW</b>; a 32-bit float one needs about <b>6× the area and 7× the power</b>.</p></div>
  <div class="tile"><h4>NFU-2: adder tree</h4><p>Adding many products with a tree means less generate-and-propagate delay, so lower latency.</p></div>
</div>
<h3>NFU-3: non-linearity as a piecewise-linear function</h3>
<p>Exponentials and divisions are expensive in hardware, so the activation is approximated by straight segments. More segments mean a better approximation, and DNN accuracy is preserved.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 480 180" width="480" height="180" role="img" aria-label="Sigmoid and its three-piece linear approximation">
  <line x1="40" y1="150" x2="440" y2="150" class="s-line w1"/><line x1="240" y1="20" x2="240" y2="160" class="s-line w1"/>
  <line x1="40" y1="30" x2="440" y2="30" class="s-line w1 dash"/>
  <path d="M40.0 149.2L60.0 148.7L80.0 147.8L100.0 146.5L120.0 144.3L140.0 140.9L160.0 135.7L176.0 129.8L192.0 122.2L208.0 112.8L224.0 101.8L240.0 90.0L256.0 78.2L272.0 67.2L288.0 57.8L304.0 50.2L320.0 44.3L340.0 39.1L360.0 35.7L380.0 33.5L400.0 32.2L420.0 31.3L440.0 30.8" class="f-none s-v w2"/>
  <path d="M40 150L160 150L320 30L440 30" class="f-none s-c w2 dash"/>
  <g class="t-sm"><text x="160" y="170" text-anchor="middle" class="t-mut">−2</text><text x="320" y="170" text-anchor="middle" class="t-mut">2</text><text x="240" y="174" text-anchor="middle" class="t-mut">0</text><text x="30" y="34" text-anchor="end" class="t-mut">1</text>
  <text x="330" y="80" class="t-v">sigmoid</text><text x="330" y="98" class="t-c">piecewise linear: 0, ramp, 1</text></g>
</svg></div></figure>
<h3>Control instructions</h3>
<p>Hardware needs software, the way GPUs need CUDA, ROCm or OpenVINO. A DianNao instruction has fields for each block: <b>CP</b> | <b>SB</b> (read op, reuse, address, size) | <b>NBin</b> (read op, reuse, stride, stride begin/end, address, size) | <b>NBout</b> (read op, write op, address, size) | <b>NFU</b> (NFU-1 op, NFU-2 op, NFU-2 in/out, NFU-3 op, output begin/end). The lecture's example program runs a T<sub>in</sub> = 8192, T<sub>out</sub> = 256 classifier with 64-entry buffers.</p>`
    },
    {
      id: 'results', title: 'DianNao results: memory is the problem',
      html: String.raw`
<p>The 65 nm layout totals <b>3.02 mm² and 485 mW</b>.</p>
<div class="grid2">
<div data-w="bars" data-o='{"title":"DianNao area by component","unit":"%","max":40,"labelWidth":110,"barWidth":240,"items":[["SB",38.17,"m","38.2%"],["NFU",28,"c","~28%"],["NBin",14,"m","~14%"],["NBout",14,"m","~14%"],["CP",5.7,"v","~5.7%"]]}'></div>
<div data-w="bars" data-o='{"title":"DianNao power by component","unit":"%","max":40,"labelWidth":110,"barWidth":240,"items":[["NFU",27.2,"c","27.2%"],["SB",22.65,"m","22.7%"],["NBin",20,"m","~20%"],["NBout",20,"m","~20%"]]}'></div>
</div>
<div class="box exam" data-t="Takeaway"><p>Buffers take about <b>70% of the area and over 60% of the power</b>; the compute (NFU) only about 28%. <b>Memory is a bigger problem than computation.</b></p></div>
<p>Against a SIMD (GPU-like) baseline, DianNao reduces energy across CLASS1, CLASS3, CONV1–5 and POOL1/3/5 layers, about <b>28× on CONV1</b> and <b>21× geometric mean</b>.</p>`
    },
    {
      id: 'dadiannao', title: 'DaDianNao: a machine-learning supercomputer',
      html: String.raw`
<p>DianNao has a <b>single NFU</b>, which is not enough for large DNNs with billions of MACs. DaDianNao goes from single-core to multi-core:</p>
<ul>
<li>Many DianNao-style NFUs on one chip, with synapses kept <b>close to the neurons</b>.</li>
<li><b>eDRAM instead of SRAM</b> for synapses: denser and more energy-efficient. Each NFU connects to <b>four eDRAM banks</b>, with synapse rows interleaved for seamless access (tile 3.27 mm, NFU 0.88 mm).</li>
<li><b>16 tiles + two central eDRAM banks</b>. The central banks reach the tiles through a <b>fat tree</b>; tiles talk to each other over a <b>mesh NoC</b>, one router per tile, with HT2.0 links to other chips (N/E/S/W).</li>
</ul>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 300" width="700" height="300" role="img" aria-label="DaDianNao: 16 tiles in a mesh with two central eDRAM banks, and a router with five ports">
  <g class="t-sm">
    <g class="f-cs s-c w1">
      <rect x="20" y="20" width="56" height="56" rx="4"/><rect x="96" y="20" width="56" height="56" rx="4"/><rect x="232" y="20" width="56" height="56" rx="4"/><rect x="308" y="20" width="56" height="56" rx="4"/>
      <rect x="20" y="96" width="56" height="56" rx="4"/><rect x="96" y="96" width="56" height="56" rx="4"/><rect x="232" y="96" width="56" height="56" rx="4"/><rect x="308" y="96" width="56" height="56" rx="4"/>
      <rect x="20" y="172" width="56" height="56" rx="4"/><rect x="96" y="172" width="56" height="56" rx="4"/><rect x="232" y="172" width="56" height="56" rx="4"/><rect x="308" y="172" width="56" height="56" rx="4"/>
      <rect x="20" y="248" width="56" height="44" rx="4"/><rect x="96" y="248" width="56" height="44" rx="4"/><rect x="232" y="248" width="56" height="44" rx="4"/><rect x="308" y="248" width="56" height="44" rx="4"/>
    </g>
    <rect x="166" y="60" width="52" height="80" rx="4" class="f-ms s-m w15"/><text x="192" y="96" text-anchor="middle" class="t-b">eDRAM</text><text x="192" y="112" text-anchor="middle" class="t-mut">bank</text>
    <rect x="166" y="160" width="52" height="80" rx="4" class="f-ms s-m w15"/><text x="192" y="196" text-anchor="middle" class="t-b">eDRAM</text><text x="192" y="212" text-anchor="middle" class="t-mut">bank</text>
    <text x="48" y="52" text-anchor="middle">tile</text>
    <text x="192" y="290" text-anchor="middle" class="t-mut">16 tiles</text>

    <text x="545" y="24" text-anchor="middle" class="t-b">one tile</text>
    <rect x="440" y="36" width="210" height="110" rx="6" class="f-panel s-line w1"/>
    <rect x="452" y="48" width="44" height="36" rx="3" class="f-ms s-m w1"/><rect x="594" y="48" width="44" height="36" rx="3" class="f-ms s-m w1"/><rect x="452" y="98" width="44" height="36" rx="3" class="f-ms s-m w1"/><rect x="594" y="98" width="44" height="36" rx="3" class="f-ms s-m w1"/>
    <rect x="510" y="66" width="70" height="50" rx="4" class="f-cs s-c w15"/><text x="545" y="96" text-anchor="middle" class="t-b">NFU</text>
    <text x="545" y="162" text-anchor="middle" class="t-mut">NFU + 4 eDRAM banks</text>

    <text x="545" y="190" text-anchor="middle" class="t-b">router (5×5 crossbar)</text>
    <rect x="505" y="215" width="80" height="54" rx="4" class="f-vs s-v w15"/><text x="545" y="246" text-anchor="middle">crossbar</text>
    <text x="545" y="208" text-anchor="middle" class="t-v">N</text><text x="545" y="290" text-anchor="middle" class="t-v">S</text><text x="485" y="246" text-anchor="middle" class="t-v">W</text><text x="605" y="246" text-anchor="middle" class="t-v">E</text><text x="640" y="276" class="t-v">self</text>
  </g>
  <path d="M76 48h18M152 48h78M288 48h18M76 124h18M152 124h78M288 124h18M76 200h18M152 200h78M288 200h18M48 76v18M48 152v18M48 228v18M124 76v18M124 152v18M124 228v18M260 76v18M260 152v18M260 228v18M336 76v18M336 152v18M336 228v18" class="s-v w1"/>
  <path d="M496 66h12M496 116h12M594 66h-12M594 116h-12" class="s-m w1"/>
  <path d="M545 212v1M585 262 L 634 272" class="s-v w1"/>
</svg></div>
<figcaption>Two interconnects: a mesh NoC between tiles (violet) and a fat tree from the central eDRAM banks to the tiles.</figcaption></figure>
<h3>The mesh network-on-chip</h3>
<p>A tile sends data to its router, the routers pass it along, and it arrives at the destination tile. DaDianNao uses <b>YX routing</b> (first along Y, then along X). Each router has five input and five output ports (<b>North, East, South, West and self</b>) joined by a <b>5×5 crossbar</b>, which is essentially a giant multiplexer. A packet goes through the router pipeline: <b>input buffering → route computation → (virtual-channel/) switch allocation → switch traversal → link traversal</b>. Routers also handle switching, flow control and error control.</p>
<div class="box insight" data-t="Why a crossbar"><p>Parallelism: packets going N→S, E→self and S→W can all cross the switch at once. Virtual channels reduce head-of-line blocking. State-of-the-art processors (Intel Xeon, AMD EPYC/Ryzen) also use NoCs.</p></div>
<h3>Results against an NVIDIA K20 GPU</h3>
<p>With 1, 4, 16 and 64 chips, DaDianNao reaches speedups of hundreds of times and energy reductions of roughly 100–1000× (log scale). The details matter for the exam:</p>
<ul>
<li>Energy reduction is above 1 for every configuration, but for some layers it is <b>lower with 64 chips</b> because of interconnect and eDRAM overhead.</li>
<li>Some conv layers need 64 chips; speedup generally grows with chip count, but <b>classifier layers gain little from 64 chips</b>: a trade-off.</li>
</ul>`
    },
    {
      id: 'shidiannao', title: 'ShiDianNao: vision processing near the sensor',
      html: String.raw`
<p>ShiDianNao ("vision computer") is curated for one application domain and placed <b>close to the image sensor</b>. Compared with DianNao it adds:</p>
<ul>
<li>An <b>ALU</b> to support different activation functions.</li>
<li>An <b>instruction buffer and decoder</b>.</li>
<li>A dataflow and algorithm–hardware mapping, with the NFU built as a <b>2-D PE array (Px × Py)</b> with buffer controller and NBin/NBout/SB banks.</li>
<li>It executes <b>entire DNNs</b>, not just one layer type, for tasks like facial recognition and handwritten digit recognition.</li>
</ul>
<div class="box exam" data-t="The series in one line each"><p><b>DianNao</b>: split buffers + 3-stage NFU. <b>DaDianNao</b>: scale out to multi-core tiles with eDRAM and a NoC. <b>ShiDianNao</b>: end-to-end applications next to the sensor.</p></div>`
    },
    {
      id: 'eyeriss', title: 'Eyeriss: architecture and data reuse',
      html: String.raw`
<p>Eyeriss (MIT) is "an energy-efficient <b>reconfigurable</b> accelerator for deep CNNs": the same hardware is used differently depending on the layer's parameters. What is new: the <b>row-stationary dataflow</b>, a new architecture, <b>run-length coding</b>, and a fabricated chip used as a co-processor.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 240" width="700" height="240" role="img" aria-label="Eyeriss: off-chip DRAM, RLC codec, global buffer, 12 by 14 PE array, ReLU; two clock domains">
  <g class="t-sm">
    <rect x="10" y="60" width="90" height="120" rx="6" class="f-ms s-m w15"/><text x="55" y="116" text-anchor="middle" class="t-b">DRAM</text><text x="55" y="134" text-anchor="middle" class="t-mut">64-bit link</text>
    <rect x="130" y="20" width="560" height="210" rx="8" class="f-none s-line w1 dash"/><text x="410" y="14" text-anchor="middle" class="t-mut">core clock domain (link clock domain talks to DRAM)</text>
    <rect x="145" y="60" width="80" height="50" rx="4" class="f-vs s-v w1"/><text x="185" y="82" text-anchor="middle">RLC</text><text x="185" y="98" text-anchor="middle" class="t-mut">decoder</text>
    <rect x="145" y="130" width="80" height="50" rx="4" class="f-vs s-v w1"/><text x="185" y="152" text-anchor="middle">RLC</text><text x="185" y="168" text-anchor="middle" class="t-mut">encoder</text>
    <rect x="250" y="50" width="100" height="140" rx="6" class="f-ms s-m w15"/><text x="300" y="116" text-anchor="middle" class="t-b">Global</text><text x="300" y="132" text-anchor="middle" class="t-b">buffer</text><text x="300" y="150" text-anchor="middle" class="t-mut">108 KB</text>
    <rect x="380" y="40" width="230" height="170" rx="6" class="f-panel s-line w1"/>
    <g class="f-cs s-c w1">
      <rect x="392" y="52" width="26" height="22" rx="2"/><rect x="424" y="52" width="26" height="22" rx="2"/><rect x="456" y="52" width="26" height="22" rx="2"/><rect x="488" y="52" width="26" height="22" rx="2"/><rect x="520" y="52" width="26" height="22" rx="2"/><rect x="552" y="52" width="26" height="22" rx="2"/>
      <rect x="392" y="80" width="26" height="22" rx="2"/><rect x="424" y="80" width="26" height="22" rx="2"/><rect x="456" y="80" width="26" height="22" rx="2"/><rect x="488" y="80" width="26" height="22" rx="2"/><rect x="520" y="80" width="26" height="22" rx="2"/><rect x="552" y="80" width="26" height="22" rx="2"/>
      <rect x="392" y="108" width="26" height="22" rx="2"/><rect x="424" y="108" width="26" height="22" rx="2"/><rect x="456" y="108" width="26" height="22" rx="2"/><rect x="488" y="108" width="26" height="22" rx="2"/><rect x="520" y="108" width="26" height="22" rx="2"/><rect x="552" y="108" width="26" height="22" rx="2"/>
      <rect x="392" y="136" width="26" height="22" rx="2"/><rect x="424" y="136" width="26" height="22" rx="2"/><rect x="456" y="136" width="26" height="22" rx="2"/><rect x="488" y="136" width="26" height="22" rx="2"/><rect x="520" y="136" width="26" height="22" rx="2"/><rect x="552" y="136" width="26" height="22" rx="2"/>
    </g>
    <text x="495" y="182" text-anchor="middle" class="t-b">12 × 14 PE array (168 PEs)</text><text x="495" y="198" text-anchor="middle" class="t-mut">each PE: spad + 16-bit MAC</text>
    <rect x="630" y="90" width="50" height="60" rx="4" class="f-panel s-line w1"/><text x="655" y="124" text-anchor="middle">ReLU</text>
  </g>
  <path d="M100 85h43M225 85h23M350 120h28M610 120h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M655 150 C 655 230, 300 230, 300 192M248 155h-21M143 155h-41" class="f-none s-m w15" marker-end="url(#arr-m)"/>
</svg></div>
<figcaption>Eyeriss top level. Data moves at three levels: PE ↔ global buffer, PE ↔ PE, and PE ↔ its own scratchpad (spad).</figcaption></figure>
<ul>
<li><b>Two clock domains</b>: the core clock for processing and the link clock for DRAM communication.</li>
<li><b>Two levels of control</b>. Top level: DRAM ↔ global buffer traffic, global buffer ↔ PE array traffic over the NoC, and the RLC and ReLU blocks. Low level: control logic inside each PE.</li>
<li>PEs run <b>independently</b>: each starts as soon as its fmaps or psums arrive. This is <b>not</b> lock-step like a systolic array.</li>
</ul>
<h3>Data reuse Eyeriss exploits</h3>
<div class="grid2">
<ul><li>Each <b>filter</b> is reused E × F times within one ifmap plane.</li><li>Each <b>ifmap pixel</b> is reused R × S times within one filter plane.</li></ul>
<ul><li>Each filter weight is reused across a <b>batch of N</b> ifmaps.</li><li>Each ifmap is reused across <b>M filters</b>.</li></ul>
</div>
<p>Guiding idea: the C × R × S partial sums for an output must be combined <b>as soon as possible</b>, to minimize their storage and movement.</p>`
    },
    {
      id: 'rs', title: 'Row stationary (RS) dataflow',
      html: String.raw`
<p><b>1-D primitive.</b> Each PE handles <b>one row of filter weights and one row of the ifmap</b> and produces one row of partial sums by sliding: filter row [w1 w2 w3] on ifmap row [i1 … i5] gives psum1 = w·[i1 i2 i3], psum2 = w·[i2 i3 i4], psum3 = w·[i3 i4 i5], all inside one PE.</p>
<div class="formula"><span class="fl">Scratchpad needed per PE</span><div class="fm">\[ \underbrace{S}_{\text{filter row}} + \underbrace{S}_{\text{ifmap window}} + \underbrace{1}_{\text{psum}} = 2S + 1 \]</div></div>
<p><b>2-D convolution</b> is several 1-D convolutions. On a 3×3 set of PEs (3×3 filter, 5×5 ifmap, stride 1, 3×3 ofmap):</p>
<ul>
<li><b>Filter rows are reused horizontally</b>: PE row i holds filter row i in every column.</li>
<li><b>Ifmap rows are reused diagonally</b>: column 1 gets ifmap rows 1–3, column 2 rows 2–4, column 3 rows 3–5.</li>
<li><b>Partial sums accumulate vertically</b>: each column adds its three psum rows into one ofmap row.</li>
</ul>
<div data-w="rowstat"></div>
<p>The chip's array is 12 × 14 PEs (the paper describes it as 14 × 12). RS is roughly a combination of weight stationary and output stationary: weights stay in a PE row, and psums are completed within a column.</p>`
    },
    {
      id: 'rlc', title: 'Exploiting zeros: run-length coding and data gating',
      html: String.raw`
<p>After ReLU many activations are zero. Eyeriss compresses them with <b>run-length coding (RLC)</b> between the global buffer and off-chip DRAM. Each pair is a <b>5-bit run</b> (number of zeros) and a <b>16-bit level</b> (the non-zero value): 21 bits. Three pairs plus a terminal bit fill a 64-bit word.</p>
<div class="formula"><span class="fl">Lecture example</span><div class="fm">\[ 0,0,12,0,0,0,0,53,0,0,22 \;\rightarrow\; (2, 12)\,(4, 53)\,(2, 22) + \text{term bit} \]</div><span class="fn">3 × 21 + 1 = 64 bits hold 11 values; plain 16-bit storage fits 4. A run is at most 31; longer runs emit (31, 0) and continue.</span></div>
<div data-w="rlc"></div>
<p>Uncompressed DRAM traffic is <b>1.2–1.9× higher</b> than compressed across AlexNet CONV1–5.</p>
<div class="grid2">
  <div class="tile"><h4>Global input network</h4><p>A vertical Y-bus feeds 12 horizontal X-buses, each connected to the 14 PEs of a row. A multicast controller delivers data by matching destination IDs.</p></div>
  <div class="tile"><h4>Processing element</h4><p>16-bit two-stage pipelined multiplier and adder. <b>Data gating</b>: when an input is zero the MAC and spad reads are skipped, since zero times anything is zero, which saves energy.</p></div>
</div>`
    },
    {
      id: 'eyeriss-results', title: 'Eyeriss chip and results',
      html: String.raw`
<p>The chip is a co-processor: <b>168 PEs, 108 KB global buffer, 3.5 mm × 3.5 mm, 65 nm</b>. In the test setup an NVIDIA Jetson host offloads convolution tasks through a Xilinx FPGA interface to the Eyeriss chip.</p>
<div class="grid2">
<div data-w="bars" data-o='{"title":"Eyeriss core area","unit":"%","max":100,"labelWidth":110,"barWidth":230,"items":[["PE array",78.6,"c","78.6%"],["Global buffer",18.8,"m","18.8%"],["NoC",1.8,"v","1.8%"],["RLC + ReLU",0.3,"v","~0.3%"]]}'></div>
<div data-w="bars" data-o='{"title":"Inside one PE (area)","unit":"%","max":100,"labelWidth":110,"barWidth":230,"items":[["Scratchpads",61,"m","61%"],["Control",11.4,"v","11.4%"],["MAC",9.4,"c","9.4%"],["FIFO",8.3,"m","8.3%"]]}'></div>
</div>
<div data-w="bars" data-o='{"title":"Eyeriss power breakdown on AlexNet","hint":"Share of chip power","unit":"%","max":50,"labelWidth":170,"items":[["CONV1: spad",42.5,"m","42.5%"],["CONV1: clock network",33,"v","33%"],["CONV1: MAC",8.9,"c","8.9%"],["CONV5: spad",33,"m","33%"],["CONV5: clock network",45,"v","45%"],["CONV5: MAC",3,"c","~3%"]]}'></div>
<div class="box exam" data-t="Takeaway (same as DianNao)"><p>About <b>84% of the chip is memory</b> (spads, FIFOs, global buffer) and compute is only about 8%. Most power goes to storage, the clock network and control, not to arithmetic. Better memory is what is needed.</p></div>`
    },
    {
      id: 'v2', title: 'Eyeriss v2: distribute the communication',
      html: String.raw`
<p>Think about Eyeriss from the communication side: <b>one interface</b> between the global buffer and the PE array carries every data type (filters, ifmaps and psums, tens of GB for AlexNet). That single link is a bottleneck. Eyeriss v2 (IEEE JETCAS 2019, "a flexible accelerator for emerging DNNs on mobile devices") <b>distributes the communication</b>:</p>
<ul>
<li><b>GLB clusters</b> with separate SRAM banks for input activations and psums.</li>
<li><b>Router clusters</b> with separate routers for input activations, weights and psums.</li>
<li><b>PE clusters</b> of X × Y PEs, all-to-all connected inside a cluster.</li>
<li>Clusters joined by a 2-D mesh: a <b>hierarchical mesh NoC (HM-NoC)</b>, plus external memory.</li>
</ul>
<p>Result: less conflict and congestion, lower latency, and <b>reconfigurable computing</b>: the hardware is fixed but the data-movement pattern changes per workload.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 110" width="700" height="110" role="img" aria-label="NoC spectrum from unicast to broadcast">
  <defs><linearGradient id="noc-g" x1="0" x2="1"><stop offset="0" style="stop-color:var(--memory)"/><stop offset="1" style="stop-color:var(--comm)"/></linearGradient></defs>
  <rect x="20" y="40" width="660" height="14" rx="7" fill="url(#noc-g)"/>
  <g class="t-sm">
    <text x="40" y="30" text-anchor="middle" class="t-b">Unicast</text><text x="250" y="30" text-anchor="middle" class="t-b">1-D systolic</text><text x="450" y="30" text-anchor="middle" class="t-b">1-D multicast</text><text x="660" y="30" text-anchor="middle" class="t-b">Broadcast</text>
    <text x="20" y="78" class="t-m">high bandwidth, low spatial reuse</text><text x="680" y="78" text-anchor="end" class="t-v">low bandwidth, high spatial reuse</text>
    <text x="350" y="102" text-anchor="middle" class="t-mut">HM-NoC can be configured anywhere along this line</text>
  </g>
</svg></div></figure>
<p>HM-NoC operating modes: <b>high-bandwidth mode</b>, <b>high-reuse mode</b>, <b>grouped-multicast mode</b> and <b>interleaved-multicast mode</b>.</p>`
    }
  ],
  takeaways: [
    'Accelerators target inference and must win on latency, energy and area at once.',
    'DianNao tiles inputs to fit L1: activations fetched less, psums more (cheap since Tout is small).',
    'DianNao hardware: split buffers NBin/SB/NBout, circular NBout for psums, 16-bit fixed point, adder tree, piecewise-linear activation.',
    'DianNao buffers take ~70% of area and >60% of power; memory matters more than compute.',
    'DaDianNao: 16 tiles, each NFU with 4 eDRAM banks; fat tree from central eDRAM, mesh NoC with 5×5 crossbar routers and YX routing.',
    'Eyeriss row stationary: filter rows horizontal, ifmap rows diagonal, psums vertical; spad 2S + 1.',
    'Eyeriss RLC: 5-bit run + 16-bit level, 3 pairs + 1 bit per 64-bit word; data gating skips zero MACs.',
    'Eyeriss v2 distributes communication with GLB, router and PE clusters on a hierarchical mesh NoC.'
  ],
  numbers: [
    ['DianNao chip', '3.02 mm², 485 mW', '65 nm'],
    ['16-bit fixed vs 32-bit float multiplier', '1309 µm², 576 µW vs ~6× area, ~7× power', 'DianNao NFU-1'],
    ['DianNao energy vs SIMD', '~21× (geomean)', '~28× on CONV1'],
    ['DianNao buffers', '~70% area, >60% power', 'NFU only ~28%'],
    ['DaDianNao', '16 tiles, 4 eDRAM banks per NFU', '+2 central eDRAM banks'],
    ['Eyeriss', '168 PEs (12×14), 108 KB GLB', '3.5 × 3.5 mm, 65 nm'],
    ['Eyeriss RLC word', '64 bits = 3 × (5 + 16) + 1', '11 values in the example'],
    ['Eyeriss DRAM traffic without RLC', '1.2–1.9× higher', 'AlexNet CONV1–5'],
    ['Eyeriss memory share', '~84% of chip', 'compute ~8%']
  ],
  quiz: [
    { q: 'Total memory accesses of DianNao\'s naive classifier layer?', o: ['Tin + Tout', 'Tin·Tout + Tin·Tout + Tout', '2·Tin·Tout·Tout', 'Tin·Tout'], a: 1, why: 'Activations and weights are each fetched Tin·Tout times; sums Tout times.' },
    { q: 'What does tiling the classifier layer trade?', o: ['More activation fetches for fewer psum fetches', 'Fewer activation fetches for more psum fetches', 'Accuracy for speed', 'Area for power'], a: 1, why: 'Psums are fetched more, but Tout is small so it is cheap.' },
    { q: 'Why does DianNao use three split buffers instead of one cache?', o: ['To store more data', 'Fewer conflicts, shorter access time, different widths', 'To support floating point', 'To remove the DMA'], a: 1, why: 'NBin, SB and NBout are separate scratchpads, each with its own width.' },
    { q: 'What does DianNao\'s NFU-3 use for the activation function?', o: ['A lookup of exact exponentials', 'A piecewise-linear approximation', 'A CORDIC unit', 'Software on the CP'], a: 1, why: 'Exponentials and divisions are expensive; more segments give better accuracy.' },
    { q: 'Which part of DianNao takes the largest share of area?', o: ['NFU', 'SB (synapse buffer)', 'CP', 'DMA'], a: 1, why: 'SB is 38.17% of area; buffers together ~70%.' },
    { q: 'In DaDianNao, how many eDRAM banks connect to each NFU?', num: 4, tol: 0, why: 'Each tile is one NFU plus four eDRAM banks.' },
    { q: 'How many ports does a DaDianNao mesh router have?', o: ['4', '5 (N, E, S, W, self)', '8', '16'], a: 1, why: 'Five input and five output ports joined by a 5×5 crossbar.' },
    { q: 'In row stationary, ifmap rows are reused…', o: ['horizontally', 'vertically', 'diagonally', 'not at all'], a: 2, why: 'Filter rows horizontal, ifmap rows diagonal, psums vertical.' },
    { q: 'Scratchpad entries per PE in row stationary for filter width S?', o: ['S', '2S', '2S + 1', 'S²'], a: 2, why: 'S weights + S ifmap values + 1 psum.' },
    { q: 'How many values does the lecture\'s RLC example fit into one 64-bit word?', num: 11, tol: 0, why: '(2,12)(4,53)(2,22): 2+1+4+1+2+1 = 11 values.' },
    { q: 'Unlike a systolic array, Eyeriss PEs…', o: ['run in lock-step', 'start whenever their data arrives', 'have no local storage', 'cannot accumulate'], a: 1, why: 'Each PE processes independently as soon as fmaps/psums arrive.' },
    { q: 'What was the main problem Eyeriss v2 fixed?', o: ['Too little compute', 'A single GLB–PE interface carrying all data types', 'No ReLU support', 'Lack of RLC'], a: 1, why: 'It distributes communication with clustered buffers, routers and PEs on an HM-NoC.' }
  ],
  cards: [
    { f: 'Accelerator metrics', b: 'Inference latency, energy and area, all kept in check together.' },
    { f: 'DianNao tiling', b: 'Tile input neurons to fit L1; compute each tile\'s contribution to all outputs; accumulate psums.' },
    { f: 'DianNao NFU', b: 'NFU-1 16-bit fixed-point multipliers, NFU-2 adder tree, NFU-3 piecewise-linear non-linearity.' },
    { f: 'NBout circular buffer', b: 'Keeps partial sums on chip and feeds them back to the adder tree instead of spilling to memory.' },
    { f: 'DaDianNao', b: '16 tiles (NFU + 4 eDRAM banks), 2 central eDRAM banks via fat tree, mesh NoC with 5×5 crossbars, YX routing.' },
    { f: 'Router pipeline', b: 'Input buffering → route computation → switch allocation → switch traversal → link traversal.' },
    { f: 'ShiDianNao', b: 'Vision computer near the sensor: ALU, instruction buffer, 2-D PE array, runs whole DNNs.' },
    { f: 'Row stationary', b: 'PE does 1-D conv of a filter row on an ifmap row. Filter rows horizontal, ifmap diagonal, psums vertical.' },
    { f: 'Eyeriss RLC', b: '5-bit run + 16-bit level; 3 pairs + term bit = 64 bits. 1.2–1.9× less DRAM traffic.' },
    { f: 'Eyeriss v2', b: 'GLB clusters, router clusters, PE clusters on a hierarchical mesh NoC; modes: high bandwidth, high reuse, grouped and interleaved multicast.' }
  ]
});
