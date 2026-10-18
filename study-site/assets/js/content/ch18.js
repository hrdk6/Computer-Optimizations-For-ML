CSO.register({
  id: 'ch18', num: 18, part: 'VII', kind: 'memory', span: 3, cover: 'memory',
  coverAlt: 'A GPU memory stack with feature maps being freed and recomputed as training proceeds.',
  title: 'Training with limited GPU memory, and the course in one page', short: 'Limited GPU memory + recap',
  lectures: [59, 60],
  summary: 'GPU compute grows far faster than GPU memory, so big models run out of memory. Gradient checkpointing (and Checkmate\'s optimal version), memory-saving operator choices and Gist\'s encodings, gradient accumulation, and MONeT\'s joint optimization. The chapter closes with the whole course on one page.',
  sections: [
    {
      id: 'problem', title: 'The GPU memory problem',
      html: String.raw`
<div class="grid2">
<div data-w="bars" data-o='{"title":"NVIDIA GPU growth since 2015","unit":"×","labelWidth":130,"barWidth":220,"items":[["Compute (TFLOPs)",32,"c","32×"],["Memory capacity",2.5,"m","2.5× (max 80 GB)"]]}'></div>
<div class="box exam" data-t="Why it matters"><p>Training jobs are often limited by GPU memory. In Microsoft's cloud, <b>8.8% of deep-learning job failures</b> were GPU out-of-memory errors, the single most common cause of failure.</p></div>
</div>
<p>Where does training memory go? Gist (ISCA 2018) broke it down for AlexNet, NiN, Overfeat, VGG-16 and Inception into weights, weight gradients, workspace, immediately consumed data and <b>stashed feature maps</b>: the forward outputs kept around for the backward pass. <b>Stashed feature maps dominate.</b></p>`
    },
    {
      id: 'ckpt', title: 'Gradient checkpointing (rematerialization)',
      html: String.raw`
<p>Idea: do not keep every forward output. Keep some (the checkpoints), free the rest, and <b>recompute</b> them during backpropagation. Less memory, more compute.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 210" width="720" height="210" role="img" aria-label="Three strategies: keep all fmaps, recompute all, or checkpoint some">
  <g class="t-sm">
    <text x="10" y="34" class="t-b">keep all</text>
    <g class="f-ms s-m w1"><rect x="150" y="18" width="50" height="26" rx="3"/><rect x="210" y="18" width="50" height="26" rx="3"/><rect x="270" y="18" width="50" height="26" rx="3"/><rect x="330" y="18" width="50" height="26" rx="3"/><rect x="390" y="18" width="50" height="26" rx="3"/><rect x="450" y="18" width="50" height="26" rx="3"/></g>
    <text x="520" y="30" class="t-m">highest memory</text><text x="520" y="44" class="t-mut">lowest compute</text>
    <text x="10" y="104" class="t-b">recompute all</text>
    <rect x="150" y="88" width="50" height="26" rx="3" class="f-ms s-m w1"/>
    <g class="f-panel s-line w1 dash"><rect x="210" y="88" width="50" height="26" rx="3"/><rect x="270" y="88" width="50" height="26" rx="3"/><rect x="330" y="88" width="50" height="26" rx="3"/><rect x="390" y="88" width="50" height="26" rx="3"/><rect x="450" y="88" width="50" height="26" rx="3"/></g>
    <text x="520" y="100" class="t-c">lowest memory</text><text x="520" y="114" class="t-mut">highest compute (re-run the chain)</text>
    <text x="10" y="174" class="t-b">checkpoint some</text>
    <g class="f-ms s-m w1"><rect x="150" y="158" width="50" height="26" rx="3"/><rect x="330" y="158" width="50" height="26" rx="3"/></g>
    <g class="f-panel s-line w1 dash"><rect x="210" y="158" width="50" height="26" rx="3"/><rect x="270" y="158" width="50" height="26" rx="3"/><rect x="390" y="158" width="50" height="26" rx="3"/><rect x="450" y="158" width="50" height="26" rx="3"/></g>
    <text x="520" y="170" class="t-v">balanced: which ones?</text><text x="520" y="184" class="t-mut">recompute from nearest checkpoint</text>
    <text x="325" y="206" text-anchor="middle" class="t-mut">copper = feature map kept in memory, dashed = freed and recomputed in backward</text>
  </g>
</svg></div></figure>
<p>Choosing well is not trivial: layers differ in compute cost and memory footprint, and <b>skip connections</b> decide how early a feature map can be freed and where it is needed again in the backward pass.</p>
<h3>Checkmate: optimal rematerialization</h3>
<p>Checkmate (Jain et al., MLSys 2020, "Breaking the memory wall with optimal tensor rematerialization") profiles each layer's memory and compute cost and solves a <b>mixed integer linear program</b>:</p>
<div class="formula"><span class="fl">Checkmate MILP (simplified)</span><div class="fm">\[ \min_{R, S}\; \sum_{t}\sum_{i} C_i\, R_{t,i} \quad \text{s.t.} \quad R_{t,i} \le R_{t,i-1} + S_{t,i} \;(\text{correctness}), \qquad U_{t,k} \le \text{budget} \;(\text{memory}) \]</div><span class="fn">R_{t,i} = 1 if layer i is (re)computed at stage t; S_{t,i} = 1 if its output is stored; U = memory in use; C_i = cost of layer i. The objective is the total forward + backward compute.</span></div>
<p>On U-Net (batch 32) and MobileNet (batch 512), Checkmate's compute overhead is lower than the best heuristic at the same memory, for about a <b>1.2× speed-up</b>.</p>`
    },
    {
      id: 'ops', title: 'Memory-aware operators and Gist\'s encodings',
      html: String.raw`
<p>Each operator needs memory for its input, workspace, weights and output. Two levers:</p>
<ul>
<li><b>Choose the implementation</b>: a convolution can use Winograd, FFT or GEMM, which trade memory against compute.</li>
<li><b>Compress feature maps</b> and decompress them in the backward pass. ReLU makes fmaps sparse, so lossless encoding works, and decoding is cheaper than recomputing.</li>
</ul>
<div class="grid2">
  <div class="tile"><h4>Gist: ReLU needs 1 bit</h4><p>ReLU's backward pass is dX = dY where Y &gt; 0, else 0. Only the <b>sign</b> of Y is needed, so its stashed output can be stored in <b>1 bit instead of 32</b>.</p></div>
  <div class="tile"><h4>Gist: ReLU followed by MaxPool</h4><p>The backward pass can be computed from a small <b>Y-to-X map</b> (which input won each pooling window) without keeping the ReLU output at all.</p></div>
</div>
<h3>Gradient accumulation</h3>
<p>Split a batch into n mini-batches: feature-map memory falls by n. Run forward and backward on each mini-batch <b>without updating the weights</b>, add up the gradients, and update once after the n-th step.</p>
<div class="formula"><span class="fl">Gradient accumulation</span><div class="fm">\[ g = \sum_{j=1}^{n} \nabla_W\, L(\text{mini-batch}_j), \qquad W \leftarrow W - \eta\, g \;\;\text{after } n \text{ steps} \]</div></div>`
    },
    {
      id: 'monet', title: 'MONeT: which optimization where?',
      html: String.raw`
<p>MONeT (Shah et al., ICLR, "Memory Optimization for Deep Networks") is an automatic framework that minimizes memory without a large compute overhead. It <b>combines</b> checkpointing and recomputation (as in Checkmate), memory-efficient operator choices (as in Gist) and the computation overhead, in one <b>boolean integer linear program</b> that minimizes execution time under a memory budget. Per operator it decides: store or recompute, and which implementation (FFT or GEMM; input-, output- or intermediate-activated; in-place or not).</p>
<p>Results: lower overhead than PyTorch checkpointing and Checkmate variants across ResNet-50, GoogLeNet, U-Net, VGG-16 and MobileNet-V2, for memory ratios from 0.4 to 1.</p>
<div class="box insight" data-t="Further reading"><p>Batch size and learning rate are usually user-provided, but the real goal is good accuracy, fast training and low memory. Pollux (Qiao et al., OSDI 2021) picks the batch size as a function of the hardware: co-adaptive cluster scheduling for goodput-optimized deep learning.</p></div>`
    },
    {
      id: 'recap', title: 'The whole course on one page',
      html: String.raw`
<p><b>What changed?</b> Large datasets and new applications (autonomous driving) demand new techniques; more sophisticated models (LR &lt; RT/DT &lt; DNN &lt; CNN &lt; GNN &lt; LSTM &lt; Transformer) need more compute; faster hardware (CPU &lt; GPU &lt; TPU &lt; accelerators) makes once-intractable problems feasible. <b>It is a cycle.</b></p>
<div class="grid3">
  <a class="tile" href="#ch01"><h4>01–04 Foundations</h4><p>Perceptron, memory wall, convolution, GEMM and Toeplitz, tiling, tensor cores, TPU, canonical CNNs, separable convolutions.</p></a>
  <a class="tile" href="#ch05"><h4>05–07 CNN hardware</h4><p>Reuse types, systolic arrays, OS/WS/IS, DianNao family, Eyeriss row stationary and RLC, Eyeriss v2, pruning and the staircase.</p></a>
  <a class="tile" href="#ch08"><h4>08 Training at scale</h4><p>Data, model, pipeline and tensor parallelism, ring all-reduce, GPipe and PipeDream, FlexFlow, ColocRL, Alpa.</p></a>
  <a class="tile" href="#ch09"><h4>09–11 LLM systems</h4><p>Transformers, Linformer, FlashAttention, speculative decoding and sampling, KV cache, PagedAttention, Orca, Sarathi-Serve, DistServe.</p></a>
  <a class="tile" href="#ch12"><h4>12 Reliability</h4><p>CheckFreq's pipelined checkpoints and resumable iterator; Check-N-Run's differential and quantized checkpoints.</p></a>
  <a class="tile" href="#ch13"><h4>13–15 Graphs and emerging hardware</h4><p>GNNs and HyGCN, ReRAM crossbars, ISAAC, PipeLayer, AtomLayer, IMC NoCs, COIN, CANNON, ReTransformer, SIAM, HALO.</p></a>
  <a class="tile" href="#ch16"><h4>16–18 Measurement and real hardware</h4><p>Fathom and other characterizations, AMD NPUs and quantization, AVX-512/VNNI, GPUs and tensor cores, memory-limited training.</p></a>
</div>
<div class="box exam" data-t="Key takeaways from the final lecture"><ul><li>ML/AI algorithms can do wonders, but they are <b>extremely compute- and memory-intensive</b>.</li><li>Running them at all needs rigorous optimization of the computer system and software (on CPUs and GPUs and beyond).</li><li>System optimization for ML is extremely relevant: high-performance computers shape the future of AI, and without system optimization AI algorithm development would take a major hit.</li></ul></div>
<div class="box insight" data-t="How to start systems research for ML"><ul><li>Don't be satisfied with high accuracy: think about the <b>compute and memory penalty</b>.</li><li>Don't hesitate to get your hands dirty: dig into the architecture, the compiler, the OS.</li></ul></div>
<p class="muted">The course was taught by Prof. Sumit K. Mandal (IISc), who thanked Prof. Murali Annavaram (USC), Dr. Jayashree Mohan (Microsoft Research), Prof. Arkaprava Basu and Prof. Govindarajan Ramaswamy (IISc), the teaching assistants Kaushik and Utkarsh, and the IISc team.</p>`
    }
  ],
  takeaways: [
    'Since 2015, GPU TFLOPs grew 32× but memory only 2.5× (max 80 GB); OOM is the top cause (8.8%) of DL job failures at Microsoft.',
    'Stashed feature maps for the backward pass dominate training memory (Gist).',
    'Gradient checkpointing frees fmaps and recomputes them; Checkmate picks what to store with an MILP (≈1.2× faster than heuristics at equal memory).',
    'Operator choice (Winograd/FFT/GEMM) and fmap compression save memory; Gist stores ReLU outputs in 1 bit and uses a Y-to-X map for ReLU + MaxPool.',
    'Gradient accumulation splits a batch into n mini-batches and updates once, cutting fmap memory by n.',
    'MONeT jointly decides checkpointing and operator implementations in one ILP under a memory budget.',
    'Course message: ML is compute- and memory-hungry; system optimization across hardware, compilers and OS makes it possible.'
  ],
  numbers: [
    ['GPU compute vs memory growth since 2015', '32× vs 2.5×', 'max 80 GB'],
    ['DL job failures from GPU OOM (Microsoft)', '8.8%', 'most common cause'],
    ['Checkmate speed-up', '~1.2×', 'vs best heuristic, same memory'],
    ['Gist ReLU encoding', '1 bit instead of 32', 'sign is enough'],
    ['Gradient accumulation', 'fmap memory ÷ n', 'n mini-batches per update']
  ],
  quiz: [
    { q: 'What dominates GPU memory during training, according to Gist?', o: ['Weights', 'Stashed feature maps for the backward pass', 'Optimizer code', 'Input images'], a: 1, why: 'Forward outputs kept for gradient computation dominate.' },
    { q: 'Gradient checkpointing trades…', o: ['accuracy for memory', 'extra compute for less memory', 'memory for less compute', 'bandwidth for latency'], a: 1, why: 'Freed fmaps are recomputed in the backward pass.' },
    { q: 'What does Checkmate solve to choose checkpoints?', o: ['A dynamic program', 'A mixed integer linear program', 'A greedy heuristic', 'Reinforcement learning'], a: 1, why: 'Decision variables R (recompute), S (store), U (memory) with a budget.' },
    { q: 'How many bits does Gist need to store a ReLU output for backprop?', num: 1, tol: 0, why: 'Only whether Y > 0 matters for dX.' },
    { q: 'Splitting a batch into 4 mini-batches with gradient accumulation reduces feature-map memory by…', num: 4, tol: 0, why: 'Only one mini-batch\'s fmaps are live at a time; weights update after the 4th.' },
    { q: 'MONeT differs from Checkmate because it also…', o: ['uses RL', 'chooses memory-efficient operator implementations', 'prunes weights', 'uses CPUs'], a: 1, why: 'It jointly optimizes checkpointing and operator choice (Gist-style).' },
    { q: 'Since 2015, how much did NVIDIA GPU memory capacity grow per the lecture?', o: ['32×', '2.5×', '10×', '100×'], a: 1, why: 'Compute grew 32× over the same period.' }
  ],
  cards: [
    { f: 'GPU memory wall', b: 'TFLOPs ×32 vs memory ×2.5 since 2015; OOM = 8.8% of DL job failures (most common).' },
    { f: 'Gradient checkpointing', b: 'Keep some fmaps, free the rest, recompute in backward. Memory ↓, compute ↑.' },
    { f: 'Checkmate', b: 'MILP over store/recompute decisions minimizing compute under a memory budget; ~1.2× vs heuristics.' },
    { f: 'Gist', b: 'Encode stashed fmaps: ReLU output → 1 bit; ReLU + MaxPool → Y-to-X map; lossless sparse encodings.' },
    { f: 'Gradient accumulation', b: 'n mini-batches, add gradients, update once: fmap memory ÷ n.' },
    { f: 'MONeT', b: 'Joint ILP: checkpointing + operator implementation choice under a memory budget.' },
    { f: 'Systems research advice', b: 'Look beyond accuracy at compute/memory cost; dig into architecture, compiler and OS.' }
  ]
});
