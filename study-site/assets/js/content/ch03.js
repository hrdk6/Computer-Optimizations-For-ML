CSO.register({
  id: 'ch03', num: 3, part: 'I', kind: 'compute', span: 3, cover: 'gemm',
  coverAlt: 'Two large matrices split into glowing tiles, with one tile pair highlighted as it is multiplied.',
  title: 'Computing a layer as matrix multiplication', short: 'Convolution as GEMM',
  lectures: [5, 6, 7],
  summary: 'How a seven-loop convolution becomes one big matrix product, what that costs in memory, how fully connected layers fit the same mould, and how tiling, BLAS libraries, tensor cores and the TPU make matrix multiplication fast.',
  sections: [
    {
      id: 'loops', title: 'The naive seven-loop convolution',
      html: String.raw`
<p>Writing the convolution equation directly gives seven nested loops, one per shape parameter:</p>
<pre><code><span class="tok-k">for</span> (n = 0; n &lt; N; n++)              <span class="tok-c">// batch</span>
 <span class="tok-k">for</span> (m = 0; m &lt; M; m++)             <span class="tok-c">// filters = output channels</span>
  <span class="tok-k">for</span> (x = 0; x &lt; F; x++)            <span class="tok-c">// output width</span>
   <span class="tok-k">for</span> (y = 0; y &lt; E; y++) {          <span class="tok-c">// output height</span>
    O[n][m][x][y] = B[m];
    <span class="tok-k">for</span> (i = 0; i &lt; R; i++)          <span class="tok-c">// filter height</span>
     <span class="tok-k">for</span> (j = 0; j &lt; S; j++)         <span class="tok-c">// filter width</span>
      <span class="tok-k">for</span> (k = 0; k &lt; C; k++)        <span class="tok-c">// channels</span>
        O[n][m][x][y] += I[n][k][U*x+i][U*y+j] * W[m][k][i][j];
    O[n][m][x][y] = <span class="tok-f">Activation</span>(O[n][m][x][y]);
   }</code></pre>
<p>Every iteration of the innermost loop touches memory, and the access pattern jumps around: the same filter is fetched again for every output position, and overlapping input patches are fetched again for every filter. That is slow on a CPU, but it also hints at an opportunity: <b>lots of the data is reused</b>, so a smarter arrangement can fetch it fewer times.</p>`
    },
    {
      id: 'toeplitz', title: 'Flattening convolution into a matrix product',
      html: String.raw`
<p>Look at one output pixel: it is the <b>dot product</b> of the flattened filter with the flattened patch under it. Do that for every patch and you have a vector-times-matrix product. Take a 2×2 filter [1 2; 3 4] on a 3×3 input numbered 1–9 (stride 1, so the output is 2×2):</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="Flattened filter row times Toeplitz matrix equals output row">
  <g class="t-sm t-mono">
    <text x="10" y="20" class="t-mut t-ui">filter row</text>
    <g transform="translate(10,30)"><rect width="34" height="30" class="f-vs s-v w1"/><rect x="36" width="34" height="30" class="f-vs s-v w1"/><rect x="72" width="34" height="30" class="f-vs s-v w1"/><rect x="108" width="34" height="30" class="f-vs s-v w1"/>
    <text x="17" y="20" text-anchor="middle">1</text><text x="53" y="20" text-anchor="middle">2</text><text x="89" y="20" text-anchor="middle">3</text><text x="125" y="20" text-anchor="middle">4</text></g>
    <text x="172" y="52" class="t-lg">×</text>
    <text x="200" y="20" class="t-mut t-ui">Toeplitz matrix: one column per patch</text>
    <g transform="translate(200,30)">
      <g class="f-ms s-m w1"><rect width="40" height="30"/><rect y="32" width="40" height="30"/><rect y="64" width="40" height="30"/><rect y="96" width="40" height="30"/></g>
      <g class="f-surf s-line w1"><rect x="42" width="40" height="30"/><rect x="42" y="32" width="40" height="30"/><rect x="42" y="64" width="40" height="30"/><rect x="42" y="96" width="40" height="30"/>
      <rect x="84" width="40" height="30"/><rect x="84" y="32" width="40" height="30"/><rect x="84" y="64" width="40" height="30"/><rect x="84" y="96" width="40" height="30"/>
      <rect x="126" width="40" height="30"/><rect x="126" y="32" width="40" height="30"/><rect x="126" y="64" width="40" height="30"/><rect x="126" y="96" width="40" height="30"/></g>
      <text x="20" y="20" text-anchor="middle">1</text><text x="20" y="52" text-anchor="middle">2</text><text x="20" y="84" text-anchor="middle">4</text><text x="20" y="116" text-anchor="middle">5</text>
      <text x="62" y="20" text-anchor="middle">2</text><text x="62" y="52" text-anchor="middle">3</text><text x="62" y="84" text-anchor="middle">5</text><text x="62" y="116" text-anchor="middle">6</text>
      <text x="104" y="20" text-anchor="middle">4</text><text x="104" y="52" text-anchor="middle">5</text><text x="104" y="84" text-anchor="middle">7</text><text x="104" y="116" text-anchor="middle">8</text>
      <text x="146" y="20" text-anchor="middle">5</text><text x="146" y="52" text-anchor="middle">6</text><text x="146" y="84" text-anchor="middle">8</text><text x="146" y="116" text-anchor="middle">9</text>
    </g>
    <text x="390" y="52" class="t-lg">=</text>
    <text x="440" y="20" class="t-mut t-ui">output row</text>
    <g transform="translate(420,30)"><g class="f-cs s-c w1"><rect width="50" height="30"/><rect x="52" width="50" height="30"/><rect x="104" width="50" height="30"/><rect x="156" width="50" height="30"/></g>
      <text x="25" y="20" text-anchor="middle">37</text><text x="77" y="20" text-anchor="middle">47</text><text x="129" y="20" text-anchor="middle">67</text><text x="181" y="20" text-anchor="middle">77</text></g>
    <text x="420" y="100" class="t-mut">1·1 + 2·2 + 3·4 + 4·5 = 37</text>
    <text x="420" y="122" class="t-mut t-ui">pixels 2, 4, 5, 6, 8 appear more than once</text>
  </g>
</svg></div>
<figcaption>The first column (copper) is the first patch [1 2 4 5]. The whole convolution is now one vector × matrix product. This flattened input matrix is called a Toeplitz matrix (the im2col layout).</figcaption></figure>
<p>Try it on the 4×4 example worked through in Lecture 6 (filter [1 2; 3 4], input numbered 1–16, nine patches, outputs 44 … 144):</p>
<div data-w="im2col"></div>
<h3>Several channels</h3>
<p>With two input channels, filter channel 1 must multiply input channel 1 and filter channel 2 must multiply input channel 2, and the two results must be added. Flattening handles this neatly: <b>append the channel-2 filter values in the same row</b>, and <b>stack the channel-2 patch below the channel-1 patch in each column</b>. A single dot product then multiplies matching channels and sums across them automatically.</p>
<h3>Several filters</h3>
<p>Each additional filter becomes <b>another row</b> of the filter matrix. Row m times the input matrix gives output channel m, so the output comes out as a matrix whose rows are output channels.</p>
<div class="formula"><span class="fl">Shapes after flattening (stride 1)</span><div class="fm">\[ \underbrace{[\,M \times CRS\,]}_{\text{filters}} \times \underbrace{[\,CRS \times (H-R+1)(W-S+1)N\,]}_{\text{input fmaps}} = \underbrace{[\,M \times (H-R+1)(W-S+1)N\,]}_{\text{output fmaps}} \]</div><span class="fn">Rows of the filter matrix are filters; columns of the input matrix are patches, for every image in the batch.</span></div>
<div class="grid2">
  <div class="box insight" data-t="What we gain"><p>Seven irregular loops become one <b>general matrix multiplication (GEMM)</b>: three simple loops, and decades of highly tuned GEMM libraries and hardware can be used.</p></div>
  <div class="box exam" data-t="What it costs"><p><b>Nothing is free.</b> Building the Toeplitz matrix (pre-processing) and reshaping the output back into fmaps for the next layer (post-processing) take time, and the matrix <b>duplicates data</b>: in the 4×4 example 16 inputs become 36 stored values. If that overhead is large, flattening may not pay off.</p></div>
</div>`
    },
    {
      id: 'fc', title: 'Fully connected layers are matrix products too',
      html: String.raw`
<p>A fully connected (FC) layer is the degenerate convolution where the <b>filter is as large as the input fmap</b> (R = H, S = W). The filter fits in exactly one position, so each filter produces a 1×1 output, one number per output channel: \(E = (H - H + 1)/1 = 1\).</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 210" width="720" height="210" role="img" aria-label="FC layer flattened: M by CHW filter matrix times CHW by N input matrix gives M by N output">
  <g class="t-sm">
    <rect x="20" y="40" width="240" height="90" rx="3" class="f-vs s-v w15"/>
    <line x1="20" y1="70" x2="260" y2="70" class="s-v w1"/><line x1="20" y1="100" x2="260" y2="100" class="s-v w1"/>
    <text x="140" y="30" text-anchor="middle" class="t-b">filters: M × CHW</text><text x="140" y="150" text-anchor="middle" class="t-mut">each row = one filter, flattened</text>
    <text x="285" y="92" class="t-lg">×</text>
    <rect x="310" y="20" width="90" height="140" rx="3" class="f-ms s-m w15"/>
    <line x1="340" y1="20" x2="340" y2="160" class="s-m w1"/><line x1="370" y1="20" x2="370" y2="160" class="s-m w1"/>
    <text x="355" y="180" text-anchor="middle" class="t-b">inputs: CHW × N</text><text x="355" y="198" text-anchor="middle" class="t-mut">each column = one image</text>
    <text x="420" y="92" class="t-lg">=</text>
    <rect x="450" y="40" width="90" height="90" rx="3" class="f-cs s-c w15"/>
    <text x="495" y="30" text-anchor="middle" class="t-b">outputs: M × N</text><text x="495" y="150" text-anchor="middle" class="t-mut">column n = 1×1×M output</text>
    <text x="570" y="70" class="t-mut">N = 1: matrix × vector</text><text x="570" y="92" class="t-mut">N &gt; 1: matrix × matrix</text>
  </g>
</svg></div>
<figcaption>Flattened FC layer. Three dimensions (C channels and the H×W filter) are flattened into one of length CHW.</figcaption></figure>
<p>With batch size 1 this is a matrix–vector product; batching N inputs turns it into a <b>matrix–matrix</b> product. The lecture then asks: how much <b>temporal locality</b> (reuse of the same data within a short time) does this implementation have? <b>None.</b> Each row is multiplied by each column once and nothing is kept for reuse, even though many values repeat. Tiling, next, fixes that.</p>`
    },
    {
      id: 'tiling', title: 'Tiling: making the matrix fit the cache',
      html: String.raw`
<p>The matrices are big. Two 8192 × 8192 matrices of 32-bit floats take 8192² × 4 B = 256 MB each, about 0.5 GB together, while caches hold kilobytes to a few megabytes. And arithmetic can only happen on data that has been brought from DRAM into the cache.</p>
<p>So <b>matrix multiplication is tiled to fit in cache</b>, and the <b>computation is ordered to maximise reuse</b> of whatever is already in cache. Split the filter matrix into tiles F₀₀, F₀₁, F₁₀, F₁₁ and the input matrix into I₀₀ … I₁₁; then each output tile is a sum of tile products:</p>
<div class="formula"><span class="fl">2×2 tiled product</span><div class="fm">\[ O_{00} = F_{00}I_{00} + F_{01}I_{10},\quad O_{01} = F_{00}I_{01} + F_{01}I_{11},\quad O_{10} = F_{10}I_{00} + F_{11}I_{10},\quad O_{11} = F_{10}I_{01} + F_{11}I_{11} \]</div><span class="fn">After computing F₀₀I₀₀, do F₀₀I₀₁ next (F₀₀ is still in cache) or F₁₀I₀₀ (I₀₀ is still in cache).</span></div>
<div data-w="tiling"></div>
<div data-w="gemm3d"></div>
<p>Production libraries do exactly this. <b>GEMM</b> (generalised matrix multiplication) libraries such as <b>OpenBLAS</b> and <b>Intel MKL</b> on CPUs and <b>cuBLAS</b> and <b>cuDNN</b> on GPUs <b>look at the shape of the multiplication and pick an implementation optimised for that shape</b>, tiling it to the machine's storage hierarchy (L1, L2, maybe L3, each with different sizes).</p>
<div class="box exam"><p>Tiling does not change the result, only the order of operations and therefore the memory traffic. "Optimization usually involves proper tiling to the storage hierarchy."</p></div>`
    },
    {
      id: 'hw', title: 'Hardware built for matrix multiply: tensor cores and the TPU',
      html: String.raw`
<p>Because almost all ML compute is matrix multiplication, hardware vendors build units just for it.</p>
<div class="grid2">
  <div class="tile"><h4>NVIDIA GV100 tensor core (Volta)</h4>
    <ul><li>New opcode: <b>matrix multiply–accumulate (HMMA)</b>, D = A × B + C on 4×4 matrices.</li><li>FP16 operands: 48 inputs, 16 outputs.</li><li>64 multiplies and 64 adds per operation.</li><li><b>120 TFLOPS</b> (FP16) and <b>400 GFLOPS/W</b>.</li></ul></div>
  <div class="tile"><h4>Google TPU</h4>
    <ul><li>Its heart is the <b>matrix multiply unit</b>, a systolic array.</li><li>Weights enter from the top through a weight FIFO; data flows horizontally from the unified buffer; partial sums flow vertically into accumulators.</li><li>Around it: PCIe host interface, unified buffer, systolic data setup, activation, normalize/pool, control.</li></ul></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 262" width="700" height="262" role="img" aria-label="Simplified TPU block diagram">
  <g class="t-sm">
    <rect x="10" y="90" width="110" height="60" rx="5" class="f-panel s-line w1"/><text x="65" y="116" text-anchor="middle" class="t-b">Host</text><text x="65" y="134" text-anchor="middle" class="t-mut">PCIe interface</text>
    <rect x="150" y="80" width="130" height="80" rx="5" class="f-ms s-m w15"/><text x="215" y="114" text-anchor="middle" class="t-b">Unified buffer</text><text x="215" y="132" text-anchor="middle" class="t-mut">activations</text>
    <rect x="310" y="40" width="200" height="160" rx="5" class="f-cs s-c w2"/><text x="410" y="112" text-anchor="middle" class="t-b">Matrix multiply unit</text><text x="410" y="130" text-anchor="middle" class="t-mut">systolic array of MACs</text>
    <rect x="310" y="6" width="200" height="26" rx="4" class="f-vs s-v w1"/><text x="410" y="24" text-anchor="middle">weight FIFO (from DRAM)</text>
    <rect x="540" y="60" width="140" height="40" rx="4" class="f-panel s-line w1"/><text x="610" y="85" text-anchor="middle">Accumulators</text>
    <rect x="540" y="120" width="140" height="40" rx="4" class="f-panel s-line w1"/><text x="610" y="145" text-anchor="middle">Activation, norm/pool</text>
    <text x="410" y="254" text-anchor="middle" class="t-mut">data flows →, partial sums flow ↓, weights come from the top</text>
  </g>
  <path d="M120 120h28M280 120h28M410 32v6M510 80h28M610 100v18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M540 160 C 480 230, 230 230, 215 162" class="f-none s-mut w15 dash" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>The TPU in one picture: everything around the matrix multiply unit exists to keep it fed. Chapter 5 explains the systolic dataflow inside it.</figcaption></figure>
<div class="box insight"><p>The same multiplication can be made faster by the system without changing the algorithm: by flattening, tiling and ordering it in software, and by dedicated units (tensor cores, systolic arrays) in hardware.</p></div>`
    }
  ],
  takeaways: [
    'A direct convolution is seven nested loops with irregular, repeated memory accesses.',
    'Flattening (Toeplitz/im2col) turns convolution into one GEMM: filters become rows, patches become columns.',
    'Flattening costs pre- and post-processing time and duplicates input data (16 → 36 values in the 4×4 example).',
    'An FC layer is a conv whose filter equals the input size; batching makes it a matrix–matrix product; the naive version has no temporal locality.',
    'Tiling fits matrices into cache and orders tile products to reuse cached tiles; BLAS libraries choose tiles by shape and cache sizes.',
    'Tensor cores (D = A·B + C, 4×4 FP16) and the TPU\'s systolic matrix unit are hardware built for GEMM.'
  ],
  numbers: [
    ['Two 8192×8192 FP32 matrices', '≈ 512 MB', '256 MB each; caches are KB to MB'],
    ['GV100 tensor core operation', '4×4×4 D = A·B + C', '64 multiplies + 64 adds, FP16'],
    ['GV100 tensor core throughput', '120 TFLOPS, 400 GFLOPS/W', 'FP16'],
    ['Toeplitz size for 4×4 input, 2×2 filter', '4 × 9 = 36 values', 'vs 16 original pixels'],
    ['Outputs of the 4×4 example', '44, 54, 64, 84, 94, 104, 124, 134, 144', 'filter [1 2; 3 4]']
  ],
  quiz: [
    { q: 'After flattening, the filter matrix of a conv layer has shape…', o: ['CRS × M', 'M × CRS', 'M × HW', 'N × CRS'], a: 1, why: 'Each of the M filters becomes one row of length C·R·S.' },
    { q: 'The flattened input matrix for stride 1 has how many columns?', o: ['CRS', '(H − R + 1)(W − S + 1)·N', 'M·N', 'H·W'], a: 1, why: 'One column per patch, for every image in the batch.' },
    { q: 'Filter [1 2; 3 4] on the 4×4 input numbered 1–16: what is the first output pixel?', num: 44, tol: 0, why: 'Patch [1, 2, 5, 6]: 1·1 + 2·2 + 3·5 + 4·6 = 44.' },
    { q: 'Which is a real downside of flattening convolution into GEMM?', o: ['It changes the numerical result', 'It duplicates input data and needs pre/post-processing', 'It cannot handle multiple channels', 'It prevents using GPUs'], a: 1, why: 'Same result, but extra memory for repeated pixels plus reshaping time.' },
    { q: 'A fully connected layer is a convolution where…', o: ['the stride equals 2', 'the filter size equals the input fmap size', 'there is only one channel', 'there is no bias'], a: 1, why: 'The filter fits in one position, so each output channel is 1×1.' },
    { q: 'For a flattened FC layer, what turns a matrix–vector product into a matrix–matrix product?', o: ['More filters', 'A batch size N > 1', 'Stride > 1', 'Padding'], a: 1, why: 'Each image in the batch adds a column to the input matrix.' },
    { q: 'How much temporal locality does the naive flattened FC implementation have, per the lecture?', o: ['Perfect', 'Some', 'None', 'Depends on stride'], a: 2, why: 'Values are multiplied once and never reused while they are on chip.' },
    { q: 'Why do GEMM libraries such as cuBLAS look at the matrix shape?', o: ['To pick a tiling and implementation tuned for that shape and the cache hierarchy', 'To check numerical stability', 'To convert to FP16', 'To decide the activation function'], a: 0, why: '"Library will note shape of the matrix multiplication and select implementation optimized for that shape."' },
    { q: 'A GV100 tensor core computes D = A·B + C on 4×4 matrices. How many multiplies is that?', num: 64, tol: 0, why: '4 × 4 outputs × 4 products each = 64 multiplies, plus 64 additions.' },
    { q: 'What is the heart of the TPU?', o: ['A large L3 cache', 'The matrix multiply unit (a systolic array)', 'A branch predictor', 'An FFT engine'], a: 1, why: 'Everything else in the TPU exists to feed the matrix multiply unit.' }
  ],
  cards: [
    { f: 'Toeplitz / im2col', b: 'Lay each input patch out as a column so convolution = filter rows × patch matrix (one GEMM).' },
    { f: 'Flattening with C channels', b: 'Append channel values in the same filter row; stack channel patches vertically in each column.' },
    { f: 'Flattened shapes', b: 'M × CRS times CRS × (H−R+1)(W−S+1)N gives M × (H−R+1)(W−S+1)N.' },
    { f: 'Cost of flattening', b: 'Pre-processing, post-processing (reshape) and duplicated input data.' },
    { f: 'FC layer as conv', b: 'Filter = input size → 1×1 output per filter; M × CHW times CHW × N.' },
    { f: 'Tiling', b: 'Split matrices into cache-sized tiles and order tile products to reuse tiles already in cache.' },
    { f: 'GEMM libraries', b: 'CPU: OpenBLAS, Intel MKL. GPU: cuBLAS, cuDNN. Choose implementation by shape and storage hierarchy.' },
    { f: 'GV100 tensor core', b: 'HMMA: D = A×B + C, 4×4 FP16; 64 mul + 64 add; 120 TFLOPS; 400 GFLOPS/W.' }
  ]
});
