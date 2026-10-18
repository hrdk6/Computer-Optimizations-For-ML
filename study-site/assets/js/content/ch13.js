CSO.register({
  id: 'ch13', num: 13, part: 'VI', kind: 'memory', span: 4, cover: 'graph',
  coverAlt: 'A glowing graph of connected nodes with feature vectors flowing along its edges.',
  title: 'Graph neural networks and HyGCN', short: 'GNNs and HyGCN',
  lectures: [37, 38, 39, 40],
  summary: 'What graph neural networks compute (sample, aggregate, combine, pool, read out), the GCN, GraphSAGE and GIN update rules, why aggregation behaves like irregular graph processing while combination behaves like a dense MLP, and how HyGCN builds one engine for each.',
  sections: [
    {
      id: 'graphs', title: 'Learning on graphs',
      html: String.raw`
<p>Many estimation tasks are naturally <b>graphs</b>. Two datasets from the lecture:</p>
<div class="grid2">
  <div class="tile"><h4>Cora (node classification)</h4><p><b>2708</b> scientific publications linked by <b>5429</b> citations. Each paper is a 0/1 vector over a dictionary of <b>1433</b> words (its features). Task: predict each paper's subject, one of <b>7</b> classes.</p></div>
  <div class="tile"><h4>Reddit (graph/community classification)</h4><p>Nodes are users; an edge means one responded to the other's comment. <b>232,965</b> nodes, <b>114,615,892</b> edges, feature size <b>602</b>. Task in REDDIT-Binary: is a community question/answer-based or discussion-based?</p></div>
</div>
<div data-w="bars" data-o='{"title":"Cora: papers per class","labelWidth":170,"items":[["Neural_Networks",818,"c"],["Probabilistic_Methods",426,"c"],["Genetic_Algorithms",418,"c"],["Theory",351,"c"],["Case_Based",298,"c"],["Reinforcement_Learning",217,"c"],["Rule_Learning",180,"c"]]}'></div>`
    },
    {
      id: 'phases', title: 'How a GNN computes: aggregate and combine',
      html: String.raw`
<p>Node classification by a GNN repeats two phases per layer k:</p>
<div class="grid2">
  <div class="tile"><h4>Aggregation</h4><p>An <b>aggregate function</b> merges the feature vectors of a vertex's neighbours into one vector. Different GNNs use different functions.</p></div>
  <div class="tile"><h4>Combination (feature extraction)</h4><p>A <b>combine function</b> transforms each vertex's vector with an <b>MLP</b>. The MLP parameters (W<sub>k</sub>, B<sub>k</sub>) are <b>shared by all vertices</b>.</p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 150" width="720" height="150" role="img" aria-label="GNN pipeline: input graph, sample, aggregate, combine, pool, readout">
  <g class="t-sm">
    <circle cx="60" cy="70" r="12" class="f-cs s-c w15"/><text x="60" y="75" text-anchor="middle">A</text>
    <circle cx="20" cy="40" r="8" class="f-panel s-line w1"/><circle cx="25" cy="105" r="8" class="f-panel s-line w1"/><circle cx="100" cy="35" r="8" class="f-panel s-line w1"/><circle cx="105" cy="100" r="8" class="f-panel s-line w1"/>
    <path d="M27 45 L 51 63 M31 99 L 51 77 M93 40 L 70 62 M97 95 L 70 78" class="s-line w1"/>
    <text x="60" y="140" text-anchor="middle" class="t-mut">input graph</text>
    <rect x="140" y="50" width="90" height="40" rx="5" class="f-panel s-line w1 dash"/><text x="185" y="75" text-anchor="middle">sample</text>
    <rect x="250" y="50" width="100" height="40" rx="5" class="f-ms s-m w15"/><text x="300" y="75" text-anchor="middle" class="t-b">aggregate</text>
    <rect x="370" y="50" width="100" height="40" rx="5" class="f-cs s-c w15"/><text x="420" y="75" text-anchor="middle" class="t-b">combine</text>
    <rect x="490" y="50" width="90" height="40" rx="5" class="f-panel s-line w1 dash"/><text x="535" y="75" text-anchor="middle">pool</text>
    <rect x="600" y="50" width="110" height="40" rx="5" class="f-vs s-v w1"/><text x="655" y="68" text-anchor="middle">readout</text><text x="655" y="83" text-anchor="middle" class="t-mut">Σ or concat</text>
    <text x="360" y="128" text-anchor="middle" class="t-mut">repeat for each layer k (dashed steps are optional)</text>
  </g>
  <path d="M120 70h18M230 70h18M350 70h18M470 70h18M580 70h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M420 92 C 420 115, 300 115, 300 94" class="f-none s-mut w1 dash" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<ul>
<li><b>Sample</b> (before aggregation) picks a subset of neighbours to cut the cost.</li>
<li><b>Pool</b> (sometimes after combination) turns the graph into a smaller graph.</li>
<li>For <b>node classification</b>, the last layer's vertex features are used directly. For <b>graph classification</b>, <b>readout</b> merges all vertices' last vectors into one graph representation; it can be a plain sum, an "extreme aggregation".</li>
</ul>
<h3>Three popular GNNs</h3>
<p>Notation: a<sub>v</sub><sup>k</sup> is the aggregated vector of node v at layer k, h<sub>v</sub> its feature vector, D<sub>v</sub> its degree, N(v) its neighbours.</p>
<div class="formula"><span class="fl">GCN</span><div class="fm">\[ a_v^{k} = \sum_{u \in N(v)} \frac{h_u^{k-1}}{\sqrt{D_v D_u}}, \qquad h_v^{k} = \text{ReLU}\big(W^{k} a_v^{k} + b^{k}\big) \]</div></div>
<div class="formula"><span class="fl">GraphSAGE (uniform neighbour sampling S(v))</span><div class="fm">\[ a_v^{k} = \text{Mean}\big(\{h_v^{k-1}\} \cup \{h_u^{k-1},\ \forall u \in S(v)\}\big), \qquad h_v^{k} = \text{ReLU}\big(W^{k} a_v^{k} + b^{k}\big) \]</div></div>
<div class="formula"><span class="fl">GINConv</span><div class="fm">\[ a_v^{k} = (1+\epsilon_k)\, h_v^{k-1} + \sum_{u \in N(v)} h_u^{k-1}, \qquad h_v^{k} = \text{MLP}^{k}\big(W^{k}, a_v^{k}, b^{k}\big) \]</div></div>
<p>In matrix form, aggregation over all nodes is the product of the adjacency matrix A with the feature matrix X:</p>
<div data-w="gnnagg"></div>
<div class="box exam" data-t="The systems view"><p>Aggregation, combination, pooling, readout (and sampling) make up a GNN. <b>Everything except combination depends on the graph structure</b>: it is graph processing with irregular memory accesses. Combination is a regular, dense MLP. Aggregation and combination are the two major phases.</p></div>`
    },
    {
      id: 'character', title: 'Characterizing GNNs on a CPU',
      html: String.raw`
<p>Running GCN, GraphSAGE (GSC) and GIN in PyTorch Geometric (PyG) on a CPU, aggregation dominates the time on most datasets (about 99% on Reddit), while combination dominates on a few (such as IMDB).</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Dataset</th><th>Vertices</th><th>Feature length</th><th>Edges</th><th>Storage</th></tr></thead>
<tbody>
<tr><td>IMDB-BIN (IB)</td><td>2,647</td><td>136</td><td>28,624</td><td>1.5 MB</td></tr>
<tr><td>Cora (CR)</td><td>2,708</td><td>1,433</td><td>10,556</td><td>15 MB</td></tr>
<tr><td>Citeseer (CS)</td><td>3,327</td><td>3,703</td><td>9,104</td><td>47 MB</td></tr>
<tr><td>COLLAB (CL)</td><td>12,087</td><td>492</td><td>1,446,010</td><td>28 MB</td></tr>
<tr><td>Pubmed (PB)</td><td>19,717</td><td>500</td><td>88,648</td><td>38 MB</td></tr>
<tr><td>Reddit (RD)</td><td>232,965</td><td>602</td><td>114,615,892</td><td>972 MB</td></tr>
</tbody></table></div>
<h3>A hybrid execution pattern</h3>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>On CPU</th><th>Aggregation</th><th>Combination</th></tr></thead>
<tbody>
<tr><td>DRAM bytes per operation</td><td><b>11.6</b></td><td>0.06</td></tr>
<tr><td>DRAM access energy per operation</td><td><b>170 nJ</b></td><td>0.5 nJ</td></tr>
<tr><td>L2 misses per kilo-instruction (MPKI)</td><td>11</td><td>1.5</td></tr>
<tr><td>L3 MPKI</td><td>10</td><td>0.9</td></tr>
<tr><td>Time spent on synchronization</td><td>(n/a)</td><td>36%</td></tr>
<tr><td>Access pattern</td><td>indirect, irregular</td><td>direct, regular</td></tr>
<tr><td>Data reusability</td><td>low</td><td>high</td></tr>
<tr><td>Computation pattern</td><td>dynamic, irregular</td><td>static, regular</td></tr>
<tr><td>Computation intensity</td><td>low</td><td>high</td></tr>
<tr><td><b>Bound by</b></td><td><b>memory</b></td><td><b>compute</b></td></tr>
</tbody></table></div>
<p>Aggregation follows the random, sparse graph structure, so it reads far more from DRAM and misses more in cache. Combination is a matrix–vector multiplication that needs little data but spends 36% of its time on data copying and synchronization.</p>
<div class="box insight" data-t="How GNNs differ from ordinary workloads"><ul><li>In aggregation the <b>feature-vector length varies</b> (set by the model and layer) instead of being fixed.</li><li>In combination the MLP parameters are <b>shared by all vertices</b>: highly reusable data.</li><li>The two phases <b>alternate</b>.</li></ul></div>`
    },
    {
      id: 'hygcn', title: 'HyGCN: one engine per phase',
      html: String.raw`
<p>HyGCN (Yan et al., HPCA 2020) is a hybrid architecture: an <b>aggregation engine</b> for irregular access and computation, and a <b>combination engine</b> built from systolic arrays for regular work.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 260" width="720" height="260" role="img" aria-label="HyGCN: aggregation engine with SIMD cores, coordinator with aggregation buffer, combination engine with systolic modules, memory access handler and DRAM">
  <g class="t-sm">
    <rect x="10" y="20" width="250" height="180" rx="8" class="f-none s-m w15"/><text x="135" y="40" text-anchor="middle" class="t-m t-b">Aggregation engine</text>
    <rect x="25" y="52" width="70" height="30" rx="3" class="f-panel s-line w1"/><text x="60" y="71" text-anchor="middle">eSched</text>
    <rect x="100" y="52" width="70" height="30" rx="3" class="f-panel s-line w1"/><text x="135" y="71" text-anchor="middle">sampler</text>
    <rect x="175" y="52" width="75" height="30" rx="3" class="f-panel s-line w1"/><text x="212" y="66" text-anchor="middle">sparsity</text><text x="212" y="78" text-anchor="middle">eliminator</text>
    <g class="f-ms s-m w1"><rect x="25" y="92" width="50" height="40" rx="3"/><rect x="80" y="92" width="50" height="40" rx="3"/><rect x="135" y="92" width="50" height="40" rx="3"/><rect x="190" y="92" width="50" height="40" rx="3"/></g>
    <text x="132" y="148" text-anchor="middle">SIMD cores</text>
    <rect x="25" y="158" width="105" height="30" rx="3" class="f-panel s-line w1"/><text x="77" y="177" text-anchor="middle">edge buffer</text>
    <rect x="140" y="158" width="105" height="30" rx="3" class="f-panel s-line w1"/><text x="192" y="177" text-anchor="middle">input buffer</text>
    <rect x="285" y="70" width="140" height="80" rx="6" class="f-vs s-v w15"/><text x="355" y="100" text-anchor="middle" class="t-b">Coordinator</text><text x="355" y="118" text-anchor="middle">aggregation</text><text x="355" y="132" text-anchor="middle">buffer</text>
    <rect x="450" y="20" width="260" height="180" rx="8" class="f-none s-c w15"/><text x="580" y="40" text-anchor="middle" class="t-c t-b">Combination engine</text>
    <g class="f-cs s-c w1"><rect x="465" y="52" width="55" height="55" rx="3"/><rect x="525" y="52" width="55" height="55" rx="3"/><rect x="585" y="52" width="55" height="55" rx="3"/><rect x="645" y="52" width="55" height="55" rx="3"/></g>
    <text x="580" y="124" text-anchor="middle">systolic modules</text>
    <rect x="465" y="134" width="70" height="28" rx="3" class="f-panel s-line w1"/><text x="500" y="152" text-anchor="middle">vSched</text>
    <rect x="540" y="134" width="80" height="28" rx="3" class="f-panel s-line w1"/><text x="580" y="152" text-anchor="middle">weight buf</text>
    <rect x="625" y="134" width="75" height="28" rx="3" class="f-panel s-line w1"/><text x="662" y="152" text-anchor="middle">output buf</text>
    <rect x="540" y="168" width="160" height="24" rx="3" class="f-panel s-line w1"/><text x="620" y="184" text-anchor="middle">activation unit</text>
    <rect x="160" y="218" width="400" height="30" rx="5" class="f-panel s-line w1"/><text x="360" y="238" text-anchor="middle">memory access handler → DRAM (HBM)</text>
  </g>
  <path d="M260 110h23M425 110h23M135 200v16M580 200v16" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<h3>Aggregation engine</h3>
<ul>
<li><b>Static graph partitioning</b> to improve data reuse.</li>
<li><b>Dynamic sparsity elimination</b> to avoid unnecessary data accesses.</li>
</ul>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 680 170" width="680" height="170" role="img" aria-label="Vertex-concentrated vs vertex-disperse execution on SIMD cores">
  <g class="t-sm">
    <text x="160" y="16" text-anchor="middle" class="t-b">vertex-concentrated</text>
    <text x="20" y="44" class="t-mut">core 1</text><text x="20" y="74" class="t-mut">core 2</text><text x="20" y="104" class="t-mut">core 3</text><text x="20" y="134" class="t-mut">core 4</text>
    <rect x="70" y="30" width="200" height="22" rx="3" class="f-ms"/><text x="170" y="45" text-anchor="middle">vertex 1 (long)</text>
    <rect x="70" y="60" width="90" height="22" rx="3" class="f-cs"/><text x="115" y="75" text-anchor="middle">v2</text><rect x="160" y="60" width="110" height="22" rx="3" class="f-panel s-line w1 dash"/><text x="215" y="75" text-anchor="middle" class="t-mut">waits</text>
    <rect x="70" y="90" width="60" height="22" rx="3" class="f-vs"/><text x="100" y="105" text-anchor="middle">v3</text><rect x="130" y="90" width="140" height="22" rx="3" class="f-panel s-line w1 dash"/><text x="200" y="105" text-anchor="middle" class="t-mut">waits</text>
    <rect x="70" y="120" width="120" height="22" rx="3" class="f-cs"/><text x="130" y="135" text-anchor="middle">v4</text><rect x="190" y="120" width="80" height="22" rx="3" class="f-panel s-line w1 dash"/>
    <text x="500" y="16" text-anchor="middle" class="t-b">vertex-disperse</text>
    <g class="f-ms"><rect x="370" y="30" width="50" height="22" rx="3"/><rect x="370" y="60" width="50" height="22" rx="3"/><rect x="370" y="90" width="50" height="22" rx="3"/><rect x="370" y="120" width="50" height="22" rx="3"/></g>
    <g class="f-cs"><rect x="422" y="30" width="22" height="22" rx="3"/><rect x="422" y="60" width="22" height="22" rx="3"/><rect x="422" y="90" width="22" height="22" rx="3"/><rect x="422" y="120" width="22" height="22" rx="3"/></g>
    <g class="f-vs"><rect x="446" y="30" width="15" height="22" rx="3"/><rect x="446" y="60" width="15" height="22" rx="3"/><rect x="446" y="90" width="15" height="22" rx="3"/><rect x="446" y="120" width="15" height="22" rx="3"/></g>
    <g class="f-c"><rect x="463" y="30" width="30" height="22" rx="3"/><rect x="463" y="60" width="30" height="22" rx="3"/><rect x="463" y="90" width="30" height="22" rx="3"/><rect x="463" y="120" width="30" height="22" rx="3"/></g>
    <text x="560" y="80" class="t-c">all cores busy,</text><text x="560" y="96" class="t-c">no imbalance</text>
    <text x="340" y="164" text-anchor="middle" class="t-mut">same four vertices; time runs left to right</text>
  </g>
</svg></div></figure>
<div class="grid2">
  <div class="tile"><h4>Vertex-concentrated mode</h4><p>Each vertex goes to <b>one SIMD core</b> and its aggregated features come out in a burst. A single vertex can take long, fast vertices wait for slow ones, and there is less parallelism.</p></div>
  <div class="tile"><h4>Vertex-disperse mode</h4><p>The elements of each vertex's feature vector are spread across <b>all cores</b>; free cores take the next vertex. All cores stay busy with no load imbalance.</p></div>
</div>
<h3>Combination engine</h3>
<p>Combination at each vertex is a small neural network: regular but compute-intensive, so it runs on systolic arrays. Several arrays form a <b>systolic module</b>, and there are several modules rather than one big array.</p>
<div class="grid2">
  <div class="tile"><h4>Independent working mode</h4><p>Each module handles the MVMs of a small group of vertices, with weights straight from the weight buffer. <b>Lower vertex latency</b> (combine as soon as features are aggregated); pairs well with vertex-disperse aggregation, which produces features quickly and in order.</p></div>
  <div class="tile"><h4>Co-operative working mode</h4><p>Modules are ganged together to process more vertices at once. Needs the aggregated features of a large group first, but gives <b>more weight reuse</b>.</p></div>
</div>`
    },
    {
      id: 'hygcn-results', title: 'HyGCN results',
      html: String.raw`
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>System</th><th>Compute</th><th>On-chip memory</th><th>Off-chip</th></tr></thead>
<tbody>
<tr><td>PyG-CPU</td><td>2.5 GHz, 24 cores</td><td>60 MB</td><td>DDR4, 136.5 GB/s</td></tr>
<tr><td>PyG-GPU</td><td>1.25 GHz, 5120 cores</td><td>34 MB</td><td>HBM2, ~900 GB/s</td></tr>
<tr><td>HyGCN</td><td>1 GHz, 32 SIMD16 cores + 8 systolic modules (each 4 × 128 arrays)</td><td>128 KB input, 2 MB edge, 2 MB weight, 4 MB output, 16 MB aggregation</td><td>HBM1, 256 GB/s</td></tr>
</tbody></table></div>
<ul>
<li>Speed-up over optimized PyG-CPU (log scale): the GPU gets tens to hundreds of times; HyGCN gets <b>hundreds to thousands</b> (e.g. 1,660.9× on IMDB GCN, up to <b>13,427×</b> on Reddit GIN). The GPU even runs out of memory on Reddit for some models. HyGCN's algorithm optimizations alone give up to 11.9× on the CPU.</li>
<li>HyGCN uses DRAM bandwidth better than the CPU or GPU and needs far fewer DRAM accesses than PyG-CPU.</li>
</ul>
<div class="box exam" data-t="The bigger lesson: the memory wall"><p>Over 20 years, peak hardware FLOPs grew about <b>90,000×</b> (3.1× every 2 years), while DRAM bandwidth and interconnect bandwidth grew only about <b>30×</b> (1.4× every 2 years). Data movement, not arithmetic, is the wall. The next idea is radical: <b>compute where the data resides</b>, which is in-memory computing (next chapter).</p></div>`
    }
  ],
  takeaways: [
    'A GNN layer = (sample) → aggregate neighbours → combine with a shared MLP → (pool); readout gives a graph-level vector.',
    'GCN normalizes by √(D_v D_u); GraphSAGE averages a sampled neighbourhood; GIN adds (1 + ε)·self + Σ neighbours then an MLP.',
    'Aggregation = A·X: graph-dependent, irregular, low reuse, memory-bound. Combination = dense MLP: regular, compute-bound.',
    'On CPU, aggregation costs 11.6 DRAM bytes/op and 170 nJ/op vs 0.06 and 0.5 nJ for combination; aggregation dominates on Reddit (~99%).',
    'HyGCN: SIMD-core aggregation engine (graph partitioning, sparsity elimination, vertex-disperse mode) + systolic combination engine (independent or co-operative modes).',
    'HyGCN reaches up to 13,427× over PyG-CPU; the memory wall (FLOPs 90,000× vs bandwidth 30× in 20 years) motivates in-memory computing.'
  ],
  numbers: [
    ['Cora', '2708 papers, 5429 links, 1433 words, 7 classes', ''],
    ['Reddit', '232,965 nodes, 114.6M edges, 602 features', '972 MB'],
    ['Aggregation vs combination DRAM bytes/op', '11.6 vs 0.06', 'CPU'],
    ['Aggregation vs combination DRAM energy/op', '170 nJ vs 0.5 nJ', 'CPU'],
    ['Combination time on sync/copy', '36%', 'CPU'],
    ['HyGCN', '32 SIMD16 cores + 8 systolic modules', '1 GHz, HBM 256 GB/s'],
    ['HyGCN speed-up', 'up to 13,427×', 'Reddit GIN vs PyG-CPU'],
    ['20-year growth', 'FLOPs 90,000× vs DRAM BW 30×', 'memory wall']
  ],
  quiz: [
    { q: 'Which GNN phase is a dense MLP with weights shared by all vertices?', o: ['Sampling', 'Aggregation', 'Combination', 'Readout'], a: 2, why: 'Combination transforms each vertex vector with shared W and b.' },
    { q: 'In GCN, the neighbour feature h_u is scaled by…', o: ['1 / D_v', '1 / √(D_v D_u)', 'D_u', '(1 + ε)'], a: 1, why: 'Symmetric degree normalization.' },
    { q: 'What does GraphSAGE add to aggregation?', o: ['Edge weights', 'Uniform neighbour sampling and a mean', 'Attention', 'A (1 + ε) self term'], a: 1, why: 'a = Mean of the node and its sampled neighbours.' },
    { q: 'For graph classification, which step produces the graph-level vector?', o: ['Sampling', 'Pooling', 'Readout', 'Combination'], a: 2, why: 'Readout aggregates all vertices, e.g. by summation.' },
    { q: 'Why is aggregation memory-bound?', o: ['It uses FP64', 'Its accesses follow the sparse, irregular graph structure with little reuse', 'It has large weights', 'It needs synchronization'], a: 1, why: '11.6 DRAM bytes per op and high cache MPKI.' },
    { q: 'Node 1 has neighbours 2 and 4 with f₁ values 8 and 2. What is its aggregated f₁ (plain sum, A·X)?', num: 10, tol: 0, why: '8 + 2 = 10, the lecture example.' },
    { q: 'Which HyGCN aggregation mode keeps all SIMD cores busy without load imbalance?', o: ['Vertex-concentrated', 'Vertex-disperse', 'Co-operative', 'Independent'], a: 1, why: 'Each vertex\'s feature elements are spread over all cores.' },
    { q: 'The co-operative working mode of HyGCN\'s combination engine gives…', o: ['lower vertex latency', 'more weight reuse', 'sparsity elimination', 'graph partitioning'], a: 1, why: 'Modules process many vertices together, reusing weights.' },
    { q: 'Peak FLOPs grew about how much in 20 years, per the lecture chart?', o: ['30×', '900×', '90,000×', '1.4×'], a: 2, why: 'Versus only ~30× for DRAM and interconnect bandwidth.' }
  ],
  cards: [
    { f: 'GNN phases', b: 'Sample → aggregate → combine → pool → readout; aggregation and combination dominate.' },
    { f: 'GCN update', b: 'a = Σ h_u / √(D_v D_u); h = ReLU(W a + b).' },
    { f: 'GraphSAGE update', b: 'a = Mean(self ∪ sampled neighbours); h = ReLU(W a + b).' },
    { f: 'GIN update', b: 'a = (1 + ε) h_v + Σ h_u; h = MLP(a).' },
    { f: 'Aggregation vs combination', b: 'Aggregation: irregular, low reuse, memory-bound. Combination: regular, high reuse, compute-bound.' },
    { f: 'HyGCN', b: 'Aggregation engine (SIMD cores, eSched, sampler, sparsity eliminator) + combination engine (systolic modules) + coordinator.' },
    { f: 'Vertex-concentrated vs vertex-disperse', b: 'One vertex per core (imbalance) vs one vertex across all cores (balanced).' },
    { f: 'Memory wall', b: 'FLOPs ×90,000 vs DRAM/interconnect BW ×30 over 20 years → compute in memory.' }
  ]
});
