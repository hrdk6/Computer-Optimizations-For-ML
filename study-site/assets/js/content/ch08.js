CSO.register({
  id: 'ch08', num: 8, part: 'III', kind: 'comm', span: 5, cover: 'ring',
  coverAlt: 'A ring of GPUs passing glowing gradient chunks to their neighbours.',
  title: 'Distributed training: data, model, pipeline and tensor parallelism', short: 'Distributed training',
  lectures: [19, 20, 21, 22, 23],
  summary: 'How training is spread across many GPUs. Data parallelism with ring all-reduce, its batch-size and communication limits, model and pipeline parallelism (GPipe, PipeDream), tensor parallelism, and automatic parallelization: FlexFlow\'s SOAP search, ColocRL\'s reinforcement learning, and Alpa\'s dynamic-programming plus ILP compiler.',
  sections: [
    {
      id: 'overview', title: 'Four ways to split training',
      html: String.raw`
<p>Recap: training starts from random weights, runs a forward pass, compares with the label, and runs a backward pass. One sweep over the dataset is an epoch; with mini-batches, the weight updates ΔW are averaged over the batch before updating. GPUs, with thousands of tiny cores, do this fast, but one GPU is not enough for big models or big datasets.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 210" width="720" height="210" role="img" aria-label="Data, model, pipeline and tensor parallelism">
  <g class="t-sm">
    <g transform="translate(0,0)">
      <text x="85" y="18" text-anchor="middle" class="t-b">Data parallel</text>
      <g class="f-cs s-c w1"><rect x="20" y="34" width="60" height="70" rx="4"/><rect x="92" y="34" width="60" height="70" rx="4"/></g>
      <text x="50" y="74" text-anchor="middle">model</text><text x="122" y="74" text-anchor="middle">model</text>
      <g class="f-ms s-m w1"><rect x="20" y="120" width="60" height="24" rx="3"/><rect x="92" y="120" width="60" height="24" rx="3"/></g>
      <text x="50" y="136" text-anchor="middle">data ½</text><text x="122" y="136" text-anchor="middle">data ½</text>
      <text x="85" y="170" text-anchor="middle" class="t-mut">replicate model,</text><text x="85" y="186" text-anchor="middle" class="t-mut">shard inputs</text>
    </g>
    <g transform="translate(180,0)">
      <text x="85" y="18" text-anchor="middle" class="t-b">Model parallel</text>
      <g class="f-cs s-c w1"><rect x="20" y="34" width="60" height="34" rx="4"/><rect x="92" y="70" width="60" height="34" rx="4"/></g>
      <text x="50" y="56" text-anchor="middle">layers 1–2</text><text x="122" y="92" text-anchor="middle">layers 3–4</text>
      <rect x="20" y="120" width="132" height="24" rx="3" class="f-ms s-m w1"/><text x="86" y="136" text-anchor="middle">same data</text>
      <text x="85" y="170" text-anchor="middle" class="t-mut">split layers,</text><text x="85" y="186" text-anchor="middle" class="t-mut">one GPU busy at a time</text>
    </g>
    <g transform="translate(360,0)">
      <text x="85" y="18" text-anchor="middle" class="t-b">Pipeline parallel</text>
      <g class="f-cs s-c w1"><rect x="20" y="34" width="60" height="34" rx="4"/><rect x="92" y="70" width="60" height="34" rx="4"/></g>
      <g class="f-ms s-m w1"><rect x="20" y="120" width="28" height="24" rx="3"/><rect x="52" y="120" width="28" height="24" rx="3"/><rect x="84" y="120" width="28" height="24" rx="3"/><rect x="116" y="120" width="28" height="24" rx="3"/></g>
      <text x="85" y="170" text-anchor="middle" class="t-mut">split layers, stream</text><text x="85" y="186" text-anchor="middle" class="t-mut">micro-batches</text>
    </g>
    <g transform="translate(540,0)">
      <text x="85" y="18" text-anchor="middle" class="t-b">Tensor parallel</text>
      <rect x="20" y="34" width="132" height="70" rx="4" class="f-none s-c w1"/>
      <rect x="20" y="34" width="66" height="70" rx="4" class="f-cs s-c w1"/><rect x="86" y="34" width="66" height="70" rx="4" class="f-vs s-v w1"/>
      <text x="53" y="74" text-anchor="middle">GPU 1</text><text x="119" y="74" text-anchor="middle">GPU 2</text>
      <rect x="20" y="120" width="132" height="24" rx="3" class="f-ms s-m w1"/><text x="86" y="136" text-anchor="middle">same data</text>
      <text x="85" y="170" text-anchor="middle" class="t-mut">split one layer's tensor</text><text x="85" y="186" text-anchor="middle" class="t-mut">(needs a gather)</text>
    </g>
  </g>
  <path d="M260 68 L 270 70" class="s-mut w1"/>
</svg></div></figure>
<div data-w="parallel3d"></div>`
    },
    {
      id: 'dp', title: 'Data-parallel training and synchronization',
      html: String.raw`
<p><b>Replicate the model</b> on every GPU and <b>shard the inputs</b> (100 images on 4 GPUs = 25 each). Every GPU runs forward and backward on the same model with different data, and the parameters or gradients are <b>averaged (synchronized) every iteration</b>.</p>
<p>Three design questions (Mayer and Jacobsen, ACM CSUR 2020): <b>how</b> to synchronize, <b>when</b> (every batch or every few), and how to reduce the overhead.</p>
<div class="grid2">
  <div class="tile"><h4>Parameter server (centralized)</h4><p>Workers push updates to a central server, which averages them and sends the result back.</p></div>
  <div class="tile"><h4>All-reduce (decentralized)</h4><p>Workers exchange updates among themselves; no central server.</p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 150" width="700" height="150" role="img" aria-label="Bulk synchronous vs asynchronous timelines">
  <g class="t-sm">
    <text x="10" y="34" class="t-b">Bulk synchronous</text>
    <rect x="160" y="18" width="70" height="26" class="f-c"/><text x="195" y="35" text-anchor="middle" class="t-inv">F</text>
    <rect x="230" y="18" width="90" height="26" class="f-v"/><text x="275" y="35" text-anchor="middle" class="t-inv">B</text>
    <rect x="320" y="18" width="90" height="26" class="f-ms s-m w1"/><text x="365" y="35" text-anchor="middle">comm</text>
    <rect x="410" y="18" width="70" height="26" class="f-c"/><text x="445" y="35" text-anchor="middle" class="t-inv">F</text>
    <rect x="480" y="18" width="90" height="26" class="f-v"/><text x="525" y="35" text-anchor="middle" class="t-inv">B</text>
    <rect x="570" y="18" width="90" height="26" class="f-ms s-m w1"/><text x="615" y="35" text-anchor="middle">comm</text>
    <text x="10" y="104" class="t-b">Asynchronous</text>
    <rect x="160" y="88" width="70" height="26" class="f-c"/><text x="195" y="105" text-anchor="middle" class="t-inv">F</text>
    <rect x="230" y="88" width="90" height="26" class="f-v"/><text x="275" y="105" text-anchor="middle" class="t-inv">B</text>
    <rect x="320" y="88" width="70" height="26" class="f-c"/><text x="355" y="105" text-anchor="middle" class="t-inv">F</text>
    <rect x="390" y="88" width="90" height="26" class="f-v"/><text x="435" y="105" text-anchor="middle" class="t-inv">B</text>
    <rect x="480" y="88" width="70" height="26" class="f-c"/><text x="515" y="105" text-anchor="middle" class="t-inv">F</text>
    <rect x="320" y="118" width="90" height="20" class="f-ms s-m w1"/><text x="365" y="132" text-anchor="middle">comm</text>
    <rect x="480" y="118" width="90" height="20" class="f-ms s-m w1"/><text x="525" y="132" text-anchor="middle">comm</text>
    <text x="600" y="132" class="t-mut">overlapped</text>
  </g>
</svg></div></figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>Bulk synchronous parallel</th><th>Asynchronous parallel</th></tr></thead>
<tbody>
<tr><td>Communication overhead</td><td>more (waits for comm)</td><td>less (comm overlaps next forward)</td></tr>
<tr><td>Stragglers</td><td>prone to them</td><td>tolerant</td></tr>
<tr><td>Staleness</td><td>none</td><td>stale gradients, slower convergence</td></tr>
</tbody></table></div>
<p>Correctness favours synchronous training, so the effort goes into <b>reducing synchronization overhead</b>.</p>`
    },
    {
      id: 'ring', title: 'Ring all-reduce (NCCL)',
      html: String.raw`
<p>The simple all-to-all exchange among P processes needs <b>P·(P − 1)</b> messages, which is O(P²). NVIDIA's NCCL (Collective Communication Library) uses <b>ring all-reduce</b> instead. The processes form a ring and each splits its gradient array (size N) into <b>P chunks</b>:</p>
<ol>
<li><b>Scatter-reduce</b>: P − 1 times, every process sends one chunk of size N/P to its neighbour, which adds it to its own. Afterwards each process owns one fully reduced chunk.</li>
<li><b>All-gather</b>: P − 1 more times, the finished chunks are passed around until everyone has all of them.</li>
</ol>
<div data-w="ring"></div>
<div data-w="ring3d"></div>
<div class="formula"><span class="fl">Data each process sends in ring all-reduce</span><div class="fm">\[ 2\,(P-1)\,\frac{N}{P} \;\approx\; 2N \]</div><span class="fn">Practically independent of the number of processes P.</span></div>
<div class="box exam" data-t="So what limits data-parallel scaling?"><p>Not P, but <b>N</b>: the size of the model (gradients) that every process must send, about 2N per iteration.</p></div>`
    },
    {
      id: 'limits', title: 'Limits of data parallelism',
      html: String.raw`
<p>To synchronize less often you need <b>larger batches</b>, but large batches hurt generalization. In Goyal et al. ("Accurate, large minibatch SGD: training ImageNet in 1 hour", 2017) the ImageNet top-1 validation error stays flat up to a mini-batch of about 8k, then rises sharply: the <b>generalization gap</b>.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 560 200" width="560" height="200" role="img" aria-label="Throughput versus accuracy per epoch for synchronous and asynchronous SGD">
  <line x1="60" y1="170" x2="520" y2="170" class="s-line w1"/><line x1="60" y1="170" x2="60" y2="20" class="s-line w1"/>
  <g class="t-sm">
    <text x="290" y="194" text-anchor="middle" class="t-mut">throughput (epochs per second) →</text>
    <text x="22" y="95" text-anchor="middle" class="t-mut" transform="rotate(-90 22 95)">accuracy per epoch →</text>
    <circle cx="120" cy="40" r="8" class="f-c"/><text x="135" y="44">synchronous SGD</text>
    <circle cx="460" cy="150" r="8" class="f-m"/><text x="474" y="140">naive async SGD</text>
    <circle cx="300" cy="95" r="8" class="f-v"/><text x="315" y="99">async with stale-gradient handling</text>
    <text x="470" y="40" text-anchor="end" class="t-mut">ideal corner: not reachable</text>
  </g>
  <path d="M128 46 C 220 80, 380 120, 452 146" class="f-none s-mut w1 dash"/>
</svg></div><figcaption>No free lunch: perfect linear scaling with the number of workers is impossible. Sync pays communication overhead; async pays with stale gradients.</figcaption></figure>
<div class="grid2">
  <div class="box insight" data-t="Good"><p>Efficient (with ring all-reduce, comm time is independent of the number of workers) and super easy to implement: add one all-reduce before the parameter update.</p></div>
  <div class="box exam" data-t="Bad"><p>Hard to scale (statistical vs hardware efficiency), does not work when the model does not fit on one GPU, and communication can dominate: on 8× V100 with NVLink and NCCL, large models on 32 GPUs spend <b>over 90% of the time communicating</b> (VGG-16, for example).</p></div>
</div>`
    },
    {
      id: 'mp', title: 'Model and pipeline parallelism',
      html: String.raw`
<p><b>Model parallelism</b> is unavoidable when the model (plus activations) does not fit in one GPU's 80–120 GB. Split the layers across machines and replicate the data.</p>
<div class="grid2">
  <div class="box insight" data-t="Advantages"><ul><li>Total memory grows with machines, so the model can grow.</li><li>Only point-to-point communication (activations forward, gradients backward), which is cheaper.</li><li>Small mini-batches, so good statistical efficiency.</li></ul></div>
  <div class="box exam" data-t="Disadvantages"><ul><li>Under-utilization: <b>only one machine is busy at a time</b>.</li><li>Communication cannot be hidden.</li><li>How should non-homogeneous layers be partitioned?</li></ul></div>
</div>
<p>In short: data parallelism suffers communication overhead; model parallelism suffers poor utilization and low throughput. <b>Pipeline parallelism</b> is model parallelism fed with several (micro-)batches in a pipeline.</p>
<div data-w="pipeline"></div>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>GPipe (NeurIPS'19): intra-batch</th><th>PipeDream (SOSP'19): inter-batch</th></tr></thead>
<tbody>
<tr><td>Schedule</td><td>forward for all micro-batches, then backward for all, then update</td><td>static <b>1F1B</b>: alternate one forward and one backward; pipeline stays full after warm-up; cheap lookup table</td></tr>
<tr><td>Bubbles</td><td>fewer than model parallelism, but still present</td><td>minimized</td></tr>
<tr><td>Staleness / convergence</td><td>none; behaves like batch SGD with batch = micro-batch × workers</td><td>forward and backward of a mini-batch see different weight versions → <b>weight stashing</b> (keep several weight copies, more memory)</td></tr>
<tr><td>Partitioning</td><td>manual, from per-layer profiles</td><td>automatic: profiler + optimizer using dynamic programming to minimize training time</td></tr>
</tbody></table></div>
<p>The three pipeline challenges: <b>work partitioning</b> (balance load across stages, minimize communication), <b>scheduling</b> forward and backward passes (run an in-flight backward or a new forward?), and <b>staleness and convergence</b>. PipeDream-2BW is a later variant.</p>
<div class="box exam" data-t="A word of caution"><p>Training methods that hurt generalization are not adopted unless they give roughly a <b>10× speed-up</b>. There are many moving parts, and practitioners avoid asynchronous training unless absolutely necessary (for example very large recommendation models with trillions of parameters).</p></div>
<h3>Tensor parallelism</h3>
<p>Model and pipeline parallelism split <i>layers</i> across GPUs. What if <b>one layer</b> is too large for a GPU? Split its tensor into N chunks along a chosen dimension so each device holds 1/N (100 filters on 5 GPUs = 20 each) without changing the computation graph's result. It needs <b>extra communication (a gather)</b> to assemble the correct output.</p>`
    },
    {
      id: 'auto', title: 'Automatic parallelization',
      html: String.raw`
<p>Two system challenges in training: a very large <b>dataset</b> (easy: data parallelism) and a very large <b>model</b>, e.g. a 350 GB model on 32 GB GPUs (hard: how do you partition a computation graph?). Model sizes grew from 65M parameters in 2017 to about 1T in 2022, and keep growing.</p>
<p>Developers face a menu of parallelisms (data parallelism, ZeRO and FairScale FSDP, pipeline methods like GPipe and 1F1B, operator partitioning like Megatron-LM, Mesh-TF and GSPMD) and of models (CNNs, BERT, GPT-3, MoE). Which one for my model on my cluster?</p>
<div class="formula"><span class="fl">The auto-parallelization problem</span><div class="fm">\[ \max_{\text{strategy}}\; \text{Performance}(\text{Model}, \text{Cluster}) \]</div><span class="fn">A strategy combines inter-operator and intra-operator parallelism: think of colouring every operator of the graph with devices and partition axes.</span></div>
<div class="grid3">
  <div class="tile"><div class="big">100–10K</div><p>operators to colour</p></div>
  <div class="tile"><div class="big">80–200+</div><p>operator types</p></div>
  <div class="tile"><div class="big">10s–1000s</div><p>devices (colours)</p></div>
</div>
<p>The space is combinatorially huge for a general non-linear graph. Methods fall into three families:</p>
<div class="grid3">
  <div class="tile"><h4>Search-based</h4><p>MCMC (FlexFlow), heuristics, ML-based cost models, Bayesian optimization.</p></div>
  <div class="tile"><h4>Learning-based</h4><p>Reinforcement learning (ColocRL, Mirhoseini et al.).</p></div>
  <div class="tile"><h4>Optimization-based</h4><p>Dynamic programming (PipeDream and others), integer linear programming, hierarchical optimization (Alpa).</p></div>
</div>`
    },
    {
      id: 'flexflow', title: 'FlexFlow: the SOAP search space',
      html: String.raw`
<p>FlexFlow (Jia et al., "Beyond data and model parallelism for DNNs", MLSys 2019) parallelizes along four dimensions, <b>SOAP</b>:</p>
<div class="grid2">
  <div class="tile"><h4>S: Samples</h4><p>Partition training samples (data parallelism).</p></div>
  <div class="tile"><h4>O: Operators</h4><p>Place different operators on different GPUs (conv#1, #2, #3 on GPU 1–3).</p></div>
  <div class="tile"><h4>A: Attributes</h4><p>Partition attributes within a sample: length, height, width (different pixels).</p></div>
  <div class="tile"><h4>P: Parameters</h4><p>Partition the parameters of one operator (channels/filters).</p></div>
</div>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Operator</th><th>Sample</th><th>Attribute</th><th>Parameter</th></tr></thead>
<tbody>
<tr><td>1-D pooling</td><td>sample</td><td>length, channel</td><td>(none)</td></tr>
<tr><td>1-D convolution</td><td>sample</td><td>length</td><td>channel</td></tr>
<tr><td>2-D convolution</td><td>sample</td><td>height, width</td><td>channel</td></tr>
<tr><td>Matrix multiplication</td><td>sample</td><td>(none)</td><td>channel</td></tr>
</tbody></table></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 182" width="720" height="182" role="img" aria-label="FlexFlow: operator graph and device topology feed an MCMC search with an execution simulator; best strategy goes to the distributed runtime">
  <g class="t-sm">
    <rect x="10" y="20" width="130" height="40" rx="5" class="f-panel s-line w1"/><text x="75" y="38" text-anchor="middle">operator graph</text><text x="75" y="53" text-anchor="middle" class="t-mut">Conv, Concat, MatMul</text>
    <rect x="10" y="100" width="130" height="40" rx="5" class="f-panel s-line w1"/><text x="75" y="118" text-anchor="middle">device topology</text><text x="75" y="133" text-anchor="middle" class="t-mut">nodes, GPUs, network</text>
    <rect x="180" y="10" width="330" height="166" rx="8" class="f-none s-v w1 dash"/><text x="345" y="28" text-anchor="middle" class="t-v t-b">execution optimizer</text>
    <rect x="200" y="50" width="120" height="70" rx="5" class="f-vs s-v w1"/><text x="260" y="82" text-anchor="middle" class="t-b">MCMC search</text><text x="260" y="98" text-anchor="middle" class="t-mut">propose strategy</text>
    <rect x="370" y="50" width="120" height="70" rx="5" class="f-cs s-c w1"/><text x="430" y="82" text-anchor="middle" class="t-b">execution</text><text x="430" y="98" text-anchor="middle" class="t-b">simulator</text>
    <rect x="550" y="60" width="160" height="50" rx="5" class="f-panel s-line w1"/><text x="630" y="82" text-anchor="middle">best strategy →</text><text x="630" y="98" text-anchor="middle">distributed runtime</text>
    <text x="345" y="164" text-anchor="middle" class="t-mut">simulated performance fed back</text>
  </g>
  <path d="M140 40 L 198 70 M140 120 L 198 100 M320 72h48M490 85h58" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M430 120 C 430 140, 260 140, 260 122" class="f-none s-c w15" marker-end="url(#arr-c)"/>
</svg></div><figcaption>The simulator is a fast cost model (minimize execution time). Search stops when the time budget runs out or the best strategy has not improved for half the search time.</figcaption></figure>
<p>Results on P100 and K80 clusters for AlexNet, ResNet, Inception, RNNTC, RNNLM and NMT: <b>FlexFlow &gt; expert-designed strategies &gt; data parallelism</b>. Throughput per GPU falls as GPUs are added (communication makes scaling imperfect), but total throughput still rises.</p>`
    },
    {
      id: 'colocrl', title: 'ColocRL: device placement with reinforcement learning',
      html: String.raw`
<p>Mirhoseini et al. (ICML 2017) extract the training computation graph (ops like argmax, equal, add, matmul) and let a <b>policy network</b> propose device assignments. Each candidate is <b>run for real</b>; the measured runtime gives the <b>reward</b> (faster = higher), and policy gradients update the network, which proposes the next candidates.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 600 130" width="600" height="130" role="img" aria-label="RL loop: policy proposes placement, measured runtime is the reward">
  <g class="t-sm">
    <rect x="20" y="40" width="150" height="50" rx="6" class="f-vs s-v w1"/><text x="95" y="62" text-anchor="middle" class="t-b">policy (ML model)</text><text x="95" y="78" text-anchor="middle" class="t-mut">proposes placement</text>
    <rect x="240" y="40" width="130" height="50" rx="6" class="f-panel s-line w1"/><text x="305" y="62" text-anchor="middle">ops → devices</text><text x="305" y="78" text-anchor="middle" class="t-mut">A, B, C, D</text>
    <rect x="440" y="40" width="140" height="50" rx="6" class="f-cs s-c w1"/><text x="510" y="62" text-anchor="middle" class="t-b">run on hardware</text><text x="510" y="78" text-anchor="middle" class="t-mut">measure runtime</text>
    <text x="300" y="122" text-anchor="middle" class="t-v">reward → policy-gradient update</text>
  </g>
  <path d="M170 65h68M370 65h68" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M510 90 C 510 120, 95 120, 95 92" class="f-none s-v w15" marker-end="url(#arr-v)"/>
</svg></div></figure>`
    },
    {
      id: 'alpa', title: 'Alpa: inter-op by DP, intra-op by ILP',
      html: String.raw`
<p>Alpa (Zheng et al., OSDI 2022) automates both kinds of parallelism with hierarchical optimization.</p>
<div class="grid2">
  <div class="tile"><h4>Inter-operator parallelism</h4><p>Different operators on different devices (device 1: matmul1; device 2: relu + matmul2). <b>Less communication, more idle time.</b></p></div>
  <div class="tile"><h4>Intra-operator parallelism</h4><p>Each operator split across devices. <b>More communication, less idle time.</b></p></div>
</div>
<div class="box insight" data-t="The key observation"><p>A cluster has <b>fast links inside a node</b> (GPUs on the same board) and <b>slow links between nodes</b>. So map intra-op parallelism (frequent communication) <b>within</b> a node and inter-op parallelism (infrequent communication) <b>across</b> nodes. Alpa searches a hierarchical space: first split into stages (inter-op), then parallelize each stage (intra-op).</p></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 120" width="720" height="120" role="img" aria-label="Alpa compiler passes">
  <g class="t-sm">
    <rect x="10" y="30" width="120" height="50" rx="5" class="f-panel s-line w1"/><text x="70" y="52" text-anchor="middle">graph +</text><text x="70" y="68" text-anchor="middle">device cluster</text>
    <rect x="160" y="30" width="130" height="50" rx="5" class="f-vs s-v w1"/><text x="225" y="52" text-anchor="middle" class="t-b">inter-op pass</text><text x="225" y="68" text-anchor="middle" class="t-mut">dynamic programming</text>
    <rect x="320" y="30" width="130" height="50" rx="5" class="f-cs s-c w1"/><text x="385" y="52" text-anchor="middle" class="t-b">intra-op pass</text><text x="385" y="68" text-anchor="middle" class="t-mut">integer linear prog.</text>
    <rect x="480" y="30" width="100" height="50" rx="5" class="f-panel s-line w1"/><text x="530" y="60" text-anchor="middle">cost estimate</text>
    <rect x="610" y="30" width="100" height="50" rx="5" class="f-ms s-m w1"/><text x="660" y="52" text-anchor="middle">runtime</text><text x="660" y="68" text-anchor="middle">orchestration</text>
    <text x="355" y="112" text-anchor="middle" class="t-mut">iterate (compile-time technique)</text>
  </g>
  <path d="M130 55h28M290 55h28M450 55h28M580 55h28" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M530 80 C 530 105, 225 105, 225 82" class="f-none s-mut w1 dash" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<h3>Inter-op pass (dynamic programming)</h3>
<p>The cluster is a 2-D <b>device mesh</b> (nodes × GPUs per node). The graph (conv, relu, conv, add, pool, matmul, relu, matmul, softmax) is cut into stages, and each stage gets a <b>submesh</b>; both choices are solved together to minimize pipeline latency.</p>
<div class="formula"><span class="fl">Pipeline latency for B batches over S stages</span><div class="fm">\[ T^{*} = \underbrace{\sum_{i=1}^{S} t_i}_{\text{one batch through all stages}} + \underbrace{(B-1)\cdot \max_{j}\, t_j}_{\text{slowest stage sets the beat}} \]</div></div>
<div data-w="pipelat"></div>
<p>The DP profiles every possible (stage, submesh) pair with the intra-op pass, <b>enumerates all values of the second term</b> (the max stage latency), and turns the first term into a <b>2-D knapsack problem</b>. Assumptions:</p>
<ul>
<li>Forward and backward of the same stage go to the same submesh.</li>
<li>For an (N, M) cluster (N nodes × M GPUs), only submeshes (1, 1), (1, 2), (1, 4) … (1, M) within a node, or (2, M), (3, M) … (N, M) spanning whole nodes.</li>
<li>Out-of-memory settings cost infinity.</li>
<li>Complexity: <b>O(K⁵ N M (N + log M))</b>, K = number of operators.</li>
</ul>
<h3>Intra-op pass (integer linear programming)</h3>
<p>Given a stage and its submesh, choose how to split each operator to minimize computation plus communication cost. For a matmul C[i, j] = Σ<sub>k</sub> A[i, k]·B[k, j] (A activations, B weights):</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 170" width="720" height="170" role="img" aria-label="Three ways to partition a matmul across two devices">
  <g class="t-sm">
    <g transform="translate(10,0)"><text x="110" y="16" text-anchor="middle" class="t-b">Data parallel</text>
      <rect x="10" y="30" width="50" height="30" class="f-cs s-c w1"/><rect x="10" y="60" width="50" height="30" class="f-vs s-v w1"/><text x="35" y="108" text-anchor="middle">A rows</text>
      <text x="72" y="64">×</text>
      <rect x="85" y="30" width="50" height="60" class="f-panel s-line w1"/><text x="110" y="108" text-anchor="middle">B replicated</text>
      <text x="148" y="64">=</text>
      <rect x="160" y="30" width="50" height="30" class="f-cs s-c w1"/><rect x="160" y="60" width="50" height="30" class="f-vs s-v w1"/><text x="185" y="108" text-anchor="middle">C rows</text>
    </g>
    <g transform="translate(250,0)"><text x="110" y="16" text-anchor="middle" class="t-b">Operator parallel, type 1</text>
      <rect x="10" y="30" width="50" height="60" class="f-panel s-line w1"/><text x="35" y="108" text-anchor="middle">A replicated</text>
      <text x="72" y="64">×</text>
      <rect x="85" y="30" width="25" height="60" class="f-cs s-c w1"/><rect x="110" y="30" width="25" height="60" class="f-vs s-v w1"/><text x="110" y="108" text-anchor="middle">B columns</text>
      <text x="148" y="64">=</text>
      <rect x="160" y="30" width="25" height="60" class="f-cs s-c w1"/><rect x="185" y="30" width="25" height="60" class="f-vs s-v w1"/><text x="185" y="108" text-anchor="middle">C columns</text>
    </g>
    <g transform="translate(490,0)"><text x="110" y="16" text-anchor="middle" class="t-b">Operator parallel, type 2</text>
      <rect x="10" y="30" width="25" height="60" class="f-cs s-c w1"/><rect x="35" y="30" width="25" height="60" class="f-vs s-v w1"/><text x="35" y="108" text-anchor="middle">A columns</text>
      <text x="72" y="64">×</text>
      <rect x="85" y="30" width="50" height="30" class="f-cs s-c w1"/><rect x="85" y="60" width="50" height="30" class="f-vs s-v w1"/><text x="110" y="108" text-anchor="middle">B rows</text>
      <text x="148" y="64">=</text>
      <rect x="160" y="30" width="50" height="60" class="f-ms s-m w1"/><text x="185" y="64" text-anchor="middle">partial</text><text x="185" y="108" text-anchor="middle">all-reduce</text>
      <text x="110" y="132" text-anchor="middle" class="t-mut">→ C replicated</text>
    </g>
    <text x="360" y="160" text-anchor="middle" class="t-mut">teal = device 1, violet = device 2</text>
  </g>
</svg></div></figure>
<p>Type 2 costs the operator itself plus an all-reduce. When neighbouring operators choose different layouts for the same tensor, it must be <b>resharded</b>:</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>From → to</th><th>Communication</th></tr></thead>
<tbody>
<tr><td>row-partitioned → row-partitioned</td><td>none</td></tr>
<tr><td>row ↔ column partitioned</td><td>all-to-all</td></tr>
<tr><td>partitioned → replicated</td><td>all-gather (e.g. data-parallel stage → operator-parallel stage)</td></tr>
<tr><td>replicated → partitioned</td><td>slicing (no or little communication)</td></tr>
</tbody></table></div>
<div class="formula"><span class="fl">Alpa intra-op ILP</span><div class="fm">\[ \min_{s}\; \sum_{v \in V} s_v^{\top}\,(c_v + d_v) \;+\; \sum_{(v,u) \in E} s_v^{\top}\, R_{vu}\, s_u \]</div><span class="fn">s_v ∈ {0,1}^{k_v}: one-hot choice of parallel algorithm for operator v; c_v, d_v: its communication and compute cost vectors; R_vu: resharding cost matrix between neighbours v and u.</span></div>
<p>At runtime each stage is compiled into an executable on its static submesh, and the stages run as a pipeline with <b>cross-mesh communication</b>.</p>
<h3>Results (8 AWS p3.16xlarge nodes × 8 V100 16 GB = 64 GPUs, weak scaling)</h3>
<ul>
<li><b>GPT</b> up to 39B: matches the hand-tuned Megatron-LM.</li>
<li><b>GShard MoE</b> up to 70B: up to <b>8×</b> faster than the manual baseline at 16–64 GPUs.</li>
<li><b>Wide-ResNet</b> up to 13B: works where no manual plan exists (other auto systems fail at 32/64 GPUs; skip connections enlarge the design space and communication).</li>
</ul>
<p>Ablation: inter-op only matches Alpa on GPT but fails or is slow on MoE and Wide-ResNet; intra-op only is very slow at 64 GPUs (resharding and cross-node communication). <b>Combining both is what scales.</b></p>`
    }
  ],
  takeaways: [
    'Data parallel: replicate the model, shard data, all-reduce gradients every iteration.',
    'Bulk synchronous: more comm overhead, stragglers, no staleness. Async: overlap comm but stale gradients.',
    'Ring all-reduce: scatter-reduce then all-gather, each P − 1 steps of N/P; each process sends ≈ 2N regardless of P.',
    'Large batches reduce syncs but hurt generalization beyond ~8k on ImageNet; comm can exceed 90% of time for big models.',
    'Model parallelism fits big models but leaves GPUs idle; GPipe (no staleness, bubbles) and PipeDream (1F1B, weight stashing) pipeline micro-batches.',
    'Tensor parallelism splits one layer\'s tensor and needs a gather.',
    'FlexFlow searches the SOAP space (samples, operators, attributes, parameters) with MCMC + a simulator.',
    'Alpa: inter-op DP across nodes (T* = Σt + (B − 1)·max t) then intra-op ILP within nodes, with resharding costs.'
  ],
  numbers: [
    ['All-to-all messages', 'P(P − 1)', 'O(P²)'],
    ['Ring all-reduce data per process', '2N(P − 1)/P ≈ 2N', 'independent of P'],
    ['Generalization gap (Goyal et al.)', 'flat up to ~8k batch', 'then error rises'],
    ['Comm overhead, large models, 32 GPUs', '> 90% of time', '8× V100, NVLink, NCCL'],
    ['GPU memory', '~80–120 GB', 'model parallelism needed beyond this'],
    ['Auto-parallel search space', '100–10K ops, 80–200+ types, 10s–1000s devices', ''],
    ['Alpa DP complexity', 'O(K⁵ N M (N + log M))', 'K operators, N×M mesh'],
    ['Alpa on MoE', 'up to 8× over manual', 'up to 70B params, 64 GPUs']
  ],
  quiz: [
    { q: 'In data-parallel training, what is replicated and what is sharded?', o: ['Data replicated, model sharded', 'Model replicated, data sharded', 'Both sharded', 'Both replicated'], a: 1, why: 'Every GPU holds the full model and processes a slice of the batch.' },
    { q: 'How much data does each process send in ring all-reduce (array size N, P processes)?', o: ['N/P', 'N', '2N(P − 1)/P', 'N·P'], a: 2, why: 'P − 1 scatter-reduce steps plus P − 1 all-gather steps, each of N/P.' },
    { q: 'How many messages does naive all-to-all exchange need among 8 processes?', num: 56, tol: 0, why: 'P(P − 1) = 8 × 7 = 56.' },
    { q: 'What limits the scalability of data parallelism with ring all-reduce?', o: ['The number of GPUs P', 'The model/gradient size N', 'The learning rate', 'The number of layers'], a: 1, why: 'Each process sends about 2N per iteration, whatever P is.' },
    { q: 'Asynchronous data-parallel SGD mainly suffers from…', o: ['Stragglers', 'Stale gradients and slower convergence', 'More communication overhead', 'Pipeline bubbles'], a: 1, why: 'Communication overlaps compute, but updates use stale gradients.' },
    { q: 'Main disadvantage of plain model parallelism?', o: ['Too much all-reduce traffic', 'Only one machine busy at a time', 'Cannot fit large models', 'Poor statistical efficiency'], a: 1, why: 'Layers run one after another, so other GPUs sit idle.' },
    { q: 'PipeDream handles different weight versions in forward and backward with…', o: ['Gradient accumulation', 'Weight stashing', 'Recomputation', 'All-gather'], a: 1, why: 'It keeps several weight copies, costing memory.' },
    { q: 'Which schedule does GPipe use?', o: ['1F1B', 'All forwards, then all backwards, then update', 'Asynchronous', 'Random'], a: 1, why: 'Intra-batch pipelining: no staleness, but bubbles remain.' },
    { q: 'In FlexFlow\'s SOAP, "A" partitions…', o: ['Activations of all layers', 'Attributes within a sample (e.g. height, width)', 'Accelerators', 'All-reduce groups'], a: 1, why: 'Samples, Operators, Attributes, Parameters.' },
    { q: 'Alpa maps intra-operator parallelism…', o: ['across nodes', 'within a node, where links are fast', 'only to CPUs', 'to a single GPU'], a: 1, why: 'Intra-op needs frequent communication, so it uses fast intra-node links.' },
    { q: 'Pipeline latency with stage times 2, 3, 5, 2 and B = 5 batches (Alpa formula)?', num: 32, tol: 0, why: 'Σt = 12, plus (5 − 1) × 5 = 20, total 32.' },
    { q: 'Resharding a row-partitioned tensor to a column-partitioned one needs…', o: ['Nothing', 'All-to-all', 'All-gather', 'Slicing'], a: 1, why: 'Every device needs a piece from every other device.' }
  ],
  cards: [
    { f: 'Bulk synchronous vs async', b: 'BSP: no staleness, more comm overhead, stragglers. Async: overlaps comm, stale gradients.' },
    { f: 'Ring all-reduce', b: 'Scatter-reduce (P − 1 steps) + all-gather (P − 1 steps), chunks N/P. Sends ≈ 2N per process.' },
    { f: 'Generalization gap', b: 'Bigger batches mean fewer syncs but worse validation error beyond ~8k (ImageNet).' },
    { f: 'Model parallelism', b: 'Split layers across GPUs; more memory, point-to-point comm; but one GPU busy at a time.' },
    { f: 'GPipe vs PipeDream', b: 'GPipe: all F then all B, no staleness, bubbles. PipeDream: 1F1B, few bubbles, weight stashing.' },
    { f: 'Tensor parallelism', b: 'Split a single layer\'s tensor into N chunks along a dimension; needs a gather.' },
    { f: 'FlexFlow SOAP', b: 'Samples, Operators, Attributes, Parameters; MCMC search + execution simulator.' },
    { f: 'ColocRL', b: 'RL policy proposes op placements; measured runtime is the reward; policy gradients.' },
    { f: 'Alpa', b: 'Inter-op pass (DP, stages + submeshes) then intra-op pass (ILP, operator sharding + resharding costs).' },
    { f: 'Alpa pipeline latency', b: 'T* = Σ tᵢ + (B − 1)·max tⱼ.' }
  ]
});
