CSO.register({
  id: 'ch17', num: 17, part: 'VII', kind: 'compute', span: 4, cover: 'npu',
  coverAlt: 'An NPU die with a two-dimensional array of AI Engine tiles above rows of memory and interface tiles.',
  title: 'NPUs, CPU vector units and GPUs', short: 'NPUs, SIMD and GPUs',
  lectures: [56, 57, 58],
  summary: 'The hardware that runs ML today. AMD\'s Ryzen AI NPU: a spatial dataflow array of AI Engine tiles, its software flow through ONNX, Quark quantization and ONNX Runtime\'s Vitis AI execution provider. Then CPU SIMD extensions (AVX-512, VNNI), and GPUs: the SM hierarchy, CUDA\'s threads, warps and blocks, pitfalls, and tensor cores.',
  sections: [
    {
      id: 'aipc', title: 'The AI PC and why it needs an NPU',
      html: String.raw`
<p>The trend is CPU → GPU → accelerator → <b>NPU</b> (Neural Processing Unit); Intel and Qualcomm build NPUs too. This guest lecture (Naveen Purushottam, AMD) covers AMD's Ryzen AI.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Generation</th><th>NPU performance</th><th>Target workloads</th></tr></thead>
<tbody>
<tr><td>2023: 1st-gen Ryzen AI</td><td>up to 10 TOPS</td><td>CNN and audio models</td></tr>
<tr><td>2024: 2nd-gen</td><td>up to 16 TOPS</td><td>image generation, LLMs</td></tr>
<tr><td>3rd-gen</td><td>up to 50+ TOPS</td><td>multitasking and agentic AI</td></tr>
<tr><td>next-gen</td><td>(future)</td><td>multi-modal reasoning</td></tr>
</tbody></table></div>
<p>The 3rd-gen Ryzen AI chip combines an <b>RDNA 3.5 GPU</b> (up to 16 compute units), <b>Zen 5 CPU</b> (up to 12 cores, 24 threads) and an <b>XDNA 2 NPU</b> (50+ TOPS).</p>
<p>Why a dedicated NPU? Models keep growing and becoming part of the operating system, running <b>continuously</b> rather than on demand: LLMs and Stable Diffusion above 1B parameters, background models around 500M, real-time vision and audio around 20M. Efficiency decides:</p>
<div data-w="bars" data-o='{"title":"AI model performance per watt","hint":"Normalized to the CPU","unit":"×","labelWidth":120,"items":[["CPU",1,"m","1×"],["Integrated GPU",8,"v","~8×"],["NPU",35,"c","~35×"]]}'></div>`
    },
    {
      id: 'arch', title: 'NPU architecture: a spatial dataflow array',
      html: String.raw`
<p>Ryzen AI NPUs use a <b>spatial dataflow architecture</b>: a 2-D array of tiles with a flexible interconnect that keeps data local and can be <b>partitioned at runtime</b>. Different groups of AI Engine tiles can serve background processing (media or document indexing), human interaction (a chatbot LLM) and real-time frame-rate work (video-conference effects) at the same time, without interfering.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 300" width="720" height="300" role="img" aria-label="NPU array: rows of compute tiles above a row of memory tiles and a row of interface tiles to system memory; a compute tile has an AI Engine, data memory and stream switch">
  <g class="t-sm">
    <g class="f-cs s-c w1">
      <rect x="20" y="20" width="60" height="44" rx="4"/><rect x="90" y="20" width="60" height="44" rx="4"/><rect x="160" y="20" width="60" height="44" rx="4"/><rect x="230" y="20" width="60" height="44" rx="4"/>
      <rect x="20" y="72" width="60" height="44" rx="4"/><rect x="90" y="72" width="60" height="44" rx="4"/><rect x="160" y="72" width="60" height="44" rx="4"/><rect x="230" y="72" width="60" height="44" rx="4"/>
      <rect x="20" y="124" width="60" height="44" rx="4"/><rect x="90" y="124" width="60" height="44" rx="4"/><rect x="160" y="124" width="60" height="44" rx="4"/><rect x="230" y="124" width="60" height="44" rx="4"/>
      <rect x="20" y="176" width="60" height="44" rx="4"/><rect x="90" y="176" width="60" height="44" rx="4"/><rect x="160" y="176" width="60" height="44" rx="4"/><rect x="230" y="176" width="60" height="44" rx="4"/>
    </g>
    <g class="t-mut"><text x="50" y="46" text-anchor="middle">CT</text><text x="120" y="46" text-anchor="middle">CT</text><text x="190" y="46" text-anchor="middle">CT</text><text x="260" y="46" text-anchor="middle">CT</text></g>
    <g class="f-ms s-m w1"><rect x="20" y="230" width="60" height="26" rx="4"/><rect x="90" y="230" width="60" height="26" rx="4"/><rect x="160" y="230" width="60" height="26" rx="4"/><rect x="230" y="230" width="60" height="26" rx="4"/></g>
    <text x="50" y="247" text-anchor="middle">MT</text><text x="120" y="247" text-anchor="middle">MT</text><text x="190" y="247" text-anchor="middle">MT</text><text x="260" y="247" text-anchor="middle">MT</text>
    <g class="f-vs s-v w1"><rect x="20" y="262" width="60" height="26" rx="4"/><rect x="90" y="262" width="60" height="26" rx="4"/><rect x="160" y="262" width="60" height="26" rx="4"/><rect x="230" y="262" width="60" height="26" rx="4"/></g>
    <text x="50" y="279" text-anchor="middle">IT</text><text x="120" y="279" text-anchor="middle">IT</text><text x="190" y="279" text-anchor="middle">IT</text><text x="260" y="279" text-anchor="middle">IT</text>
    <text x="300" y="279" class="t-mut">→ system memory</text>

    <text x="530" y="18" text-anchor="middle" class="t-b">one compute tile</text>
    <rect x="390" y="28" width="300" height="200" rx="8" class="f-panel s-line w1"/>
    <rect x="405" y="44" width="150" height="120" rx="5" class="f-cs s-c w15"/><text x="480" y="64" text-anchor="middle" class="t-b">AI Engine</text><text x="480" y="80" text-anchor="middle" class="t-mut">VLIW + SIMD</text>
    <rect x="415" y="90" width="62" height="30" rx="3" class="f-panel s-line w1"/><text x="446" y="109" text-anchor="middle">scalar</text>
    <rect x="483" y="90" width="62" height="30" rx="3" class="f-panel s-line w1"/><text x="514" y="104" text-anchor="middle">vector</text><text x="514" y="116" text-anchor="middle" class="t-mut">fixed/float</text>
    <rect x="415" y="126" width="130" height="28" rx="3" class="f-panel s-line w1"/><text x="480" y="144" text-anchor="middle">program memory</text>
    <rect x="570" y="44" width="105" height="120" rx="5" class="f-ms s-m w15"/><text x="622" y="74" text-anchor="middle" class="t-b">data memory</text><text x="622" y="92" text-anchor="middle" class="t-mut">8 banks,</text><text x="622" y="106" text-anchor="middle" class="t-mut">arbiters,</text><text x="622" y="120" text-anchor="middle" class="t-mut">synchronizers</text>
    <rect x="405" y="176" width="270" height="38" rx="5" class="f-vs s-v w15"/><text x="540" y="200" text-anchor="middle" class="t-b">stream switch</text>
  </g>
  <path d="M290 42 C 340 42, 340 40, 388 40" class="f-none s-mut w1 dash"/>
</svg></div><figcaption>CT compute tiles, MT memory tiles, IT interface tiles. A compute tile can read and write its neighbours' data memories (N, S, E, W) and reach every tile through the array-wide stream switch.</figcaption></figure>
<div class="grid3">
  <div class="tile"><h4>Interface tiles</h4><p>Data movers between the array and external system memory.</p></div>
  <div class="tile"><h4>Memory tiles</h4><p>Buffer memory plus data movers, for optimized data movement.</p></div>
  <div class="tile"><h4>Compute tiles</h4><p>An <b>AI Engine</b> (VLIW, SIMD: scalar unit, vector unit with fixed- and floating-point parts, program memory) + data memory + stream switch.</p></div>
</div>
<h3>Dataflow graphs and spatial computing</h3>
<p>AI/ML algorithms map naturally to <b>dataflow graphs</b> of compute nodes and data buffers. Each node runs independently, driven by data streaming through it, and many nodes work in parallel for high throughput. <b>Spatial computing</b> means mapping such a graph (say n1 → n2, n3 → n4) onto the tiles of an NPU column; co-optimizing that mapping and the tile interconnect is critical.</p>
<div class="box exam" data-t="NPU summary"><ol><li>High-throughput, low-latency array</li><li>Optimized for ML</li><li>Enhanced data movement</li><li><b>No caches or interrupts</b></li><li>Modular and scalable design</li></ol></div>`
    },
    {
      id: 'sw', title: 'The Ryzen AI software flow',
      html: String.raw`
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="Ryzen AI stack: models to ONNX, quantization with Olive or Quark, ONNX Runtime execution providers, CPU iGPU NPU">
  <g class="t-sm">
    <rect x="10" y="20" width="140" height="60" rx="5" class="f-panel s-line w1"/><text x="80" y="44" text-anchor="middle" class="t-b">trained model</text><text x="80" y="62" text-anchor="middle" class="t-mut">PyTorch, TF, ONNX</text>
    <rect x="180" y="20" width="160" height="60" rx="5" class="f-vs s-v w1"/><text x="260" y="40" text-anchor="middle" class="t-b">convert, optimize,</text><text x="260" y="56" text-anchor="middle" class="t-b">quantize</text><text x="260" y="72" text-anchor="middle" class="t-mut">Olive, AMD Quark</text>
    <rect x="370" y="20" width="170" height="60" rx="5" class="f-cs s-c w1"/><text x="455" y="44" text-anchor="middle" class="t-b">ONNX Runtime</text><text x="455" y="62" text-anchor="middle" class="t-mut">execution providers</text>
    <rect x="570" y="10" width="140" height="24" rx="4" class="f-panel s-line w1"/><text x="640" y="27" text-anchor="middle">CPU EP → CPU</text>
    <rect x="570" y="38" width="140" height="24" rx="4" class="f-panel s-line w1"/><text x="640" y="55" text-anchor="middle">DirectML EP → iGPU</text>
    <rect x="570" y="66" width="140" height="24" rx="4" class="f-cs s-c w15"/><text x="640" y="83" text-anchor="middle">Vitis AI EP → NPU</text>
    <rect x="180" y="120" width="360" height="60" rx="5" class="f-ms s-m w1"/><text x="360" y="142" text-anchor="middle" class="t-b">IRON (Python) over MLIR-AIE</text><text x="360" y="160" text-anchor="middle" class="t-mut">close-to-metal programming for performance engineers (github.com/Xilinx/mlir-aie)</text>
  </g>
  <path d="M150 50h28M340 50h28M540 40 L 568 22 M540 50 L 568 50 M540 60 L 568 78" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<ul>
<li>The common path: <b>PyTorch → ONNX → quantized ONNX → ONNX Runtime → CPU, GPU or NPU</b>.</li>
<li>The ecosystem includes Hugging Face, PyTorch, Ollama, LM Studio, Amuse and llama.cpp, with 1000+ supported models (CNNs and transformers) in INT4, INT8, BF16 and block FP16, plus optimized LLMs (Llama, Mistral, Qwen) and text-to-image models (Stable Diffusion). Docs: ryzenai.docs.amd.com.</li>
</ul>`
    },
    {
      id: 'quant', title: 'Quantization with Quark and ONNX Runtime',
      html: String.raw`
<p>As DNNs grow, so does the cost of inference. Quantization turns an FP32 network into, for example, an INT8 network. The design choices are: <b>what</b> (weights, activations), <b>which datatype</b> (FP16, BFP16, INT8, INT4), <b>when</b> (quantization-aware training, QAT, or post-training quantization, PTQ) and <b>with which tool</b> (Olive, Quark).</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>ResNet50-v1-12</th><th>Size</th><th>Top-1</th><th>Top-5</th></tr></thead>
<tbody>
<tr><td>Float</td><td>97.82 MB</td><td>74.11%</td><td>91.71%</td></tr>
<tr><td>Quantized for NPU (U8S8, power-of-two scale)</td><td>24.48 MB</td><td>73.52%</td><td>91.29%</td></tr>
<tr><td>Quantized for CPU</td><td>24.96 MB</td><td>72.55%</td><td>90.95%</td></tr>
</tbody></table></div>
<div class="formula"><span class="fl">8-bit linear quantization (ONNX Runtime)</span><div class="fm">\[ x_q = \text{round}\!\left(\frac{x}{\text{scale}}\right) + \text{zero\_point} \]</div><span class="fn">scale: a positive float; zero_point: the integer that represents real zero (usually asymmetric). Outliers stretch the range; clipping them reduces the error for everything else.</span></div>
<div data-w="quant"></div>
<div class="grid2">
  <div class="tile"><h4>Static quantization</h4><p>Activations depend on the input, so they need <b>calibration</b>: run a representative dataset, record ranges (e.g. MinMax), and compute scale and zero point <b>offline</b>. Works for smaller models with less variation.</p></div>
  <div class="tile"><h4>Dynamic quantization</h4><p>Compute activation scale and zero point <b>at runtime</b>: higher accuracy, higher inference cost.</p></div>
</div>
<p>A quantized ONNX model can be <b>operator-oriented</b> (QOperator: QLinearConv, MatMulInteger, …) or <b>tensor-oriented</b> (QDQ: DequantizeLinear(QuantizeLinear(tensor)) pairs inserted between the original operators to simulate quantization).</p>
<pre><code><span class="tok-c"># AMD Quark configuration (from the lecture)</span>
config = QuantizationConfig(
    quant_format=QuantFormat.QDQ,
    calibrate_method=PowerOfTwoMethod.MinMSE,
    activation_type=QuantType.QInt8,
    weight_type=QuantType.QInt8,
    execution_providers=[<span class="tok-n">'CPUExecutionProvider'</span>],
    enable_npu_cnn=<span class="tok-k">True</span>,          <span class="tok-c"># also: enable_npu_transformer</span>
    convert_nchw_to_nhwc=<span class="tok-k">True</span>,
    include_cle=<span class="tok-k">True</span>)             <span class="tok-c"># plus nodes_to_quantize/exclude, extra_options</span></code></pre>
<h3>ONNX Runtime and the Vitis AI execution provider</h3>
<p><b>ONNX Runtime</b> is Microsoft's inference engine for ONNX (Open Neural Network Exchange) models: interoperable and hardware-flexible. It applies graph optimizations, then <b>partitions the graph into subgraphs</b> for the available accelerators through <b>execution providers (EPs)</b>. With the <b>Vitis AI EP</b>, NPU-supported subgraphs run on the NPU and the rest on the CPU: in the lecture's example, 398 of 400 nodes (Add, Conv, Gemm, MaxPool, Relu, GlobalAveragePool, Flatten, Quantize/DequantizeLinear) go to the NPU and 2 stay on the CPU. Its integrated compiler turns the graph and weights into a micro-coded executable.</p>
<pre><code><span class="tok-k">import</span> onnxruntime
session = onnxruntime.InferenceSession(
    <span class="tok-n">"model.onnx"</span>,
    providers=[<span class="tok-n">"VitisAIExecutionProvider"</span>],
    provider_options=[{<span class="tok-n">"config_file"</span>: <span class="tok-n">"vaip_config.json"</span>}])  <span class="tok-c"># mandatory runtime config</span></code></pre>
<p>The NPU binary is selected through the <code>XLNX_VART_FIRMWARE</code> environment variable; C++ and Python APIs are available.</p>`
    },
    {
      id: 'simd', title: 'CPU vector extensions: AVX-512 and VNNI',
      html: String.raw`
<p>DNN layers depend on each other, but each layer has plenty of internal parallelism, and its core is the MAC a = a + b·c over weights and input activations. The first way to exploit that is <b>SIMD</b>: one vector instruction does N operations (<code>add r3, r1, r2</code> vs <code>vadd.vv v3, v1, v2</code>), backed by a vector register file, vector ALUs and a vector instruction set.</p>
<div class="grid2">
  <div class="tile"><h4>AVX-512 (Intel/AMD)</h4><ul><li>32 vector registers ZMM0–ZMM31, separate from the x86-64 general registers, <b>512 bits</b> each.</li><li>Split into 64-, 32- or 16-bit integers, 16 floats or 8 doubles.</li><li>Arithmetic, load/store, scatter/gather, and <b>FMA</b> A = A + B·C with one rounding.</li><li>Used via libraries or intrinsics with compiler flags.</li></ul></div>
  <div class="tile"><h4>VNNI (Vector Neural Network Instructions)</h4><ul><li>Multiply 8-bit (or 16-bit) integers and accumulate into 32-bit, in one instruction: <b>VPDPBUSD</b>, which issues on ports 0 and 5 in one cycle, a <b>4× throughput gain</b>.</li><li>Lower bit width cuts memory bandwidth and footprint and raises throughput per watt.</li><li>Fits quantized models.</li></ul></div>
</div>
<div class="formula"><span class="fl">Tensor-wide scale for 8-bit values</span><div class="fm">\[ v \approx a \cdot i, \qquad a = \frac{\max |v|}{128} \]</div><span class="fn">i is an 8-bit integer, a one scale factor per tensor {v}.</span></div>
<div class="grid2">
  <div class="box insight" data-t="Pros"><p>Part of the CPU core (no new accelerator), usable by compilers, and often good enough for <b>inference</b>.</p></div>
  <div class="box exam" data-t="Cons"><p>Limited data-level parallelism: not enough for <b>training</b>.</p></div>
</div>`
    },
    {
      id: 'gpu', title: 'GPUs and CUDA',
      html: String.raw`
<p>GPUs are the main answer to data-level parallelism: pixels are processed in parallel (SIMD), with memory coalescing and fast hardware context switching. NVIDIA's CUDA (about 2007) was one of the first languages for general GPU compute. The thread count keeps rising, so the programming model must scale:</p>
<div data-w="bars" data-o='{"title":"NVIDIA GPU threads (cores) by generation","labelWidth":150,"items":[["Kepler (2012)",1536,"c"],["Maxwell (2014)",2048,"c"],["Pascal (2016)",3584,"c"],["Turing (2018)",4608,"c"],["Ampere (2020)",6912,"c"]]}'></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 230" width="720" height="230" role="img" aria-label="CUDA hierarchy: thread, warp of 32 on a SIMD core, thread block on an SM, grid across SMs; L1 and scratchpad per SM, shared L2, HBM">
  <g class="t-sm">
    <circle cx="40" cy="70" r="10" class="f-c"/><text x="40" y="110" text-anchor="middle" class="t-b">thread</text>
    <rect x="90" y="50" width="120" height="40" rx="4" class="f-cs s-c w1"/>
    <g class="f-c"><circle cx="104" cy="70" r="4"/><circle cx="118" cy="70" r="4"/><circle cx="132" cy="70" r="4"/><circle cx="146" cy="70" r="4"/><circle cx="160" cy="70" r="4"/><circle cx="174" cy="70" r="4"/><circle cx="188" cy="70" r="4"/></g>
    <text x="150" y="110" text-anchor="middle" class="t-b">warp</text><text x="150" y="126" text-anchor="middle" class="t-mut">32 threads, SIMD core</text>
    <rect x="250" y="30" width="170" height="90" rx="6" class="f-panel s-line w1"/><text x="335" y="50" text-anchor="middle" class="t-b">thread block</text>
    <g class="f-cs s-c w1"><rect x="262" y="60" width="44" height="20" rx="3"/><rect x="312" y="60" width="44" height="20" rx="3"/><rect x="362" y="60" width="44" height="20" rx="3"/></g>
    <rect x="262" y="88" width="70" height="22" rx="3" class="f-ms s-m w1"/><text x="297" y="103" text-anchor="middle">scratchpad</text><rect x="338" y="88" width="68" height="22" rx="3" class="f-ms s-m w1"/><text x="372" y="103" text-anchor="middle">L1$</text>
    <text x="335" y="140" text-anchor="middle" class="t-mut">~1000 threads on one SM</text>
    <rect x="460" y="20" width="250" height="140" rx="8" class="f-none s-v w15"/><text x="585" y="40" text-anchor="middle" class="t-b">grid (~100,000 threads)</text>
    <g class="f-panel s-line w1"><rect x="475" y="52" width="50" height="40" rx="4"/><rect x="535" y="52" width="50" height="40" rx="4"/><rect x="595" y="52" width="50" height="40" rx="4"/><rect x="655" y="52" width="45" height="40" rx="4"/></g>
    <text x="500" y="76" text-anchor="middle">SM</text><text x="560" y="76" text-anchor="middle">SM</text><text x="620" y="76" text-anchor="middle">SM</text><text x="677" y="76" text-anchor="middle">SM</text>
    <rect x="475" y="102" width="225" height="22" rx="3" class="f-ms s-m w1"/><text x="587" y="117" text-anchor="middle">shared L2$</text>
    <rect x="475" y="130" width="225" height="22" rx="3" class="f-ms s-m w15"/><text x="587" y="145" text-anchor="middle" class="t-b">HBM</text>
    <text x="360" y="210" text-anchor="middle" class="t-mut">streaming multiprocessors (SMs) contain SIMD units, a register file, L1$ and a scratchpad</text>
  </g>
  <path d="M52 70h36M210 70h38M420 75h38" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<p>A CUDA program is <b>single program, multiple data</b>. The host allocates device memory (<code>cudaMalloc</code>), copies inputs (<code>cudaMemcpy</code> host → device), launches the kernel over a grid of blocks, copies results back and synchronizes. Each thread computes one output element:</p>
<pre><code><span class="tok-k">__global__ void</span> <span class="tok-f">gpu_matrix_mult</span>(<span class="tok-k">int</span> *a, <span class="tok-k">int</span> *b, <span class="tok-k">int</span> *c, <span class="tok-k">int</span> m, <span class="tok-k">int</span> n, <span class="tok-k">int</span> k) {
  <span class="tok-k">int</span> row = blockIdx.y * blockDim.y + threadIdx.y;
  <span class="tok-k">int</span> col = blockIdx.x * blockDim.x + threadIdx.x;
  <span class="tok-k">int</span> sum = <span class="tok-n">0</span>;
  <span class="tok-k">if</span> (col &lt; k &amp;&amp; row &lt; m) {
    <span class="tok-k">for</span> (<span class="tok-k">int</span> i = <span class="tok-n">0</span>; i &lt; n; i++)
      sum += a[row * n + i] * b[i * k + col];
    c[row * k + col] = sum;
  }
}
<span class="tok-c">// host: matrix_mul&lt;&lt;&lt;dimGrid, dimBlock&gt;&gt;&gt;(d_a, d_b, d_c, m, n, k);</span></code></pre>
<p>Frameworks (TensorFlow, Caffe2, PyTorch) sit on libraries (cuBLAS, cuDNN, cuSOLVER) that sit on the GPU.</p>
<div class="box exam" data-t="GPU performance pitfalls"><ul><li><b>Control-flow divergence</b> (if/else inside a warp) kills performance.</li><li><b>Memory-access divergence</b>: uncoalesced accesses.</li><li><b>Limited memory capacity</b>: about 80 GB at most, and expensive.</li><li>Keeping the GPU fully utilized is hard; it is often <b>memory-bandwidth bound</b>.</li></ul></div>`
    },
    {
      id: 'tc', title: 'Tensor cores',
      html: String.raw`
<p>Tensor cores specialize the GPU for DNNs: a <b>matrix-multiply accelerator inside each SM</b>, with mixed precision, <b>warp-synchronous</b> operation and a single instruction to invoke it.</p>
<div class="formula"><span class="fl">Tensor core operation</span><div class="fm">\[ D = A \cdot B + C \qquad (A, B \text{ in FP16};\; C, D \text{ in FP16 or FP32, FP32 accumulation}) \]</div></div>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Generation</th><th>Tensor cores per SM</th><th>FP16/FP32 FMA per tensor core per cycle</th></tr></thead>
<tbody>
<tr><td>Volta (~2017/18)</td><td>8</td><td>64</td></tr>
<tr><td>Ampere (2020)</td><td>4</td><td>256</td></tr>
</tbody></table></div>
<p>The warp's threads share the work of an M × N × K matmul. <code>wmma</code>/<code>mma</code> instructions take a shape and data type (e.g. m8n4k4 with f32 or f64), and only the shapes and types the ISA allows can be used.</p>
<div data-w="bars" data-o='{"title":"A100 tensor-core speed-up over FP32 CUDA cores","hint":"PTX mma.sync, by data type (shape)","unit":"×","labelWidth":200,"items":[["F64 (m8n8k4)",2,"m","2×"],["TF32 (m16n8k8)",8,"v","8×"],["F16 / BF16 (m16n8k16)",16,"c","16×"],["S8 (m16n8k32)",32,"c","32×"],["S4 (m16n8k64)",64,"c","64×"],["B1 (m16n8k256)",256,"c","256×"]],"note":"Lower precision packs more operations into each instruction, which is why quantization pays off on GPUs too."}'></div>`
    }
  ],
  takeaways: [
    'Ryzen AI NPUs went from 10 to 16 to 50+ TOPS; performance per watt is ~35× the CPU (iGPU ~8×), which matters for always-on models.',
    'The NPU is a spatial dataflow array: compute tiles (AI Engine VLIW/SIMD + data memory + stream switch), memory tiles and interface tiles; no caches or interrupts; runtime partitioning.',
    'Software path: PyTorch → ONNX → quantize (Olive/Quark) → ONNX Runtime, whose Vitis AI EP sends supported subgraphs to the NPU.',
    'Linear quantization x_q = round(x/scale) + zero_point; static (calibrated offline) vs dynamic (runtime); QOperator vs QDQ formats. ResNet-50 shrinks 97.82 → 24.48 MB losing ~0.6% top-1.',
    'AVX-512 has 32 × 512-bit registers and FMA; VNNI\'s VPDPBUSD does 8-bit multiply with 32-bit accumulate for 4× throughput; good for inference, not training.',
    'CUDA: thread → warp (32) → block (~1000, one SM) → grid (~100k). Pitfalls: divergence, uncoalesced access, limited memory, bandwidth limits.',
    'Tensor cores compute D = A·B + C per warp; Volta 8/SM × 64 FMA, Ampere 4/SM × 256; A100 speed-ups 16× (FP16) to 256× (1-bit).'
  ],
  numbers: [
    ['Ryzen AI NPU TOPS', '10 → 16 → 50+', '2023 → 2024 → 3rd gen'],
    ['Perf/W: CPU, iGPU, NPU', '1×, ~8×, ~35×', ''],
    ['3rd-gen Ryzen AI', 'Zen 5 (12 cores), RDNA 3.5 (16 CUs), XDNA 2', ''],
    ['ResNet50 quantized for NPU', '24.48 MB, 73.52% top-1', 'float: 97.82 MB, 74.11%'],
    ['Vitis AI EP example', '398 of 400 nodes on NPU', '2 on CPU'],
    ['AVX-512', '32 × 512-bit ZMM registers', '16 floats or 8 doubles each'],
    ['VNNI VPDPBUSD', '4× throughput', '8-bit mult, 32-bit accumulate'],
    ['Ampere threads', '6912', 'Kepler 1536'],
    ['Tensor cores', 'Volta 8/SM × 64 FMA; Ampere 4/SM × 256 FMA', ''],
    ['A100 tensor-core speed-up', 'FP16 16×, INT8 32×, INT4 64×, 1-bit 256×', 'vs FP32 CUDA cores']
  ],
  quiz: [
    { q: 'Approximate AI performance per watt of an NPU relative to the CPU, per the lecture?', o: ['2×', '8×', '35×', '1000×'], a: 2, why: 'CPU 1×, iGPU ~8×, NPU ~35×.' },
    { q: 'Which NPU tile type contains the AI Engine?', o: ['Interface tile', 'Memory tile', 'Compute tile', 'Stream tile'], a: 2, why: 'Compute tile = AI Engine + data memory + stream switch.' },
    { q: 'Which is NOT part of the NPU summary?', o: ['No caches or interrupts', 'Modular and scalable', 'Large shared L3 cache', 'Enhanced data movement'], a: 2, why: 'The NPU explicitly has no caches.' },
    { q: 'In ONNX Runtime, what sends subgraphs to the NPU?', o: ['DirectML EP', 'CPU EP', 'Vitis AI EP', 'Olive'], a: 2, why: 'Unsupported nodes fall back to the CPU.' },
    { q: 'Static quantization computes activation scale and zero point…', o: ['at runtime', 'offline from calibration data', 'never', 'during training only'], a: 1, why: 'Dynamic quantization computes them at runtime instead.' },
    { q: 'QDQ format means…', o: ['Quantized operators like QLinearConv', 'Quantize/Dequantize pairs inserted around original operators', 'Dynamic quantization', 'Quark Default Quantizer'], a: 1, why: 'It is the tensor-oriented representation.' },
    { q: 'How many 32-bit floats fit in one AVX-512 register?', num: 16, tol: 0, why: '512 / 32 = 16.' },
    { q: 'What does VNNI\'s VPDPBUSD do?', o: ['FP64 FMA', '8-bit multiply with 32-bit accumulate', 'Gather', 'Matrix transpose'], a: 1, why: 'One instruction, about 4× throughput for quantized inference.' },
    { q: 'How many threads form a warp?', num: 32, tol: 0, why: 'Warps execute in SIMD fashion on a SIMD core.' },
    { q: 'Which is a GPU performance pitfall?', o: ['Coalesced memory access', 'Control-flow divergence within a warp', 'Large thread blocks', 'Using cuDNN'], a: 1, why: 'Diverging threads serialize the if and else paths.' },
    { q: 'A100 tensor-core speed-up for INT8 (S8) over FP32 CUDA cores?', num: 32, tol: 0, why: 'F16 16×, TF32 8×, S8 32×, S4 64×, B1 256×.' }
  ],
  cards: [
    { f: 'Why NPU', b: 'Always-on AI in the OS; NPU ~35× perf/W vs CPU (iGPU ~8×).' },
    { f: 'NPU tiles', b: 'Compute (AIE + data memory + stream switch), memory (buffers + movers), interface (to system memory).' },
    { f: 'AI Engine', b: 'VLIW + SIMD: scalar unit, vector unit (fixed/float), program memory; reads neighbours\' data memories.' },
    { f: 'Spatial computing', b: 'Map dataflow graphs onto tiles; nodes fire as data streams in; co-optimize mapping and interconnect.' },
    { f: 'Ryzen AI SW flow', b: 'PyTorch → ONNX → Quark/Olive quantization → ONNX Runtime → CPU/DirectML/Vitis AI EPs.' },
    { f: 'Linear quantization', b: 'x_q = round(x/scale) + zero_point; calibration (MinMax, MinMSE); static vs dynamic.' },
    { f: 'AVX-512 / VNNI', b: '32 × 512-bit ZMM registers, FMA; VPDPBUSD 8-bit × 8-bit → 32-bit accumulate, 4× throughput.' },
    { f: 'CUDA hierarchy', b: 'Thread → warp (32) → block (~1000, one SM) → grid (~100k, many SMs).' },
    { f: 'GPU pitfalls', b: 'Control divergence, uncoalesced memory, limited capacity (~80 GB), memory-bandwidth bound.' },
    { f: 'Tensor cores', b: 'D = A·B + C, warp-synchronous, mixed precision. A100: FP16 16×, INT8 32×, 1-bit 256× vs FP32 cores.' }
  ]
});
