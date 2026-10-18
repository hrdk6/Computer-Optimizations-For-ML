CSO.register({
  id: 'ch16', num: 16, part: 'VII', kind: 'memory', span: 5, cover: 'profile',
  coverAlt: 'Glowing performance traces and stacked bars rising from a processor die.',
  title: 'Performance characterization of DL workloads', short: 'Performance characterization',
  lectures: [51, 52, 53, 54, 55],
  summary: 'Measuring before optimizing. Fathom profiles eight reference workloads by operation type; Dong et al. find why CNN layers stall on GPUs; Jain et al. study how CPU clusters, processes, batch size and frameworks affect training; Chishti and Akin characterize the memory system, finding unusually high spatial locality and big memory-bound phases.',
  sections: [
    {
      id: 'what', title: 'What and why',
      html: String.raw`
<p><b>Performance characterization</b> is the process of measuring, analyzing and quantifying how a system, device or algorithm behaves under various conditions, to establish baselines, identify bottlenecks, and verify functional and efficiency requirements.</p>
<p>It bridges the gap between theoretical design and real-world execution: it shows where the bottlenecks are, how to allocate resources, and how to keep operation robust and cost-effective.</p>`
    },
    {
      id: 'fathom', title: 'Fathom: reference workloads for deep learning',
      html: String.raw`
<p>Fathom (Adolf et al., IISWC 2016) is a broader benchmark set: state-of-the-art models (as of 2016) covering speech, language and vision; supervised, unsupervised and reinforcement learning; and fully connected, convolutional, linear, recurrent and residual styles.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Name</th><th>Year</th><th>Style</th><th>Layers</th><th>Learning</th><th>Dataset</th></tr></thead>
<tbody>
<tr><td>seq2seq</td><td>2014</td><td>recurrent</td><td>7</td><td>supervised</td><td>WMT-15</td></tr>
<tr><td>memnet</td><td>2015</td><td>memory network</td><td>3</td><td>supervised</td><td>bAbI</td></tr>
<tr><td>speech</td><td>2014</td><td>recurrent, full</td><td>5</td><td>supervised</td><td>TIMIT</td></tr>
<tr><td>autoenc</td><td>2014</td><td>full</td><td>3</td><td>unsupervised</td><td>MNIST</td></tr>
<tr><td>residual</td><td>2015</td><td>convolutional</td><td>34</td><td>supervised</td><td>ImageNet</td></tr>
<tr><td>vgg</td><td>2014</td><td>conv, full</td><td>19</td><td>supervised</td><td>ImageNet</td></tr>
<tr><td>alexnet</td><td>2012</td><td>conv, full</td><td>5</td><td>supervised</td><td>ImageNet</td></tr>
<tr><td>deepq</td><td>2013</td><td>conv, full</td><td>5</td><td>reinforcement</td><td>Atari ALE</td></tr>
</tbody></table></div>
<p>The reference implementations are in TensorFlow (Theano, Caffe or PyTorch would be similar), ship program plus input data for reproducibility, and do not capture pre- and post-processing. <b>Does the framework matter? Yes.</b> Low-level profiling with perf and performance counters is possible but hard to relate to layers, so Fathom profiles at the <b>operation level</b> with TensorFlow's tools.</p>
<h3>Where the time goes</h3>
<p>Operations are grouped into: <b>A</b> element-wise arithmetic, <b>B</b> matrix operations, <b>C</b> reduction and expansion, <b>D</b> convolution, <b>E</b> random sampling, <b>F</b> optimization, <b>G</b> data movement.</p>
<div class="grid2">
  <div class="box insight"><p><b>A few operation types dominate each model</b>: convolution in CNNs, MatMul in fully connected networks. The share of time per operation type is a fingerprint of the application.</p></div>
  <div class="box exam" data-t="Similarity clustering"><p>The ImageNet models (residual, vgg, alexnet) cluster together; deepq too, since it is dominated by convolutions. speech and seq2seq are both RNNs yet very dissimilar (possibly because of different loss functions).</p></div>
</div>
<ul>
<li><b>Training vs inference</b>: training (forward + backward, many batches and epochs) takes far longer than inference, on CPU and GPU; the GPU is much faster for both.</li>
<li><b>Intra-operation parallelism</b>: giving parallel libraries more threads speeds up convolution with a <b>staircase</b> pattern, matmul similarly but less pronounced; element-wise operations behave differently; transpose barely improves; and <b>"sum" gets slower</b> with more threads (deepq, seq2seq, memnet).</li>
</ul>`
    },
    {
      id: 'gpu', title: 'CNNs on GPUs: where the stalls are',
      html: String.raw`
<p>Dong et al. (ICPE 2018) study how GPU microarchitecture affects CNN performance, using AlexNet with cuDNN and cuBLAS on a <b>GTX 1080 (Pascal)</b> and a <b>K40 (Kepler)</b>, profiled with nvprof (now replaced by Nsight) over one iteration, with database-based trace tracking to recover per-layer information.</p>
<ul>
<li>Runtime breakdown at batch 16, 64 and 128: <b>convolution layers dominate</b>, then FC, then non-linearities.</li>
<li>Operations: FC → matrix multiply; convolution → GEMM, FFT or Winograd (computationally efficient); ReLU, sigmoid, tanh → element-wise.</li>
<li>The faster GPU (normalized to K40) speeds up convolution and FC layers most, and non-linear layers least.</li>
</ul>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Layer (backprop)</th><th>Main stall reasons on K40</th><th>Bound</th></tr></thead>
<tbody>
<tr><td>conv2_w</td><td>stall_exec_dependency (instruction dependencies), stall_not_selected (scheduler picks competing warps)</td><td><b>compute</b></td></tr>
<tr><td>relu2</td><td>stall_memory_throttle, stall_memory_dependency (waiting on loads/stores)</td><td><b>memory</b></td></tr>
<tr><td>lrn2, pool2, softmax</td><td>both kinds</td><td>compute and memory</td></tr>
</tbody></table></div>
<p>On the GTX 1080, memory stalls are higher in non-linear layers such as ReLU, stall_memory_throttle disappears for all layers, and lrn2, pool2 and softmax become memory-bound.</p>
<div class="grid2">
  <div class="tile"><h4>Utilization and memory</h4><ul><li>Core utilization is high in linear layers and low in non-linear ones (ReLU, softmax).</li><li>No observable L1/L2 hit rate on K40, no L1 hit rate on GTX 1080, but a reasonable texture-cache hit rate.</li><li>The GTX's larger shared memory filters accesses to L2/DRAM; linear layers rely on shared and texture memory; activation layers have higher DRAM throughput.</li></ul></div>
  <div class="box insight" data-t="Suggested optimizations"><ul><li>More DRAM bandwidth on the GTX 1080 will <b>not</b> raise CNN throughput.</li><li>Raise <b>texture-cache bandwidth</b>.</li><li>L1 is essentially unused (too small for strided access): <b>bypass L1</b> for selected layers.</li><li><b>Fuse</b> linear and non-linear layers into one kernel.</li></ul></div>
</div>`
    },
    {
      id: 'clusters', title: 'Training on CPU clusters: TensorFlow vs PyTorch',
      html: String.raw`
<p>Jain et al. (IEEE CLUSTER 2019) characterize DNN training with TensorFlow and PyTorch on modern clusters: the effect of core count, batch size (BS), a <b>single process</b> per node (SP) vs <b>multiple processes</b> per node (MP) vs <b>multiple processes on multiple nodes</b> (MPMN), clock speed vs core count, CPU vs GPU, and framework.</p>
<p>(Recap: data parallelism distributes data, replicates the model, combines per-process batches into a larger batch and synchronizes gradients. Model parallelism splits the model by layer or by tensor slicing and sends feature maps between processes in both passes.)</p>
<div class="grid3">
  <div class="tile"><h4>SP</h4><p>Intra-op parallelism on one node: throughput rises with threads (up to 48 on a 48-core Skylake), and <b>larger batches gain more</b> from extra threads.</p></div>
  <div class="tile"><h4>MP</h4><p>Per-process memory limits processes per node (PPN). For ResNet-152, 4 PPN works well up to BS = 64. <b>MP beats SP</b> within a node.</p></div>
  <div class="tile"><h4>MPMN</h4><p>Fix PPN at the best MP value and tune threads per process: performance scales across 1–8 nodes (28- and 40-core Skylakes), with the same trend for all apps and both frameworks.</p></div>
</div>
<div data-w="bars" data-o='{"title":"CPU vs GPU and framework comparisons","hint":"Speed-up of the winner","unit":"×","labelWidth":250,"max":3.5,"items":[["Inception-v4: Skylake-3 over K80",2.35,"m","2.35×"],["ResNet-101: V100 over Skylake-3",3.32,"c","3.32×"],["ResNet-152 multi-node: PyTorch over TF",1.12,"v","up to 12%"],["128 nodes: TensorFlow over PyTorch",2.5,"v","up to 2.5×"]],"note":"A modern CPU can beat an older GPU (K80), while a V100 beats the CPU. PyTorch scaled well but, as of 2019, TensorFlow was up to 2.5× faster at 128 nodes."}'></div>`
    },
    {
      id: 'memory', title: 'Memory-system characterization',
      html: String.raw`
<p>Chishti and Akin (MEMSYS 2019) built a framework to capture the feedback loop between CPU and memory:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 150" width="720" height="150" role="img" aria-label="DLsim flow: TensorFlow model to Sniper, trace extractor, trace analyzer with detailed memory model, stats">
  <g class="t-sm">
    <rect x="10" y="40" width="110" height="56" rx="5" class="f-panel s-line w1"/><text x="65" y="64" text-anchor="middle">TensorFlow</text><text x="65" y="80" text-anchor="middle">DNN model</text>
    <rect x="145" y="40" width="130" height="56" rx="5" class="f-cs s-c w1"/><text x="210" y="62" text-anchor="middle" class="t-b">Sniper</text><text x="210" y="78" text-anchor="middle" class="t-mut">SKL cores, CPI stack,</text><text x="210" y="90" text-anchor="middle" class="t-mut">one training iteration</text>
    <rect x="300" y="40" width="120" height="56" rx="5" class="f-vs s-v w1"/><text x="360" y="62" text-anchor="middle" class="t-b">trace extractor</text><text x="360" y="80" text-anchor="middle" class="t-mut">RD/WR, addr, time</text>
    <rect x="445" y="40" width="140" height="56" rx="5" class="f-ms s-m w1"/><text x="515" y="58" text-anchor="middle" class="t-b">trace analyzer</text><text x="515" y="74" text-anchor="middle" class="t-mut">cache + DRAM model</text><text x="515" y="88" text-anchor="middle" class="t-mut">DDR4-2133 ×4, 68 GB/s</text>
    <rect x="610" y="40" width="100" height="56" rx="5" class="f-panel s-line w1"/><text x="660" y="62" text-anchor="middle">locality,</text><text x="660" y="78" text-anchor="middle">row-buffer hits</text>
    <text x="360" y="130" text-anchor="middle" class="t-mut">open-page policy, FR-FCFS scheduling; initialization skipped</text>
  </g>
  <path d="M120 68h23M275 68h23M420 68h23M585 68h23" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Workload</th><th>Layers</th><th>Batch</th><th>Footprint (GB)</th><th>IPC per core</th><th>LLC MPKI</th></tr></thead>
<tbody>
<tr><td>AlexNet</td><td>8</td><td>64</td><td>0.6</td><td>1.63</td><td>2.6</td></tr>
<tr><td>VGG</td><td>19</td><td>32</td><td>3.5</td><td>1.77</td><td>7.7</td></tr>
<tr><td>GoogLeNet</td><td>22</td><td>64</td><td>1.5</td><td>1.35</td><td>4.8</td></tr>
<tr><td>ResNet-32</td><td>34</td><td>128</td><td>0.25</td><td>1.33</td><td>2.9</td></tr>
<tr><td>Inception-ResNet-v2</td><td>22</td><td>32</td><td>1.2</td><td>1.82</td><td>7.0</td></tr>
</tbody></table></div>
<ul>
<li><b>Footprint</b>: cross-layer <b>feature maps</b> are the majority; <b>gradient maps</b> (backward) are another big part; weights dominate only in the last FC layers.</li>
<li><b>Compute vs memory</b>: memory accesses take <b>25–40%</b> of execution time. GoogLeNet's CPI stack shows distinct compute-intensive and memory-intensive phases, with bandwidth demand often above 90% in the memory phases.</li>
</ul>
<div data-w="bars" data-o='{"title":"Spatial locality: 64 B lines touched per 4 KB page","unit":"/64","max":64,"labelWidth":190,"items":[["DNN inference",59,"c","~59/64 (92%)"],["DNN training",55,"c","~55/64 (86%)"],["Traditional server workloads",8,"m","~8/64 (13%)"]]}'></div>
<ul>
<li><b>Spatio-temporal locality</b>: within a page, about 50% of accesses come more than 1 µs after the first access, and about 20% at least 10 µs later.</li>
<li><b>Row-buffer hits</b> are high (mostly streaming), and more DIMMs per channel (2DPC vs 1DPC) means more banks and higher hit rates. Still, 45% (1DPC) and 30% (2DPC) of accesses are <b>row-buffer conflicts</b>: contiguous accesses spread over time, and multiple streams hitting the same bank.</li>
<li><b>LLC size</b>: growing the last-level cache from 64 to 512 MB lets feature maps fit and cuts DRAM accesses, so dense memories (eDRAM, STT-RAM) are attractive for LLCs.</li>
<li><b>Future directions</b>: DRAM's internal bandwidth is about 7× its external bandwidth (DDR4-3200), so wider interfaces and longer bursts would suit DNNs' high spatial locality.</li>
</ul>
<div class="box insight" data-t="Further studies named in the lecture"><p>Kim et al. (ISPASS 2017) compared AlexNet under Caffe, CNTK, TensorFlow, Theano and Torch: per-layer times differ by framework. Bianco et al. (IEEE Access 2018) benchmarked inference time vs batch size for many DNNs (AlexNet to MobileNet) on a Titan Xp and a Jetson TX1.</p></div>`
    }
  ],
  takeaways: [
    'Characterization establishes baselines and finds bottlenecks before optimizing.',
    'Fathom: 8 reference workloads profiled by operation type; a few ops dominate (conv in CNNs, MatMul in FC nets); the framework matters.',
    'More threads help conv and matmul in a staircase, barely help transpose, and slow down "sum".',
    'On GPUs, conv layers dominate time and are compute-bound; ReLU is memory-bound; L1 is unused; suggested: texture-cache BW, L1 bypass, kernel fusion.',
    'On CPU clusters, MP beats SP within a node and MPMN scales; a Skylake beats a K80 on Inception-v4 but a V100 beats the Skylake on ResNet-101.',
    'Memory: feature maps dominate the footprint, memory takes 25–40% of time, DNNs touch ~86–92% of each page vs ~13% for servers, and bigger LLCs help.'
  ],
  numbers: [
    ['Fathom workloads', '8', 'seq2seq, memnet, speech, autoenc, residual, vgg, alexnet, deepq'],
    ['Inception-v4: Skylake-3 vs K80', '2.35× faster', 'CPU wins'],
    ['ResNet-101: V100 vs Skylake-3', '3.32× faster', 'GPU wins'],
    ['TF vs PyTorch at 128 nodes', 'TF up to 2.5×', '2019'],
    ['Memory share of execution time', '25–40%', 'Chishti & Akin'],
    ['Lines touched per 4 KB page', '~59/64 inference, ~55/64 training', 'vs ~8/64 for servers'],
    ['Row-buffer conflicts', '45% (1DPC), 30% (2DPC)', ''],
    ['DRAM internal vs external BW', '~7×', 'DDR4-3200']
  ],
  quiz: [
    { q: 'Which operation dominates CNN workloads in Fathom\'s profiles?', o: ['MatMul', 'Convolution', 'Random sampling', 'Data movement'], a: 1, why: 'MatMul dominates fully connected networks instead.' },
    { q: 'Which operation got slower with more threads in Fathom?', o: ['Convolution', 'MatMul', 'Sum', 'Transpose'], a: 2, why: 'Execution time increased with threads for "sum".' },
    { q: 'According to Dong et al., conv2_w backprop on K40 is mainly…', o: ['memory-bound', 'compute-bound', 'I/O-bound', 'idle'], a: 1, why: 'Its stalls are execution dependency and not-selected.' },
    { q: 'relu2 on K40 stalls mainly on…', o: ['execution dependency', 'memory throttle and memory dependency', 'branch divergence', 'synchronization'], a: 1, why: 'Element-wise layers are memory-bound.' },
    { q: 'Which optimization did Dong et al. NOT recommend?', o: ['More DRAM bandwidth on GTX 1080', 'Higher texture-cache bandwidth', 'L1 bypassing', 'Kernel fusion'], a: 0, why: 'More DRAM bandwidth would not raise CNN throughput there.' },
    { q: 'Within a node, which mode performed better in Jain et al.?', o: ['Single process (SP)', 'Multiple processes (MP)', 'Neither', 'Only GPU'], a: 1, why: 'MP beats SP; PPN is limited by memory per process.' },
    { q: 'What fraction of 64 B lines in a 4 KB page does DNN inference touch?', o: ['~13%', '~50%', '~92%', '100%'], a: 2, why: 'About 59 of 64 lines, versus about 8 for server workloads.' },
    { q: 'What dominates the memory footprint of DNN training?', o: ['Weights', 'Cross-layer feature maps (plus gradient maps)', 'Instructions', 'Labels'], a: 1, why: 'Weights dominate only in the last FC layers.' },
    { q: 'Memory accesses take what share of DNN execution time in this study?', o: ['5–10%', '25–40%', '70–80%', '>95%'], a: 1, why: 'With phases where bandwidth demand exceeds 90%.' }
  ],
  cards: [
    { f: 'Performance characterization', b: 'Measure, analyze and quantify behaviour to set baselines and find bottlenecks.' },
    { f: 'Fathom', b: '8 reference workloads (2016), operation-level profiling; few op types dominate; framework matters.' },
    { f: 'Fathom op groups', b: 'A element-wise, B matrix, C reduction/expansion, D convolution, E random sampling, F optimization, G data movement.' },
    { f: 'GPU stall reasons', b: 'Conv: exec dependency, not selected (compute-bound). ReLU: memory throttle/dependency (memory-bound).' },
    { f: 'GPU suggestions', b: 'Not more DRAM BW; more texture-cache BW; bypass L1; fuse linear + non-linear kernels.' },
    { f: 'SP / MP / MPMN', b: 'Single process per node, multiple per node, multiple across nodes. MP > SP; MPMN scales.' },
    { f: 'DNN spatial locality', b: '~92% (inference) / 86% (training) of lines per page touched vs ~13% for servers.' },
    { f: 'LLC sensitivity', b: '64 → 512 MB LLC lets feature maps fit; dense eDRAM/STT-RAM LLCs help.' }
  ]
});
